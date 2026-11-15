"""Link story words to vocabulary cards (04-content-pipeline.md, "Word links to vocabulary").

Resolution is done at build time: a form index from the CSV (nouns, plurals, generated verb
paradigms, adjective endings, phrases, clitics), separable verb groups, and a coverage report.
Link ranges are character offsets into the sentence text; the tokenizer here is the contract
for `src/services/dictation/normalize.ts`.
"""
from __future__ import annotations

import csv
import json
import re
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CSV_FILE = ROOT / "public" / "data" / "wortschatz-daf-kompakt.csv"
INFLECTIONS_FILE = ROOT / "content" / "dictation" / "inflections.json"

TOKEN_RE = re.compile(r"[^\W_]+(?:[’'\-][^\W_]+)*", re.U)
ARTICLES = {"der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "eines"}

FUNCTION_WORDS = ARTICLES | {
    "ich", "mich", "mir", "du", "dich", "dir", "er", "ihn", "ihm", "es", "sie", "ihr", "ihnen", "wir", "uns", "euch",
    "und", "oder", "aber", "denn", "dass", "weil", "wenn", "ob", "als", "wie", "wo", "was", "wer", "wann", "warum",
    "nicht", "nur", "auch", "sehr", "schon", "noch", "so", "da", "dann", "hier", "dort", "ja", "nein", "doch", "mal",
    "zu", "an", "auf", "in", "im", "am", "um", "von", "mit", "bei", "nach", "aus", "für", "über", "unter", "vor",
    "durch", "zum", "zur", "vom", "beim", "ins", "ans", "aufs", "bis", "ab", "gegen", "ohne", "seit", "zwischen",
    "man", "mehr", "viel", "viele", "alle", "alles", "kein", "keine", "keinen", "keinem", "keiner", "dies", "diese",
    "dieser", "dieses", "diesem", "diesen", "jetzt", "gern", "gerne", "immer", "oft", "wieder", "bitte", "danke",
}
NUMBER = re.compile(
    r"^(?:(?:ein|zwei|drei|vier|fünf|sechs|sieben|acht|neun)und)?(?:zwanzig|dreißig|vierzig|fünfzig|sechzig|siebzig|achtzig|neunzig)$"
    r"|^(?:null|eins|ein|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf|dreizehn|vierzehn|fünfzehn|sechzehn|"
    r"siebzehn|achtzehn|neunzehn|hundert|tausend|halb|viertel|dreiviertel|erste|zweite|dritte|vierte|fünfte)$", re.I)
POSSESSIVE = re.compile(r"^(mein|dein|sein|ihr|unser|euer|eur)(e|en|em|er|es)?$")

IRREGULAR = {
    "sein": "bin bist ist sind seid war warst waren wart gewesen sei",
    "haben": "habe hast hat haben habt hatte hattest hatten hattet gehabt",
    "werden": "werde wirst wird werden werdet wurde wurdest wurden wurdet geworden worden",
    "wissen": "weiß weißt wissen wisst wusste wusstest wussten wusstet gewusst",
    "können": "kann kannst können könnt konnte konntest konnten konntet gekonnt",
    "müssen": "muss musst müssen müsst musste musstest mussten musstet gemusst",
    "wollen": "will willst wollen wollt wollte wolltest wollten wolltet gewollt",
    "sollen": "soll sollst sollen sollt sollte solltest sollten solltet gesollt",
    "dürfen": "darf darfst dürfen dürft durfte durftest durften durftet gedurft",
    "mögen": "mag magst mögen mögt mochte mochtest mochten mochtet gemocht",
    "möchten": "möchte möchtest möchten möchtet",
}


MODAL_FORMS = {f for v in ("können", "müssen", "wollen", "sollen", "dürfen", "mögen", "möchten") for f in IRREGULAR[v].split()}


def tokenize(text: str) -> list[tuple[int, int, str]]:
    return [(m.start(), m.end(), m.group()) for m in TOKEN_RE.finditer(text)]


def _split_variants(s: str) -> list[str]:
    s = re.sub(r"\([^)]*\)", "", s)
    parts = re.split(r"\s*(?:/|·|≠|;|\s–\s)\s*", s)
    out = []
    for p in parts:
        p = re.sub(r"\([^)]*\)", "", p)
        p = re.sub(r"[!?…]", "", p).strip(" .,–-")
        if p:
            out.append(p)
    return out


def _strip_article(s: str) -> str:
    return re.sub(r"^(?:der|die|das)\s+", "", s.strip())


def _alpha(s: str) -> bool:
    return bool(re.fullmatch(r"[^\W\d_](?:[^\W_]|[’'\-])*", s))


@dataclass
class Card:
    id: str
    wort: str
    lektion: int
    wortart: str


@dataclass
class FormIndex:
    nouns: dict[str, list[Card]] = field(default_factory=dict)
    others: dict[str, list[Card]] = field(default_factory=dict)
    phrases: dict[tuple[str, ...], list[Card]] = field(default_factory=dict)
    separable: dict[str, list[tuple[Card, str]]] = field(default_factory=dict)  # finite form -> (card, particle)
    cards: dict[str, Card] = field(default_factory=dict)

    def _add(self, table: dict, form: str, card: Card) -> None:
        form = form.lower()
        if not form or not _alpha(form):
            return
        lst = table.setdefault(form, [])
        if card not in lst:
            lst.append(card)

    def add_noun(self, form: str, card: Card) -> None:
        self._add(self.nouns, form, card)

    def add_other(self, form: str, card: Card) -> None:
        if form.lower() in ARTICLES and card.wort.lower() not in ARTICLES:
            return
        self._add(self.others, form, card)


def _verb_forms(inf: str, er: str, pret: str, perfekt: str, sep_particle: str | None) -> tuple[set[str], set[str]]:
    """Return (finite and other forms, finite forms usable for the separable link)."""
    forms: set[str] = set()
    finite: set[str] = set()
    if inf in IRREGULAR:
        forms.update(IRREGULAR[inf].split())
        forms.add(inf)
        return forms, finite
    base = inf
    if sep_particle and inf.startswith(sep_particle):
        base = inf[len(sep_particle):]
    forms.add(inf)
    stem = base[:-2] if base.endswith("en") else base[:-1]
    fin: set[str] = set()
    fin.update({stem + "e", base, stem + "t", stem + "et", stem + "st", stem + "est", stem, base[:-1] + "n" if False else base})
    er_first = er.split()[0] if er else ""
    if er_first:
        fin.add(er_first)
        if er_first.endswith("t") and not er_first.endswith("st"):
            core = er_first[:-1]
            fin.add(core + ("t" if core[-1:] in "sßxz" else "st"))
            fin.add(core)                       # imperative: sprich
        elif er_first.endswith("st") or er_first[-1:] in "sßz":
            fin.add(er_first)
    pret_first = pret.split()[0] if pret else ""
    if pret_first:
        fin.update({pret_first, pret_first + "st", pret_first + ("n" if pret_first.endswith("e") else "en"),
                    pret_first + ("t" if pret_first.endswith("e") else "t"), pret_first + "est" if not pret_first.endswith("e") else pret_first + "st"})
    if perfekt:
        part = perfekt.split()[-1]
        forms.add(part)
    forms.update(fin)
    if sep_particle:
        finite = {f for f in fin if f != base or True}
        forms -= {f for f in fin}
        forms |= {inf}
    return forms, finite


def load_cards(csv_path: Path = CSV_FILE) -> list[dict]:
    with open(csv_path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def build_index(rows: list[dict] | None = None, inflections: dict | None = None) -> FormIndex:
    rows = rows if rows is not None else load_cards()
    idx = FormIndex()
    by_wort: dict[str, Card] = {}
    for r in rows:
        card = Card(f"daf_{r['Lektion']}_{r['Nr']}", r["Wort"], int(r["Lektion"] or 0), r["Wortart"])
        idx.cards[card.id] = card
        by_wort.setdefault(r["Wort"], card)
        wa = r["Wortart"]
        wort = r["Wort"]
        if wa == "Nomen":
            _index_noun(idx, r, card)
        elif wa == "Verb":
            _index_verb(idx, r, card)
        elif wa == "Adjektiv":
            for v in _split_variants(wort) + [x for x in (re.sub(r"^am\s+", "", p) for p in _split_variants(r["Formen"])) if x]:
                v = _strip_article(v)
                if " " in v:
                    continue
                idx.add_other(v, card)
                for end in ("e", "en", "er", "es", "em"):
                    idx.add_other(v + end, card)
        else:
            for v in _split_variants(wort):
                v = _strip_article(v) if wa == "Pronomen" and v.split()[0] in ARTICLES and len(v.split()) == 1 else v
                toks = tuple(t.lower() for t in re.findall(TOKEN_RE, v))
                if len(toks) >= 2:
                    idx.phrases.setdefault(toks, []).append(card)
                elif len(toks) == 1:
                    idx.add_other(toks[0], card)
    for form, wortlist in (inflections or {}).get("forms", {}).items():
        for w in wortlist:
            card = by_wort.get(w)
            if card is None:
                raise ValueError(f"inflections.json: no CSV row with Wort {w!r} (form {form!r})")
            (idx.nouns if form[:1].isupper() else idx.others).setdefault(form.lower(), []).append(card)
    return idx


def _index_noun(idx: FormIndex, r: dict, card: Card) -> None:
    sing: list[str] = []
    for v in _split_variants(r["Wort"]):
        v = _strip_article(v)
        if v and v[0].isupper() and " " not in v:
            sing.append(v)
    plurals = [_strip_article(p) for p in _split_variants(r["Plural"])]
    gen = re.search(r"Gen:\s*(?:des\s+)?(\S+)", r["Formen"])
    feminine = r["Artikel"] == "die"
    for s in sing:
        idx.add_noun(s, card)
        if not feminine:
            idx.add_noun(s + "s", card)
            idx.add_noun(s + "es", card)
        if s.endswith("e") or s.endswith("er") or s.endswith("el") or s.endswith("en"):
            idx.add_noun(s + "n", card)
    for p in plurals:
        if " " in p or not p or not p[0].isupper():
            continue
        idx.add_noun(p, card)
        if not p.endswith(("n", "s")):
            idx.add_noun(p + "n", card)
    if gen:
        idx.add_noun(gen.group(1), card)
    # multi-word nouns such as "Chinesisch" lines are split by _split_variants already


def _index_verb(idx: FormIndex, r: dict, card: Card) -> None:
    variants = _split_variants(r["Wort"])
    inf = re.sub(r"^sich\s+", "", variants[0] if variants else r["Wort"].strip())
    if " " in inf or not _alpha(inf):
        for v in _split_variants(r["Wort"]):
            toks = tuple(t.lower() for t in TOKEN_RE.findall(v))
            if len(toks) >= 2:
                idx.phrases.setdefault(toks, []).append(card)
        return
    er = r["Präsens"].strip()
    sep = "trennbar" in r["Formen"]
    particle = er.split()[-1] if sep and er and len(er.split()) >= 2 else None
    forms, finite = _verb_forms(inf, er, r["Präteritum"].strip(), r["Perfekt"].strip(), particle)
    for f in forms:
        idx.add_other(f, card)
    if sep and particle:
        for f in finite:
            idx.separable.setdefault(f.lower(), []).append((card, particle.lower()))
            idx.add_other(f, card)     # a lone finite form still links, but the group wins when the particle is found


def order_cards(cards: list[Card], last_lesson: int) -> list[str]:
    inside = sorted((c for c in cards if c.lektion <= last_lesson), key=lambda c: (c.lektion, c.id))
    outside = sorted((c for c in cards if c.lektion > last_lesson), key=lambda c: (c.lektion, c.id))
    seen: list[str] = []
    for c in inside + outside:
        if c.id not in seen:
            seen.append(c.id)
    return seen


@dataclass
class LinkResult:
    links: list[dict]
    content_tokens: int
    linked_tokens: int
    unresolved: list[str]


def _is_initial(text: str, start: int) -> bool:
    before = text[:start].rstrip()
    return not before or before[-1] in "„“‚:.!?…"


def link_sentence(text: str, idx: FormIndex, last_lesson: int, protected: set[str], names: set[str]) -> LinkResult:
    toks = tokenize(text)
    consumed = [False] * len(toks)
    links: list[dict] = []
    lower = [t[2].lower() for t in toks]

    # phrases, longest first
    for n in sorted({len(k) for k in idx.phrases}, reverse=True):
        for i in range(len(toks) - n + 1):
            if any(consumed[i:i + n]):
                continue
            if tuple(lower[i:i + n]) in idx.phrases:
                cards = idx.phrases[tuple(lower[i:i + n])]
                links.append({"s": toks[i][0], "e": toks[i + n - 1][1], "cards": order_cards(cards, last_lesson),
                              "lemma": cards[0].wort.strip("!? "), "kind": "phrase"})
                for k in range(i, i + n):
                    consumed[k] = True

    # separable verbs: finite form plus the particle at the end of the clause
    for i, w in enumerate(lower):
        if consumed[i] or w not in idx.separable:
            continue
        for card, particle in idx.separable[w]:
            for j in range(i + 1, min(len(toks), i + 12)):
                if consumed[j] or lower[j] != particle:
                    continue
                after = text[toks[j][1]:toks[j][1] + 2].lstrip()
                if not after or after[0] in ".,!?…“”;:":
                    ids = order_cards([card], last_lesson)
                    lemma = card.wort
                    links.append({"s": toks[i][0], "e": toks[i][1], "cards": ids, "lemma": lemma, "kind": "separable"})
                    links.append({"s": toks[j][0], "e": toks[j][1], "cards": ids, "lemma": lemma, "kind": "separable"})
                    consumed[i] = consumed[j] = True
                    break
            if consumed[i]:
                break

    content = linked = 0
    unresolved: list[str] = []
    for i, (s, e, w) in enumerate(toks):
        if consumed[i]:
            content += 1
            linked += 1
            continue
        lw = w.lower()
        cap = w[0].isupper()
        initial = _is_initial(text, s)
        cands: list[Card] = []
        probe = [lw]
        if lw.endswith(("’s", "'s")):
            probe.append(lw[:-2])
        for pw in probe:
            if cap and pw in idx.nouns and (not initial or pw not in idx.others):
                cands = idx.nouns[pw]
            elif (not cap or initial) and pw in idx.others:
                cands = idx.others[pw]
            elif cap and pw in idx.others and initial:
                cands = idx.others[pw]
            elif cap and pw in idx.nouns:
                cands = idx.nouns[pw]
            if cands:
                break
        if cands:
            links.append({"s": s, "e": e, "cards": order_cards(cands, last_lesson), "lemma": cands[0].wort, "kind": "form"})
            content += 1
            linked += 1
            continue
        # not a card: function word, number, name or an unresolved content word
        if (lw in FUNCTION_WORDS or POSSESSIVE.match(lw) or NUMBER.match(lw) or lw in MODAL_FORMS
                or (cap and w.endswith("s") and w[:-1] in names) or w.isdigit() or any(ch.isdigit() for ch in w)
                or w in protected or w in names or len(w) == 1):
            continue
        content += 1
        unresolved.append(w)
    links.sort(key=lambda l: (l["s"], l["e"]))
    return LinkResult(links, content, linked, unresolved)
