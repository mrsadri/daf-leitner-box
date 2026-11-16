"""Text normalization for story sentences (build time only, standard library)."""
from __future__ import annotations

import re
import unicodedata

# Glyphs that may appear in story text besides letters and digits.
ALLOWED_PUNCT = set(" .,!?:;…„“”‚‘’«»-()–")
SPACE_LIKE = {" ": " ", " ": " ", " ": " ", "​": ""}


def strip_bold(text: str) -> str:
    """Remove the Markdown bold markers that mark target vocabulary."""
    return text.replace("**", "")


def bold_spans(text: str) -> list[str]:
    """Return the text of every bold span (target words), in order."""
    return re.findall(r"\*\*(.+?)\*\*", text)


def normalize_text(text: str) -> str:
    """NFC, unify spaces, `...` to the ellipsis character, collapse whitespace."""
    text = unicodedata.normalize("NFC", text)
    for src, dst in SPACE_LIKE.items():
        text = text.replace(src, dst)
    text = text.replace("...", "…")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def odd_glyphs(text: str) -> list[str]:
    """Characters that are neither letters, digits, nor the expected punctuation."""
    found: list[str] = []
    for ch in text:
        if ch.isalnum() or ch in ALLOWED_PUNCT:
            continue
        if ch not in found:
            found.append(ch)
    return found
