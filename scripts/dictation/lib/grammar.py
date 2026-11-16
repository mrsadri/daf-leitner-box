"""Candidate grammar detection for story sentences (docs/dictation/08-grammar-drawer.md).

Rule-based and deliberately conservative: a missed point is cheap, a wrong point misleads a learner. Every
candidate is shown in the review report and a human confirms or corrects it in `story-NN.overrides.json`
(`grammar.add`, `grammar.remove`).

Detectors work on the sentence text and on the vocabulary links already computed for it (a link whose lemma is an
infinitive marks a verb form). Each detector returns True or False for one sentence; `POINTS` maps a point id to its
detector and its scope:

  every      the point is attached to every sentence that carries it
  sequence   the point is very common (articles, "und", plain present): it is attached to the first sentence of each
             sequence that carries it, so the drawer stays readable
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable

from . import linker

WORD = r"[A-Za-zÄÖÜäöüß]+"
VERB_LEMMA = re.compile(r"^(?:sich )?[a-zäöüß]+(?:en|ln|rn)$")
SUBJECT = {"ich", "du", "er", "sie", "es", "wir", "ihr", "man"}
W_WORDS = {"wer", "was", "wo", "woher", "wohin", "wann", "wie", "warum", "wieso", "weshalb", "welche", "welcher",
           "welchen", "welches", "welchem", "wen", "wem", "wessen", "womit", "wofür", "wozu", "worüber", "wovon"}
AUX = {"habe", "hast", "hat", "haben", "habt", "bin", "bist", "ist", "sind", "seid"}
MODAL_L3 = set("kann kannst können könnt muss musst müssen müsst möchte möchtest möchten möchtet".split())
MODAL_L4 = set("darf darfst dürfen dürft will willst wollen wollt mag magst mögen mögt".split())
MODAL_ALL = MODAL_L3 | MODAL_L4 | set("soll sollst sollen sollt".split())
PRETERITE = set("hatte hattest hatten hattet war warst waren wart".split())
VOWEL_CHANGE = set("""liest siehst sieht sprichst spricht triffst trifft fährst fährt schläfst schläft läufst läuft
weißt weiß isst nimmst nimmt gibst gibt hilfst hilft wäschst wäscht lädst lädt trägst trägt fällt gefällt hältst hält
vergisst empfiehlst empfiehlt""".split())
VOWEL_CHANGE_LEMMAS = set("lesen sehen sprechen treffen fahren schlafen laufen wissen essen nehmen geben helfen waschen laden tragen fallen gefallen halten vergessen empfehlen".split())
IRREGULAR_PRESENT_LEMMAS = VOWEL_CHANGE_LEMMAS | {"sein", "haben", "werden", "können", "müssen", "wollen", "sollen",
                                                  "dürfen", "mögen", "möchten"}
SEPARABLE_PREFIX = r"(?:an|auf|aus|ab|ein|mit|weg|zurück|zu|vor|nach|fest|her|hin|los|um|weiter|zusammen|zurecht|heraus|herunter|hinein|vorbei|statt|teil|frei|bereit|hoch|dabei|fern|fort|dazu|nieder)"
SEP_PARTICIPLE = re.compile(rf"^{SEPARABLE_PREFIX}ge[a-zäöüß]{{2,}}(?:t|en)$")
SEP_INFINITIVE = re.compile(rf"^{SEPARABLE_PREFIX}[a-zäöüß]{{3,}}(?:en|ern|eln)$")
INSEP_PARTICIPLE = re.compile(r"^(?:be|er|ver|ent|emp|zer|miss)[a-zäöüß]{3,}(?:t|en)$")
REGULAR_PARTICIPLE = re.compile(r"^(?:ge[a-zäöüß]{2,}t|[a-zäöüß]{3,}iert)$")
STRONG_PARTICIPLE = re.compile(r"^ge[a-zäöüß]{2,}en$")
MIXED_PARTICIPLES = set("gebracht gedacht gewusst gekannt genannt gerannt gesandt gewandt".split())
IRREGULAR_IMPERATIVE = set("sei seid seien hab habt".split())
VOWEL_IMPERATIVE = set("lies sieh nimm gib sprich iss hilf triff vergiss fahr lauf schlaf wasch lade empfiehl".split())
ARTICLE_FORMS = {"der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "eines"}
POSSESSIVE = re.compile(r"^(?:mein|dein|sein|ihr|Ihr|unser|euer|eur)(?:e|en|em|er|es)?$")
NEGATION_KEIN = re.compile(r"^kein(?:e|en|em|er|es)?$")


@dataclass
class Word:
    text: str
    lower: str
    start: int
    end: int
    lemma: str | None      # verb lemma when the vocabulary link says this token is a verb form
    cap: bool


@dataclass
class Clause:
    words: list[Word]
    end: str               # '.', '!', '?', or '' when the clause has no terminal mark


class Facts:
    """Everything the detectors need about one sentence."""

    def __init__(self, text: str, links: list[dict]):
        self.text = text
        verbs: dict[int, str] = {}
        self.separable: list[dict] = []
        for l in links:
            lem = l.get("lemma", "")
            if l.get("kind") == "separable":
                self.separable.append(l)
            if VERB_LEMMA.match(lem) and l.get("kind") == "form":
                verbs[l["s"]] = re.sub(r"^sich ", "", lem)
        self.words: list[Word] = []
        for s, e, t in linker.tokenize(text):
            if not re.fullmatch(WORD + r"(?:[’'\-]" + WORD + ")*", t):
                continue
            self.words.append(Word(t, t.lower(), s, e, verbs.get(s), t[:1].isupper()))
        self.lower = [w.lower for w in self.words]
        self.clauses = self._clauses()
        self.question = any(c.end == "?" for c in self.clauses)

    def _clauses(self) -> list[Clause]:
        out: list[Clause] = []
        for piece in re.split(r"[„“”\"»«]+", self.text):
            pos = 0
            for m in re.finditer(r"[.!?]+(?=\s|$)|…", piece):
                out.append(self._clause(piece[pos:m.start()], m.group()[-1]))
                pos = m.end()
            if piece[pos:].strip():
                out.append(self._clause(piece[pos:], ""))
        return [c for c in out if c.words]

    def _clause(self, seg: str, end: str) -> Clause:
        ws = [Word(t, t.lower(), s, e, None, t[:1].isupper()) for s, e, t in linker.tokenize(seg)
              if re.fullmatch(WORD + r"(?:[’'\-]" + WORD + ")*", t)]
        # lowercase start with no leading capital means a continuation (", sagt Lucía."), not a new clause
        stripped = seg.lstrip()
        if stripped and not stripped[0].isalpha():
            return Clause([], end)
        if ws and not ws[0].cap:
            return Clause([], end)
        return Clause(ws, end)

    def is_verb_form(self, w: Word) -> bool:
        return w.lemma is not None or w.lower in AUX or w.lower in MODAL_ALL or w.lower in PRETERITE

    def verb_first_clauses(self) -> list[Clause]:
        res = []
        for c in self.clauses:
            if not c.words:
                continue
            w = c.words[0]
            if w.lower in W_WORDS:
                continue
            if self._clause_first_is_verb(c):
                res.append(c)
        return res

    def _clause_first_is_verb(self, c: Clause) -> bool:
        w = c.words[0]
        if w.lower in AUX or w.lower in MODAL_ALL or w.lower in PRETERITE or w.lower in IRREGULAR_IMPERATIVE:
            return True
        for x in self.words:
            if x.start >= 0 and x.lower == w.lower and x.lemma:
                return True
        return w.lemma is not None


# --- detectors -------------------------------------------------------------------------------------------------

def _pairs(f: Facts):
    for i in range(len(f.words) - 1):
        yield f.words[i], f.words[i + 1], i


def d_present_regular(f: Facts) -> bool:
    for a, b, i in _pairs(f):
        subj_first = a.lower in SUBJECT or (a.text == "Sie")
        if subj_first and b.lemma and b.lemma not in IRREGULAR_PRESENT_LEMMAS and b.lower not in AUX \
                and b.lower not in PRETERITE and re.search(r"(e|st|t|en|et|n)$", b.lower) \
                and not re.match(r"^ge.*t$", b.lower):
            return True
        if a.lemma and a.lemma not in IRREGULAR_PRESENT_LEMMAS and a.lower not in AUX and i == 0 \
                and (b.lower in SUBJECT or b.text == "Sie") and a.lower not in VOWEL_CHANGE \
                and re.search(r"(e|st|t|en|et|n)$", a.lower):
            return True
    return False


def d_word_order_questions(f: Facts) -> bool:
    for c in f.clauses:
        if c.end != "?" or not c.words:
            continue
        if c.words[0].lower in W_WORDS:
            return True
        if f._clause_first_is_verb(c) and len(c.words) > 1:
            return True
    return False


def d_negation(f: Facts) -> bool:
    return any(w.lower == "nicht" or NEGATION_KEIN.match(w.lower) for w in f.words)


def d_articles(f: Facts) -> bool:
    for i, w in enumerate(f.words[:-1]):
        if w.lower in ARTICLE_FORMS:
            nxt = f.words[i + 1]
            nxt2 = f.words[i + 2] if i + 2 < len(f.words) else None
            if nxt.cap or (nxt2 is not None and nxt2.cap and not nxt.cap):
                return True
    return False


def d_subject_order(f: Facts) -> bool:
    if f.question:
        return False
    for a, b, i in _pairs(f):
        if i >= 1 and b.lower in SUBJECT and f.is_verb_form(a):
            return True
    return False


def d_akk_definite(f: Facts) -> bool:
    return any(w.lower == "den" and i + 1 < len(f.words) and f.words[i + 1].cap for i, w in enumerate(f.words))


def d_akk_indefinite(f: Facts) -> bool:
    return any(w.lower in ("einen", "keinen") and i + 1 < len(f.words) and f.words[i + 1].cap for i, w in enumerate(f.words))


def d_pronoun_akk(f: Facts) -> bool:
    return any(w.lower in ("mich", "dich", "ihn", "uns", "euch") for w in f.words)


def d_modal_l3(f: Facts) -> bool:
    return any(w.lower in MODAL_L3 for w in f.words)


def d_modal_order(f: Facts) -> bool:
    if not d_modal_l3(f):
        return False
    for c in f.clauses:
        ws = [w for w in c.words]
        if any(w.lower in MODAL_L3 for w in ws) and ws:
            last = ws[-1]
            if last.lemma and last.lower == last.lemma.lower() and last.lower.endswith(("en", "ln", "rn")):
                return True
            if last.lower.endswith(("en", "ln", "rn")) and not last.cap:
                return True
    return False


def d_possessive(f: Facts) -> bool:
    return any(POSSESSIVE.match(w.text) and i + 1 < len(f.words) and f.words[i + 1].cap
               for i, w in enumerate(f.words))


def d_und(f: Facts) -> bool:
    return "und" in f.lower


def d_und_order(f: Facts) -> bool:
    for i, w in enumerate(f.words[:-2]):
        if w.lower == "und" and f.words[i + 1].lower in SUBJECT and f.is_verb_form(f.words[i + 2]):
            return True
    return False


def d_vowel_change(f: Facts) -> bool:
    # "es gibt" is a fixed phrase and would tag a large share of the sentences
    return any(w.lower in VOWEL_CHANGE and not (w.lower == "gibt" and i + 1 < len(f.words) and f.words[i + 1].lower == "es")
               and not (w.lower == "gibt" and i > 0 and f.words[i - 1].lower == "es")
               for i, w in enumerate(f.words))


def d_modal_l4(f: Facts) -> bool:
    return any(w.lower in MODAL_L4 for w in f.words)


def d_preterite(f: Facts) -> bool:
    return any(w.lower in PRETERITE for w in f.words)


def _participles(f: Facts):
    """(index, word) of participles that follow an auxiliary in the same sentence."""
    aux_at = [i for i, w in enumerate(f.words) if w.lower in AUX]
    if not aux_at:
        return
    first = aux_at[0]
    for i, w in enumerate(f.words):
        if i > first and not w.cap:
            yield i, w


def d_perfekt_regular(f: Facts) -> bool:
    return any(REGULAR_PARTICIPLE.match(w.lower) and not SEP_PARTICIPLE.match(w.lower) and w.lower not in MIXED_PARTICIPLES
               for _, w in _participles(f))


def d_perfekt_irregular(f: Facts) -> bool:
    return any((STRONG_PARTICIPLE.match(w.lower) and not SEP_PARTICIPLE.match(w.lower)) or w.lower in MIXED_PARTICIPLES
               for _, w in _participles(f))


def d_perfekt_separable(f: Facts) -> bool:
    return any(SEP_PARTICIPLE.match(w.lower) for _, w in _participles(f))


def d_perfekt_inseparable(f: Facts) -> bool:
    # only with "haben": "ist erlaubt" or "ist verboten" are adjectives, not a Perfekt
    if not any(w.lower in ("habe", "hast", "hat", "haben", "habt") for w in f.words):
        return False
    return any(INSEP_PARTICIPLE.match(w.lower) and not SEP_PARTICIPLE.match(w.lower) and w.lemma is not None
               for _, w in _participles(f))


def d_connectors(f: Facts) -> bool:
    t = f.text
    return bool(re.search(r",\s+denn\b", t)) or "oder" in f.lower or "aber" in f.lower


def d_separable_present(f: Facts) -> bool:
    if not f.separable:
        return False
    if any(w.lower in AUX for w in f.words) and any(SEP_PARTICIPLE.match(w.lower) for w in f.words):
        return False
    verb_tok = [w for w in f.words if any(l["s"] == w.start and l["kind"] == "separable" for l in f.separable)]
    if len(verb_tok) < 2:
        return False
    return not any(w.lower in MODAL_ALL for w in f.words)


def d_separable_modal(f: Facts) -> bool:
    if not any(w.lower in MODAL_ALL for w in f.words):
        return False
    return any(SEP_INFINITIVE.match(w.lower) and w.lemma is not None for w in f.words)


def _imperative_clauses(f: Facts):
    for c in f.verb_first_clauses():
        if c.end == "?":
            continue
        yield c


def d_imperative(f: Facts) -> bool:
    for c in _imperative_clauses(f):
        w = c.words[0]
        if c.end != "!" and not (len(c.words) > 1 and c.words[1].text == "Sie"):
            continue
        if w.lower in VOWEL_IMPERATIVE or w.lower in IRREGULAR_IMPERATIVE or w.lower in ("haben",) and c.words[1:2] and c.words[1].text == "Sie":
            continue
        if len(c.words) > 1 and c.words[1].lower == "wir":
            continue
        return True
    return False


def d_imperative_vowel(f: Facts) -> bool:
    return any(c.end == "!" and c.words[0].lower in VOWEL_IMPERATIVE for c in _imperative_clauses(f)) or \
        any(c.words[0].lower in VOWEL_IMPERATIVE for c in _imperative_clauses(f) if len(c.words) > 1)


def d_imperative_haben_sein(f: Facts) -> bool:
    for c in _imperative_clauses(f):
        w = c.words[0]
        if w.lower in IRREGULAR_IMPERATIVE:
            return True
        if w.lower == "haben" and len(c.words) > 1 and c.words[1].text == "Sie":
            return True
    return False


def d_suggest_sollen(f: Facts) -> bool:
    for c in f.clauses:
        if len(c.words) > 1 and ((c.words[0].lower in ("sollen", "wollen") and c.words[1].lower == "wir")
                                 or (c.words[0].lower == "soll" and c.words[1].lower == "ich")):
            return True
    return False


def d_suggest_wir(f: Facts) -> bool:
    for c in f.clauses:
        if len(c.words) > 1 and c.words[1].lower == "wir" and c.end in ("!", ".") \
                and c.words[0].lower not in ("sollen", "wollen") and f._clause_first_is_verb(c):
            return True
    return False


@dataclass(frozen=True)
class Point:
    key: str                          # suffix after "g-NN-LL-" is looked up by prefix, see resolve()
    block: int
    detector: Callable[[Facts], bool]
    scope: str


POINTS: list[Point] = [
    Point("g-01-01-regelmaessige-verben-im-praesens", 1, d_present_regular, "sequence"),
    Point("g-01-01-wortstellung-in-aussagen-w-fragen-und-ja-nein-fragen", 1, d_word_order_questions, "every"),
    Point("g-01-02-verneinung-mit-nicht-und-kein", 1, d_negation, "every"),
    Point("g-01-02-artikel-bestimmt-und-unbestimmt", 1, d_articles, "sequence"),
    Point("g-01-02-wortstellung-subjekt", 1, d_subject_order, "sequence"),
    Point("g-01-02-nominativ-und-akkusativ-mit-bestimmtem-artikel", 1, d_akk_definite, "every"),
    Point("g-01-02-nominativ-und-akkusativ-mit-unbestimmtem-artikel-und-negativ", 1, d_akk_indefinite, "every"),
    Point("g-01-02-personalpronomen-im-nominativ-und-akkusativ", 1, d_pronoun_akk, "every"),
    Point("g-01-03-modalverben-im-praesens-koennen-muessen-moecht", 1, d_modal_l3, "every"),
    Point("g-01-03-modalverben-wortstellung-in-aussagesaetzen-und-w-fragen", 1, d_modal_order, "every"),
    Point("g-01-03-possessivartikel-im-nominativ", 1, d_possessive, "every"),
    Point("g-01-03-verbindung-von-satzteilen-mit-und", 1, d_und, "sequence"),
    Point("g-01-03-wortstellung-in-saetzen-mit-und", 1, d_und_order, "sequence"),
    Point("g-02-04-praesens-verben-mit-vokalwechsel", 2, d_vowel_change, "every"),
    Point("g-02-04-praesens-modalverben-moegen-duerfen-wollen", 2, d_modal_l4, "every"),
    Point("g-02-04-praeteritum-haben-und-sein", 2, d_preterite, "every"),
    Point("g-02-04-perfekt-regelmaessige-verben", 2, d_perfekt_regular, "every"),
    Point("g-02-04-konnektoren-denn-grund-oder-alternative-aber-gegensatz", 2, d_connectors, "every"),
    Point("g-02-05-praesens-verben-mit-trennbaren-vorsilben", 2, d_separable_present, "every"),
    Point("g-02-05-praesens-verben-mit-trennbaren-vorsilben-und-modalverben", 2, d_separable_modal, "every"),
    Point("g-02-05-perfekt-unregelmaessige-verben-und-gemischte-verben", 2, d_perfekt_irregular, "every"),
    Point("g-02-05-perfekt-verben-mit-trennbaren-vorsilben-z-b-an-aus-weg-zurue", 2, d_perfekt_separable, "every"),
    Point("g-02-05-perfekt-verben-mit-untrennbaren-vorsilben-z-b-be-er-ver", 2, d_perfekt_inseparable, "every"),
    Point("g-02-06-imperativsaetze", 2, d_imperative, "every"),
    Point("g-02-06-imperativsaetze-verben-mit-vokalwechsel", 2, d_imperative_vowel, "every"),
    Point("g-02-06-imperativsaetze-haben-und-sein", 2, d_imperative_haben_sein, "every"),
    Point("g-02-06-vorschlaege-mit-sollen-wollen-wir-soll-ich", 2, d_suggest_sollen, "every"),
    Point("g-02-06-vorschlaege-mit-wir", 2, d_suggest_wir, "every"),
]


def detect(text: str, links: list[dict], max_block: int) -> list[str]:
    """Candidate point ids for one sentence, only points taught up to `max_block`."""
    f = Facts(text, links)
    return [p.key for p in POINTS if p.block <= max_block and p.detector(f)]


def scope_of(point_id: str) -> str:
    for p in POINTS:
        if p.key == point_id:
            return p.scope
    return "every"
