"""Speaker attribution (rules in 04-content-pipeline.md, strongest first).

Works on paragraphs: finds the quoted spans, proposes a speaker per span, then maps
the spans onto the sentences produced by the splitter (`segments` for mixed sentences).
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from .splitter import CLOSE_DQ, OPEN_DQ, Split, join_colon_paragraphs

CAST_FILE = Path(__file__).resolve().parents[3] / "content" / "dictation" / "cast.json"
NARRATOR = "NARRATOR"
UNKNOWN = "UNKNOWN"
CONF_RANK = {"high": 0, "medium": 1, "low": 2}

PRONOUNS = {"sie": "f", "er": "m"}


@dataclass
class Cast:
    characters: list[dict]
    speech_verbs: set[str]
    alias_re: re.Pattern
    alias_to_id: dict[str, str]
    gender: dict[str, str]

    @classmethod
    def load(cls, path: Path = CAST_FILE) -> "Cast":
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        chars = data["characters"]
        alias_to_id = {a: c["id"] for c in chars for a in c["aliases"]}
        # longest alias first so "Frau Lechner" beats "Lechner"
        alts = sorted(alias_to_id, key=len, reverse=True)
        rx = re.compile(r"(?<![\w])(" + "|".join(re.escape(a) for a in alts) + r")(?:s)?(?![\w])")
        return cls(chars, set(data["speechVerbs"]), rx, alias_to_id, {c["id"]: c["gender"] for c in chars})

    def ids(self) -> set[str]:
        return {c["id"] for c in self.characters}

    def mentions(self, text: str) -> list[tuple[int, str]]:
        """(offset, cast id) for every alias mention, in text order, without overlaps."""
        return [(m.start(), self.alias_to_id[m.group(1)]) for m in self.alias_re.finditer(text)]


@dataclass
class QuoteSpan:
    start: int            # index of the opening quote
    end: int              # index after the closing quote (or paragraph end)
    speaker: str = UNKNOWN
    rule: str = ""
    confidence: str = "low"


@dataclass
class Seg:
    text: str
    speaker: str


@dataclass
class Attribution:
    speaker: str                      # primary
    rule: str
    confidence: str
    segments: list[Seg] = field(default_factory=list)   # only for mixed sentences


def find_quotes(par: str) -> list[QuoteSpan]:
    spans: list[QuoteSpan] = []
    i = 0
    while i < len(par):
        if par[i] == OPEN_DQ:
            j = i + 1
            while j < len(par) and par[j] not in CLOSE_DQ:
                j += 1
            spans.append(QuoteSpan(i, min(j + 1, len(par))))
            i = j + 1
        else:
            i += 1
    return spans


def _sentence_before(par: str, idx: int) -> str:
    """Narration of the clause right before a quote: back to the previous sentence end."""
    head = par[:idx]
    cut = max((head.rfind(c) for c in ".!?…"), default=-1)
    # a sentence end inside an earlier quote does not count; take the text after the last closing quote
    last_close = max((head.rfind(c) for c in CLOSE_DQ), default=-1)
    cut = max(cut, last_close)
    return head[cut + 1:].strip()


def _tag_after(par: str, end: int) -> str:
    """Narration right after a closing quote, up to the next quote or sentence end."""
    tail = par[end:]
    m = re.match(r"\s*,?\s*([^„.!?…]*)", tail)
    return (m.group(1) if m else "").strip() if tail.lstrip().startswith(",") else ""


def _has_speech_verb(text: str, cast: Cast) -> bool:
    return any(w in cast.speech_verbs for w in re.findall(r"[^\W\d_]+", text))


SPEECH_PRON = re.compile(r"\b(?:%s)\s+(sie|er)\b")
SELF_INTRO = re.compile(r"(?:\bIch bin|\bIch heiße|\bMein Name ist|\bIch heisse)\s+")


def _narration_only(par: str) -> str:
    return re.sub(r"„[^“”]*[“”]", " ", par)


def _last_sentence(text: str) -> str:
    parts = [p for p in re.split(r"(?<=[.!?…])\s+", text.strip()) if p]
    return parts[-1] if parts else ""


def propose_speakers(paragraphs: list[str], cast: Cast) -> list[list[QuoteSpan]]:
    """One list of QuoteSpans per paragraph, speakers proposed (rules 1 to 5)."""
    speech_pron = re.compile(
        r"\b(?:" + "|".join(re.escape(v) for v in sorted(cast.speech_verbs)) + r")\s+(sie|er)\b")
    recent: list[str] = []          # distinct characters, most recent first
    prev_speaker: str | None = None
    hint: tuple[str, bool] | None = None   # (character, has speech verb) from the narration right before
    result: list[list[QuoteSpan]] = []

    def touch(cid: str) -> None:
        if cid in recent:
            recent.remove(cid)
        recent.insert(0, cid)

    def of_gender(g: str) -> str | None:
        for cid in recent:
            if cast.gender.get(cid) == g or (g == "c" and cast.gender.get(cid) == "c"):
                return cid
        return None

    for par in paragraphs:
        spans = find_quotes(par)
        if not spans:
            # narration: remember who acts, so that the following quote can use it
            last = _last_sentence(par)
            m = cast.mentions(last)
            ids: list[str] = []
            for _, cid in m:
                if cid not in ids:
                    ids.append(cid)
            others = [cid for _, cid in cast.mentions(par) if cid not in ids and cid != NARRATOR]
            for cid in reversed(list(dict.fromkeys(others))):
                if cid not in recent:
                    recent.append(cid)          # participants of the scene, behind the actor
            if ids:
                spoken = _has_speech_verb(last, cast)
                if spoken and len(ids) >= 2:
                    # "Frau Wagner fragt, und Nilufar antwortet." -> first mention starts
                    for cid in reversed(ids):
                        touch(cid)
                    hint = (ids[0], True)
                else:
                    touch(ids[0])
                    hint = (ids[0], spoken)
            else:
                pm2 = re.search(r"\b(Sie|sie|Er|er)\b", last)
                g2 = ("f" if pm2.group(1).lower() == "sie" else "m") if pm2 else ""
                hint = (of_gender(g2), False) if g2 and of_gender(g2) else None
            result.append(spans)
            continue
        for _, cid in cast.mentions(par[:spans[0].start]):
            touch(cid)                  # narration before the first quote names the scene's actors
        for qi, q in enumerate(spans):
            before = _sentence_before(par, q.start)
            tag = _tag_after(par, q.end)
            tag_m = cast.mentions(tag)
            before_m = cast.mentions(before)
            starts_par = q.start == 0
            quote_text = par[q.start:q.end]
            pm = speech_pron.search(tag) if tag else None
            sm = SELF_INTRO.search(quote_text)
            self_m = cast.mentions(quote_text[sm.end():sm.end() + 40]) if sm else []
            if tag and _has_speech_verb(tag, cast) and tag_m:
                q.speaker, q.rule, q.confidence = tag_m[0][1], "tag after quote", "high"
            elif pm:
                g = {"sie": "f", "er": "m"}[pm.group(1)]
                cand = next((c for c in recent if cast.gender.get(c) == g and c != prev_speaker), None) or of_gender(g)
                q.speaker, q.rule, q.confidence = (cand or UNKNOWN), f"pronoun tag ({pm.group(1)}) -> recent {g} speaker", "medium"
            elif before and before.endswith(":") and before_m:
                q.speaker, q.rule = before_m[0][1], "intro before quote"
                q.confidence = "high" if _has_speech_verb(before, cast) else "medium"
            elif before and not starts_par and before_m and _has_speech_verb(before, cast):
                q.speaker, q.rule, q.confidence = before_m[0][1], "speech verb before quote", "high"
            elif before and not starts_par and not before.endswith(":"):
                q.speaker, q.rule, q.confidence = NARRATOR, "quote inside narration (title, sign, text)", "medium"
            elif self_m:
                q.speaker, q.rule, q.confidence = self_m[0][1], "self-introduction in the quote", "medium"
            elif starts_par and qi == 0 and hint is not None:
                q.speaker, q.rule, q.confidence = hint[0], "actor of the narration before", "medium"
            elif not before and not starts_par and cast.mentions(_last_sentence(par[:q.start])):
                q.speaker = cast.mentions(_last_sentence(par[:q.start]))[0][1]
                q.rule, q.confidence = "actor of the sentence before the quote", "medium"
            elif not before and not starts_par and re.search(r"\b(?:Sie|sie|Er|er)\b", _last_sentence(par[:q.start])) and of_gender(
                    "f" if re.search(r"\b[Ss]ie\b", _last_sentence(par[:q.start])) else "m"):
                g = "f" if re.search(r"\b[Ss]ie\b", _last_sentence(par[:q.start])) else "m"
                q.speaker, q.rule, q.confidence = of_gender(g), f"pronoun subject before the quote ({g}) -> recent actor", "medium"
            else:
                cand = next((c for c in recent if c != prev_speaker and c != NARRATOR), None)
                q.speaker = cand or UNKNOWN
                q.rule, q.confidence = ("turn taking", "low") if cand else ("no rule matched", "low")
            if q.speaker not in (UNKNOWN, NARRATOR):
                touch(q.speaker)
                prev_speaker = q.speaker
            elif q.speaker == NARRATOR:
                pass
            hint = None
        result.append(spans)
    return result


def attribute_sentences(paragraphs: list[str], splits: list[Split], cast: Cast) -> list[Attribution]:
    """Map the proposed quote speakers onto the splitter's sentences."""
    spans_by_par = propose_speakers(paragraphs, cast)
    out: list[Attribution] = []
    for sp in splits:
        par = paragraphs[sp.par]
        spans = spans_by_par[sp.par]
        # split the sentence range into narration and quote pieces
        pieces: list[tuple[int, int, str, str, str]] = []   # start, end, speaker, rule, confidence
        pos = sp.start
        for q in spans:
            if q.end <= sp.start or q.start >= sp.end:
                continue
            qs, qe = max(q.start, sp.start), min(q.end, sp.end)
            if qs > pos:
                pieces.append((pos, qs, NARRATOR, "narration", "high"))
            pieces.append((qs, qe, q.speaker, q.rule, q.confidence))
            pos = qe
        if pos < sp.end:
            pieces.append((pos, sp.end, NARRATOR, "narration", "high"))
        # a continued long quote starts inside the quote (opening quote is in an earlier sentence)
        if not pieces:
            pieces = [(sp.start, sp.end, NARRATOR, "narration", "high")]
        weights: dict[str, int] = {}
        for s0, s1, spk, _, _ in pieces:
            weights[spk] = weights.get(spk, 0) + (s1 - s0)
        quote_pieces = [p for p in pieces if p[2] != NARRATOR]
        primary = max(weights, key=lambda k: weights[k]) if weights else NARRATOR
        if quote_pieces and primary == NARRATOR:
            # keep a character as the chip when the sentence contains a quote spoken by a character
            primary = max(quote_pieces, key=lambda p: p[1] - p[0])[2]
        worst = max((p[4] for p in pieces), key=lambda c: CONF_RANK[c])
        rules = [p[3] for p in pieces if p[2] == primary] or [pieces[0][3]]
        segs: list[Seg] = []
        if len({p[2] for p in pieces}) > 1:
            segs = [Seg(par[s0:s1].strip(), spk) for s0, s1, spk, _, _ in pieces if par[s0:s1].strip()]
        out.append(Attribution(primary, rules[0], worst, segs))
    return out
