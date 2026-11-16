#!/usr/bin/env python3
"""Convert the owner's story illustrations to WebP and record them for the story build.

  python3 scripts/stories/prepare_images.py              convert from the default scenes folder
  python3 scripts/stories/prepare_images.py --src DIR    another source folder
  python3 scripts/stories/prepare_images.py --check      report only, write nothing

Source: DaF-kompakt-work/DaF-kompakt/output/image-prompts/scenes/SNN-QN.(jpg|png|webp). Names are matched leniently
(invisible characters, case); anything else in the folder (the prompt .md files) is ignored. Originals are not committed.

Output (committed, served by Vercel from the app's own origin, cached for a year by vercel.json):
  public/story-media/images/SNN-QN.<hash>.webp       1600x1200, quality 80
  public/story-media/images/SNN-QN.<hash>@800.webp   800x600, quality 80
  content/stories/images.json                        {key: {w, h, hash, alt: {fa, en}}}; build_stories.py reads it.
                                                     The alt texts are written by hand and kept on every run.
<hash> is the first 10 hex of the source file's sha256, so a replaced picture gets a new URL and the files can be
cached for a year. Metadata (EXIF, generator notes) is not copied. Running it twice changes nothing.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from lib.images import SIZES, crop_box, source_key  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
SRC = REPO / "DaF-kompakt-work" / "DaF-kompakt" / "output" / "image-prompts" / "scenes"
OUT = REPO / "public" / "story-media" / "images"
INDEX = REPO / "content" / "stories" / "images.json"
QUALITY = 80


def find_sources(src: Path) -> tuple[dict[str, Path], list[str]]:
    """key -> file; errors for duplicates (e.g. 'S01-Q1.jpg' and 'S01-Q1.png')."""
    found: dict[str, Path] = {}
    errors: list[str] = []
    for f in sorted(src.iterdir()):
        if not f.is_file():
            continue
        key = source_key(f.name)
        if key is None:
            continue
        if key in found:
            errors.append(f"{key}: two source files ({found[key].name!r} and {f.name!r}); keep one")
            continue
        found[key] = f
    return found, errors


def convert(key: str, src: Path, digest: str) -> None:
    from PIL import Image, ImageOps
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        box = crop_box(*im.size)
        im = im.crop(box)
        OUT.mkdir(parents=True, exist_ok=True)
        for w, h, suffix in SIZES:
            out = OUT / f"{key}.{digest}{suffix}.webp"
            im.resize((w, h), Image.Resampling.LANCZOS).save(out, "WEBP", quality=QUALITY, method=6)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", type=Path, default=SRC)
    ap.add_argument("--check", action="store_true", help="report only")
    args = ap.parse_args(argv)
    if not args.src.is_dir():
        print(f"ERROR: {args.src} is not a folder", file=sys.stderr)
        return 1
    sources, errors = find_sources(args.src)
    index = json.loads(INDEX.read_text(encoding="utf-8")) if INDEX.exists() else {}
    from PIL import Image
    for key, f in sources.items():
        data = f.read_bytes()
        digest = hashlib.sha256(data).hexdigest()[:10]
        try:
            with Image.open(f) as im:
                crop_box(*im.size)
        except ValueError as e:
            errors.append(f"{key} ({f.name!r}): {e}")
            continue
        except Exception as e:
            errors.append(f"{key} ({f.name!r}): not a readable image: {e}")
            continue
        targets = [OUT / f"{key}.{digest}{s}.webp" for _, _, s in SIZES]
        current = index.get(key, {}).get("hash") == digest and all(t.exists() for t in targets)
        note = "" if f.name == f"{key}{f.suffix.lower()}" else f"  (source name {f.name!r})"
        print(f"{key}: {'unchanged' if current else 'convert'}{note}")
        if args.check or current:
            continue
        convert(key, f, digest)
        # files of an older version of the same picture
        for old in OUT.glob(f"{key}.*.webp"):
            if not old.name.startswith(f"{key}.{digest}"):
                old.unlink()
        index[key] = {**index.get(key, {}), "hash": digest, "w": SIZES[0][0], "h": SIZES[0][1]}
    if not args.check:
        INDEX.write_text(json.dumps(dict(sorted(index.items())), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    missing = sorted({f"S{s}-Q{q}" for s in {k[1:3] for k in index} | {"01", "02"} for q in range(1, 7)} - set(index))
    print(f"{len(index)} illustrations recorded; without an image (placeholder shown): {', '.join(missing) or 'none'}")
    for e in errors:
        print("ERROR", e, file=sys.stderr)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
