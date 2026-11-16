"""Sentence splitter for the story paragraphs (rules S1 to S16 in 04-content-pipeline.md).

A character-level state machine, not a regex, because quotes and dialogue tags span
punctuation. Input paragraphs must already be normalized (see normalize.py).
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

TERMINAL = ".!?…"
OPEN_DQ = "„"
CLOSE_DQ = "“”"
OPEN_SQ = "‚"
CLOSE_SQ = "‘"          # U+2018; U+2019 is the apostrophe (Jonas’, geht’s) and never closes
LONG_WORDS = 25
QUOTE_KEEP_WORDS = 20    # S5: quotes up to this many words stay one sentence

ABBREV_FILE = Path(__file__).resolve().parents[3] / "content" / "dictation" / "abbreviations.json"


@dataclass
class Abbreviations:
    abbreviations: set[str]
    never_final: set[str]
    months: set[str]

    @classmethod
    def load(cls, path: Path = ABBREV_FILE) -> "Abbreviations":
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        return cls(set(data["abbreviations"]), set(data["neverFinal"]), set(data["months"]))


@dataclass
class Split:
    text: str
    end_mark: str
    flags: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)   # review-report lines ("S10: digit-dot boundary")
    quote_balance: int = 0
    start: int = 0      # offsets in the (joined) paragraph
    end: int = 0
    par: int = 0        # index of the (joined) paragraph in the sequence


def _words(text: str) -> int:
    return len(re.findall(r"[^\W_]+(?:[’'-][^\W_]+)*", text))


def _next_word(text: str, i: int) -> str:
    m = re.compile(r"[„“”‚‘«»(]*\s*([^\W\d_](?:[^\W_]|[’'-])*)", re.U).match(text, i)
    return m.group(1) if m else ""


def _prev_token(text: str, i: int) -> str:
    """The text chunk (no spaces) directly before index i."""
    j = i
    while j > 0 and not text[j - 1].isspace():
        j -= 1
    return text[j:i]


def _abbrev_before(text: str, dot: int, abbr: Abbreviations) -> str | None:
    before = text[:dot]
    for a in sorted(abbr.abbreviations, key=len, reverse=True):
        if before.endswith(a) and (len(before) == len(a) or not before[-len(a) - 1].isalnum()):
            return a
    # inner part of a multi-part abbreviation ("z." in "z. B.", "d." in "d. h.")
    if re.search(r"(?:^|\s)[a-zäöü]$", before) and re.match(r"\s+[A-Za-zäöü]\.", text[dot + 1:]):
        return "z. B"
    # single uppercase initial: "H." in "Bahram und H., Graz"
    if re.search(r"(?:^|[\s„(])[A-ZÄÖÜ]$", before):
        return "initial"
    return None


def _matching_close(text: str, open_idx: int) -> int:
    """Index of the closing double quote for the opening at open_idx, or -1."""
    for j in range(open_idx + 1, len(text)):
        if text[j] in CLOSE_DQ:
            return j
        if text[j] == OPEN_DQ:
            return -1
    return -1


def split_paragraph(par: str, abbr: Abbreviations) -> list[Split]:
    """Split one paragraph into sentences with review notes."""
    par = par.strip()
    if not par:
        return []
    cuts: list[tuple[int, list[str]]] = []   # (end index exclusive, notes)
    dq = 0
    sq = 0
    quote_words: dict[int, int] = {}          # open index -> word count of the whole quote
    open_stack: list[int] = []
    n = len(par)
    i = 0
    while i < n:
        ch = par[i]
        if ch == OPEN_DQ:
            dq += 1
            open_stack.append(i)
            close = _matching_close(par, i)
            quote_words[i] = _words(par[i + 1:close if close >= 0 else n])
        elif ch in CLOSE_DQ:
            dq = max(0, dq - 1)
            if open_stack:
                open_stack.pop()
        elif ch == OPEN_SQ:
            sq += 1
        elif ch == CLOSE_SQ:
            sq = max(0, sq - 1)
        if ch not in TERMINAL:
            i += 1
            continue

        # a run of terminal marks, e.g. "?!" or "..." (already unified to the ellipsis)
        j = i
        while j + 1 < n and par[j + 1] in TERMINAL:
            j += 1
        run = par[i:j + 1]
        mark_end = j + 1
        was_in_dq = dq
        # closing quote characters that directly follow the mark belong to this sentence
        k = mark_end
        closers = 0
        while k < n and (par[k] in CLOSE_DQ or par[k] == CLOSE_SQ):
            if par[k] in CLOSE_DQ:
                dq = max(0, dq - 1)
                if open_stack:
                    open_stack.pop()
                closers += 1
            else:
                sq = max(0, sq - 1)
            k += 1
        end = k
        rest = par[end:]
        stripped = rest.lstrip()
        notes: list[str] = []
        boundary = False

        if not stripped:
            boundary = True                                            # S1/S2: paragraph end
        elif sq > 0:
            boundary = False                                           # S7: nested single quotes
        elif stripped[0] in ",;:-–)":                                  # S3/S14: tag or clause follows
            boundary = False
        elif run == "…" or run.endswith("…"):
            nxt = _next_word(par, end)
            if closers and was_in_dq and nxt[:1].isupper():
                boundary = True                                        # S13
                notes.append("S13: ellipsis boundary")
            elif not closers and nxt[:1].isupper() and was_in_dq == 0:
                boundary = True
                notes.append("S13: ellipsis boundary")
            elif was_in_dq and not closers:
                boundary = False                                       # S12: inside a quote
            else:
                boundary = nxt[:1].isupper()
                if boundary:
                    notes.append("S13: ellipsis boundary")
        elif run == "." and (m := _abbrev_before(par, i, abbr)) is not None:
            nxt = _next_word(par, end)
            if m == "initial":
                boundary = False
                notes.append("S8: initial, no boundary")
            elif m in abbr.never_final:
                boundary = False
            elif nxt[:1].islower() or not nxt:
                boundary = False
            elif stripped[0].isdigit():
                boundary = False
            else:
                boundary = True
                notes.append(f"S8: abbreviation '{m}.' treated as boundary")
        elif run == "." and re.search(r"\d$", par[:i]) and not closers:
            nxt = _next_word(par, end)
            if stripped[0].isdigit():
                boundary = False                                       # S11 variants: "0664 23 59"
            elif nxt[:1].islower() or nxt in abbr.months:
                boundary = False                                       # S9: ordinal
                notes.append("S9: ordinal dot")
            else:
                boundary = True                                        # S10
                notes.append("S10: digit-dot boundary")
        elif closers and was_in_dq:
            nxt = _next_word(par, end)
            boundary = nxt[:1].isupper() or stripped[0] in "„«"         # S4 (lowercase: tag without comma)
            if not boundary:
                notes.append("S4: lowercase after closing quote, no boundary")
        elif was_in_dq and dq > 0:
            # S5: mark inside a quote with more words in the same quote
            total = quote_words.get(open_stack[-1], 0) if open_stack else 0
            if total <= QUOTE_KEEP_WORDS:
                boundary = False
            else:
                boundary = True
                notes.append(f"S5: long quote ({total} words) split at inner mark")
        else:
            boundary = True

        if boundary:
            cuts.append((end, notes))
            i = end
        else:
            i = end if end > i else i + 1
    if not cuts or cuts[-1][0] < n:
        cuts.append((n, []))

    out: list[Split] = []
    start = 0
    for end, notes in cuts:
        chunk = par[start:end]
        text = chunk.strip()
        lead = len(chunk) - len(chunk.lstrip())
        s0 = start + lead
        start = end
        if not text:
            continue
        sp = _make_split(text, notes)
        sp.start, sp.end = s0, s0 + len(text)
        out.append(sp)
    return out


def _make_split(text: str, notes: list[str]) -> Split:
    marks = [c for c in re.sub(r"[“”‘’»\s)]+$", "", text) if c in TERMINAL]
    core = re.sub(r"[“”‘’»\s)]+$", "", text)
    end_mark = core[-1] if core and core[-1] in TERMINAL else ""
    flags: list[str] = []
    if re.search(r"\d", text):
        flags.append("digits")
    if any("S9" in n for n in notes) or re.search(r"\d\.\s+(?:[a-zäöü]|(?:%s))" % "|".join(
            ["Januar", "Jänner", "Februar", "März", "April", "Mai", "Juni", "Juli", "August",
             "September", "Oktober", "November", "Dezember"]), text):
        flags.append("ordinalDot")
    if end_mark == "…":
        flags.append("ellipsis")
    if OPEN_DQ in text:
        flags.append("quoted")
    if _words(text) > LONG_WORDS:
        flags.append("long")
    if re.search(r"\d\.[“”‘’»)]*$", text):
        flags.append("endsDigitDot")
    balance = text.count(OPEN_DQ) - sum(text.count(c) for c in CLOSE_DQ)
    del marks
    return Split(text=text, end_mark=end_mark, flags=flags, notes=notes, quote_balance=balance)


def join_colon_paragraphs(paragraphs: list[str]) -> tuple[list[str], list[str]]:
    """A paragraph ending in ':' introduces a quoted block in the next paragraph
    (an SMS, a poem). They are joined, because a colon never ends a sentence (S6).
    Returns the new paragraph list and review notes."""
    out: list[str] = []
    notes: list[str] = []
    i = 0
    while i < len(paragraphs):
        p = paragraphs[i]
        if p.rstrip().endswith(":") and i + 1 < len(paragraphs) and paragraphs[i + 1].lstrip().startswith(OPEN_DQ):
            out.append(p.rstrip() + " " + paragraphs[i + 1].lstrip())
            notes.append(f"S6: joined paragraph ending in ':' with the quoted block: '{p[-40:]}'")
            i += 2
        else:
            out.append(p)
            i += 1
    return out, notes


def split_sequence(paragraphs: list[str], abbr: Abbreviations) -> tuple[list[Split], list[str]]:
    """Split all paragraphs of a sequence. Raises ValueError for S1 violations."""
    joined, notes = join_colon_paragraphs(paragraphs)
    result: list[Split] = []
    for idx, p in enumerate(joined):
        if not re.search(r"[.!?…][“”‘’»)]*$", p.strip()):
            raise ValueError(f"S1: paragraph does not end with . ! ? or an ellipsis: ...{p[-50:]!r}")
        for sp in split_paragraph(p, abbr):
            sp.par = idx
            result.append(sp)
    return result, notes
