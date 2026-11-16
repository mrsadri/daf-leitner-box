#!/usr/bin/env python3
"""Create the skeleton of the grammar cards for a block from the LOCAL grammar files.

  python3 scripts/dictation/grammar_skeleton.py 01          # prints the ids and titles
  python3 scripts/dictation/grammar_skeleton.py 01 --write  # creates content/dictation/grammar/block-01.json if absent

Only structure is read from `DaF-kompakt-work/DaF-kompakt/Grammatik/` (lesson number, level, point title, order). The
files themselves are textbook-derived and gitignored; nothing from their body is copied. The text of every card
(`rule`, `table`) is written by hand in the owner's own words and committed in `block-NN.json`.
Existing cards are never overwritten; new points are appended so ids stay fixed.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
GRAMMAR_DIR = REPO / "DaF-kompakt-work" / "DaF-kompakt" / "Grammatik"
OUT = REPO / "content" / "dictation" / "grammar"
LESSON_RE = re.compile(r"^##\s+Lektion\s+(\d+)\s+·\s+(.+?)\s+\((A1|A2|B1)\)\s*$")
POINT_RE = re.compile(r"^###\s+(.+?)\s*$")


def slug(title: str) -> str:
    t = title.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    t = unicodedata.normalize("NFKD", t)
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = re.sub(r"[^a-z0-9]+", "-", t).strip("-")
    return t[:60].strip("-")


def source_file(block: int) -> Path:
    first = (block - 1) * 3 + 1
    return GRAMMAR_DIR / f"L{first:02d}-{first + 2:02d}_Grammatik.md"


def read_points(block: int) -> list[dict]:
    path = source_file(block)
    if not path.exists():
        raise SystemExit(f"{path} not found (the local grammar files are not part of the repository)")
    points, lesson, level = [], None, None
    for line in path.read_text(encoding="utf-8").splitlines():
        m = LESSON_RE.match(line)
        if m:
            lesson, level = int(m.group(1)), m.group(3)
            continue
        m = POINT_RE.match(line)
        if m and lesson is not None:
            title = m.group(1).rstrip(":").strip()
            points.append({"id": f"g-{block:02d}-{lesson:02d}-{slug(title)}", "block": block, "lesson": lesson,
                           "level": level, "title": title})
    return points


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("block")
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()
    block = int(args.block)
    points = read_points(block)
    path = OUT / f"block-{block:02d}.json"
    existing = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"block": block, "cards": []}
    known = {c["id"] for c in existing["cards"]}
    for p in points:
        print(("= " if p["id"] in known else "+ ") + f"{p['id']}  [{p['level']}] {p['title']}")
    if args.write:
        for p in points:
            if p["id"] not in known:
                existing["cards"].append({**p, "rule": "", "examples": []})
        OUT.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(existing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"wrote {path.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
