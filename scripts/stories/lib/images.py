"""Story illustrations: find the source files, check them, decide the 4:3 crop. Pure; Pillow is used only by the caller.

Source names come from the owner's image tool and are not always clean: the first files arrived as `​S01-Q1.jpg`
with a zero-width space (U+200B) in front. `source_key` therefore ignores invisible format characters, surrounding
spaces and case, and accepts JPG, PNG and WebP.
"""
from __future__ import annotations

import re
import unicodedata

NAME = re.compile(r"^S(\d{2})-Q([1-6])\.(jpe?g|png|webp)$", re.IGNORECASE)
RATIO = 4 / 3
TOLERANCE = 0.03          # a source more than 3 percent away from 4:3 is refused (it would lose too much in the crop)
SIZES = ((1600, 1200, ""), (800, 600, "@800"))


def clean_name(name: str) -> str:
    """NFC, without invisible format characters (Unicode category Cf: zero-width space, LRM, BOM, ...) or outer spaces."""
    n = unicodedata.normalize("NFC", name)
    return "".join(ch for ch in n if unicodedata.category(ch) != "Cf").strip()


def source_key(name: str) -> str | None:
    """'​s01-q1.JPG' -> 'S01-Q1'; None for anything that is not a sequence illustration."""
    m = NAME.match(clean_name(name))
    return f"S{m.group(1)}-Q{m.group(2)}" if m else None


def crop_box(w: int, h: int) -> tuple[int, int, int, int]:
    """Centred 4:3 box (left, top, right, bottom). Raises ValueError when the source is too far from 4:3 or too small."""
    if w < 1600 or h < 1200:
        raise ValueError(f"{w}x{h} is smaller than 1600x1200")
    ratio = w / h
    if abs(ratio / RATIO - 1) > TOLERANCE:
        raise ValueError(f"{w}x{h} is not close to 4:3 (ratio {ratio:.3f})")
    if ratio > RATIO:                      # too wide: trim left and right
        cw, ch = round(h * RATIO), h
    else:                                  # too tall: trim top and bottom
        cw, ch = w, round(w / RATIO)
    left, top = (w - cw) // 2, (h - ch) // 2
    return left, top, left + cw, top + ch
