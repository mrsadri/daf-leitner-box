"""The cedilla fix for Piper (docs/dictation/05-audio.md, "Cedilla bug").

espeak-ng, as bundled in Piper, can emit the ich-sound as `c` followed by the combining cedilla U+0327 instead of the
precomposed `ç` U+00E7. Piper then looks the two symbols up separately and silently drops what the model does not
know, which removes or distorts the fricative. The fix, applied before ids are looked up:

  1. join the phonemes of a sentence and run NFC on them (composes `c` + U+0327 into `ç`);
  2. check EVERY resulting symbol against the model's `phoneme_id_map`; a missing symbol is an error naming the
     sentence and the code point, never a silent skip;
  3. assert that no U+0327 remains.

Pure Python, no Piper import, so it is unit-tested in CI.
"""
from __future__ import annotations

import unicodedata
from typing import Iterable, Mapping

COMBINING_CEDILLA = "̧"


class PhonemeError(Exception):
    """A phoneme the model does not know (would be dropped silently by Piper)."""


def fix_phonemes(sentences: Iterable[Iterable[str]], phoneme_id_map: Mapping[str, object], where: str = "") -> list[list[str]]:
    """NFC-normalize each sentence's phonemes and verify them against the model. Returns lists of single symbols."""
    fixed: list[list[str]] = []
    for sentence in sentences:
        joined = unicodedata.normalize("NFC", "".join(sentence))
        symbols = list(joined)
        for sym in symbols:
            if COMBINING_CEDILLA in sym:
                raise PhonemeError(f"{where}: U+0327 remained after NFC in {joined!r}")
            if sym not in phoneme_id_map:
                raise PhonemeError(f"{where}: phoneme {sym!r} (U+{ord(sym):04X}) is not in the model's phoneme_id_map")
        fixed.append(symbols)
    return fixed
