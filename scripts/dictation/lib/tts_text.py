"""Spoken text for TTS (04-content-pipeline.md, "TTS text preparation").

The answer text stays exact; only the audio script changes. `speech()` returns the rewritten
text (or None when nothing changes) and a list of review notes for ambiguous cases.
`overrides.speech` in the story overrides file always wins over this module.
"""
from __future__ import annotations

import re

UNITS = ["null", "ein", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf",
         "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn"]
TENS = {2: "zwanzig", 3: "dreißig", 4: "vierzig", 5: "fünfzig", 6: "sechzig", 7: "siebzig", 8: "achtzig", 9: "neunzig"}
MONTHS = ("Januar|Jänner|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember")
ABBREVIATIONS = {
    "Tel.": "Telefon", "Nr.": "Nummer", "z. B.": "zum Beispiel", "d. h.": "das heißt", "usw.": "und so weiter",
    "bzw.": "beziehungsweise", "ca.": "circa", "Str.": "Straße", "u. a.": "unter anderem", "Std.": "Stunden",
    "Min.": "Minuten", "ggf.": "gegebenenfalls", "evtl.": "eventuell",
}


def cardinal(n: int, *, eins: bool = False) -> str:
    """German cardinal number as one word (up to 999999). `eins` gives 'eins' instead of 'ein' for 1."""
    if n < 0:
        return "minus " + cardinal(-n)
    if n < 20:
        return "eins" if (n == 1 and eins) else UNITS[n]
    if n < 100:
        t, u = divmod(n, 10)
        return TENS[t] if u == 0 else f"{UNITS[u]}und{TENS[t]}"
    if n < 1000:
        h, r = divmod(n, 100)
        return f"{UNITS[h]}hundert" + (cardinal(r) if r else "")
    th, r = divmod(n, 1000)
    head = "eintausend" if th == 1 else f"{cardinal(th)}tausend"
    return head + (cardinal(r) if r else "")


def ordinal_stem(n: int) -> str:
    special = {1: "erst", 3: "dritt", 7: "siebt", 8: "acht"}
    if n in special:
        return special[n]
    if n < 20:
        return cardinal(n) + "t"
    # 21 -> einundzwanzigst, 31 -> einunddreißigst
    return cardinal(n) + "st"


_DATIVE_BEFORE = re.compile(r"\b(?:am|vom|zum|im|dem|bis zum|seit dem|ab dem|vor dem|nach dem|von dem)\s*$", re.I)
_ACCUSATIVE_BEFORE = re.compile(r"\b(?:den|bis zum)\s*$", re.I)
_NOM_BEFORE = re.compile(r"\b(?:der|die|das)\s*$", re.I)


def _ordinal_ending(before: str) -> str:
    if _DATIVE_BEFORE.search(before) or _ACCUSATIVE_BEFORE.search(before):
        return "en"
    if _NOM_BEFORE.search(before):
        return "e"
    return "er"          # "Montag, 19. Oktober": nominative without article


def _phone(match: re.Match) -> str:
    groups = match.group(0).split()
    first = " ".join(cardinal(int(d)) for d in groups[0])
    rest = []
    for g in groups[1:]:
        rest.append(cardinal(int(g)) if len(g) <= 2 and not g.startswith("0") else " ".join(cardinal(int(d)) for d in g))
    return ", ".join([first] + rest)


def speech(text: str) -> tuple[str | None, list[str]]:
    notes: list[str] = []
    out = text
    for abbr, full in ABBREVIATIONS.items():
        out = out.replace(abbr, full)

    # phone numbers: a leading-zero group followed by 1 to 3 groups of 2 to 3 digits
    def phone(m: re.Match) -> str:
        notes.append(f"phone number read in groups: {m.group(0)}")
        return _phone(m)
    out = re.sub(r"\b0\d{2,4}(?: \d{2,3}){1,4}\b", phone, out)

    # times: 9:00 Uhr, 14:30 Uhr; without 'Uhr' it is ambiguous (clock or race time)
    def time(m: re.Match) -> str:
        h, mi = int(m.group(1)), int(m.group(2))
        spoken = cardinal(h) + " Uhr" + (" " + cardinal(mi) if mi else "")
        if m.group(3):
            return spoken
        notes.append(f"time without 'Uhr' read as clock time, decide in overrides.speech: {m.group(0)}")
        return spoken
    out = re.sub(r"(?<![\d:])(\d{1,2}):(\d{2})(?![\d:])(\s+Uhr\b)?", time, out)
    if re.search(r"\d:\d{2}:\d{2}", out):
        notes.append("race time left as digits, decide in overrides.speech")

    # prices with decimals: 1,89 Euro -> ein Euro neunundachtzig; plain decimals -> Komma
    def price(m: re.Match) -> str:
        e, c = int(m.group(1)), m.group(2)
        cents = int(c.ljust(2, "0"))
        return f"{cardinal(e)} Euro" + (f" {cardinal(cents)}" if cents else "")
    out = re.sub(r"\b(\d+),(\d{1,2})\s+Euro\b", price, out)
    out = re.sub(r"\b(\d+),(\d+)\b", lambda m: f"{cardinal(int(m.group(1)))} Komma " + " ".join(cardinal(int(d)) for d in m.group(2)), out)

    # ordinals: digits + '.' before a month name or a lowercase word
    def ordinal(m: re.Match) -> str:
        n = int(m.group(1))
        end = _ordinal_ending(out_before(m))
        return ordinal_stem(n) + end + m.group(2)

    def out_before(m: re.Match) -> str:
        return m.string[:m.start()]
    out = re.sub(rf"\b(\d{{1,2}})\.(\s+(?:{MONTHS})\b)", ordinal, out)

    # thousands separator
    out = re.sub(r"\b(\d{1,3})\.(\d{3})\b", lambda m: cardinal(int(m.group(1) + m.group(2))), out)

    # remaining integers
    def integer(m: re.Match) -> str:
        s = m.group(0)
        n = int(s)
        if 1100 <= n <= 2099 and len(s) == 4:
            notes.append(f"4-digit number read as a year: {s}")
            hi, lo = divmod(n, 100)
            return cardinal(hi) + "hundert" + (cardinal(lo) if lo else "")
        if len(s) >= 4 and not 1000 <= n <= 99999:
            notes.append(f"long number read as a cardinal: {s}")
        elif len(s) == 4:
            notes.append(f"4-digit number read as a cardinal (postal code?): {s}")
        return cardinal(n)
    out = re.sub(r"(?<![\w,.:])\d+(?![\w:])", integer, out)

    # ordinal-looking leftover "26." before a lowercase word stays digits + note
    if out == text:
        return None, notes
    return out, notes
