"""Noun gender underlines (docs/refactor/03-plan-checklist.md, "gender underlines"). Pure.

For a story token linked to a noun card, decide what to underline:
  "m" / "f" / "n"  the token is a singular form of a der / die / das noun
  "pl"             the token is a plural form
  None             not a noun, the article is unusual (der/das, –), or singular and plural are spelled the same and
                   the word just before doesn't settle it

Deliberately conservative: a wrong colour teaches the wrong gender, a missing one teaches nothing.
"""
from __future__ import annotations

import re

GENDER = {"der": "m", "die": "f", "das": "n"}

# Words right before a noun that settle singular or plural when both are spelled the same
PLURAL_BEFORE = {
    "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf", "zwanzig", "hundert",
    "viele", "vielen", "alle", "allen", "einige", "einigen", "mehrere", "mehreren", "wenige", "wenigen", "beide",
    "beiden", "keine", "meine", "deine", "seine", "ihre", "unsere", "eure", "diese", "welche", "manche",
}
SINGULAR_BEFORE = {"ein", "einen", "einem", "eines", "der", "das", "dem", "des", "dieser", "dieses", "diesem", "jeder", "jedes", "jedem", "jeden"}


def split_variants(s: str) -> list[str]:
    return [v.strip() for v in re.split(r"[/,·;]| oder ", s or "") if v.strip()]


def strip_article(s: str) -> str:
    return re.sub(r"^(der|die|das)\s+", "", s.strip())


def noun_forms(wort: str, plural: str) -> tuple[set[str], set[str]]:
    """(singular forms, plural forms), lower case. Singular includes the -s/-es/-n case forms the linker accepts."""
    sing: set[str] = set()
    for v in split_variants(wort):
        v = strip_article(v)
        if v and " " not in v:
            sing |= {v.lower(), (v + "s").lower(), (v + "es").lower()}
            if v.endswith(("e", "er", "el", "en")):
                sing.add((v + "n").lower())
    plur: set[str] = set()
    for p in split_variants(plural):
        p = strip_article(p)
        if p and " " not in p and p != "–" and p[0].isupper():
            plur |= {p.lower()}
            if not p.endswith(("n", "s")):
                plur.add((p + "n").lower())     # dative plural: den Kindern
    return sing, plur


def noun_gender(token: str, artikel: str, wort: str, plural: str, previous: str | None) -> str | None:
    if (artikel or "").strip() not in GENDER:
        return None
    matching = [v for v in split_variants(wort) if token.lower() in noun_forms(v, "")[0]]
    variant_article = re.match(r"^(der|die|das)\s+", matching[0]) if len(matching) == 1 else None
    g = GENDER.get(variant_article.group(1) if variant_article else (artikel or "").strip())
    if g is None:
        return None
    t = token.lower()
    sing, plur = noun_forms(wort, plural)
    in_s, in_p = t in sing, t in plur
    if in_p and not in_s:
        return "pl"
    if in_s and not in_p:
        return g
    if in_s and in_p:
        prev = (previous or "").lower()
        if prev in PLURAL_BEFORE or (prev == "die" and g != "f") or (prev == "den" and t.endswith("n") and g == "n"):
            return "pl"
        if prev in SINGULAR_BEFORE or (prev == "die" and g == "f"):
            return g
        return None
    return None
