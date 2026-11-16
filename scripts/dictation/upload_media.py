#!/usr/bin/env python3
"""Upload story audio (and images) to the Supabase Storage bucket `story-media`.

  python3 scripts/dictation/upload_media.py 01                      DRY RUN (default): lists what would be uploaded
  python3 scripts/dictation/upload_media.py 01 --target <ref> --yes  real upload to https://<ref>.supabase.co

Safety, because the app has real users on its production project:
  * dry run unless BOTH --target and --yes are given; the target project is printed before anything is sent;
  * never overwrites: an object that already exists is skipped (keys are content-addressed, so same key = same bytes);
  * sets cacheControl to one year (immutable files);
  * the service-role key is read from the environment variable SUPABASE_SERVICE_ROLE_KEY only, never from a file;
  * use the DEV project while building; production only when docs/dictation/CHECKLIST-deploy.md says so.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PUBLIC = REPO / "public" / "data" / "stories"
AUDIO_DIR = REPO / "build" / "dictation" / "audio"
IMAGE_DIR = REPO / "build" / "dictation" / "images"
BUCKET = "story-media"
CACHE = "max-age=31536000"


def wanted(no: str, mode: str) -> list[tuple[Path, str, str]]:
    """(local file, object path in the bucket, content type) for everything the story's index references."""
    out: list[tuple[Path, str, str]] = []
    idx = PUBLIC / f"story-{no}.audio.{mode}.json"
    if idx.exists():
        for entry in json.loads(idx.read_text(encoding="utf-8"))["sentences"].values():
            out.append((AUDIO_DIR / mode / f"{entry['key']}.mp3", f"audio/{mode}/{entry['key']}.mp3", "audio/mpeg"))
    if IMAGE_DIR.exists():
        for f in sorted(IMAGE_DIR.glob(f"S{no}-Q*.webp")):
            out.append((f, f"images/{f.name}", "image/webp"))
    return out


def exists(base: str, key: str, path: str) -> bool:
    req = urllib.request.Request(f"{base}/storage/v1/object/public/{BUCKET}/{path}", method="HEAD")
    try:
        urllib.request.urlopen(req, timeout=20)
        return True
    except urllib.error.HTTPError as e:
        if e.code in (400, 404):
            return False
        raise


def upload(base: str, key: str, local: Path, path: str, ctype: str) -> str:
    req = urllib.request.Request(
        f"{base}/storage/v1/object/{BUCKET}/{path}", data=local.read_bytes(), method="POST",
        headers={"Authorization": f"Bearer {key}", "apikey": key, "Content-Type": ctype, "x-upsert": "false", "cache-control": CACHE})
    try:
        urllib.request.urlopen(req, timeout=60)
        return "uploaded"
    except urllib.error.HTTPError as e:
        if e.code in (400, 409) and b"exists" in e.read().lower():
            return "exists"
        raise


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("story")
    ap.add_argument("--mode", default="B")
    ap.add_argument("--target", help="Supabase project ref (the DEV project while developing)")
    ap.add_argument("--yes", action="store_true", help="really upload")
    args = ap.parse_args(argv)
    no = args.story.zfill(2)
    items = wanted(no, args.mode)
    missing = [i for i in items if not i[0].exists()]
    total = sum(i[0].stat().st_size for i in items if i[0].exists())
    print(f"story-{no}: {len(items)} objects referenced, {len(missing)} files missing locally, {total / 1e6:.1f} MB to consider")
    if missing:
        print("missing locally (run gen_audio.py first):", ", ".join(m[1] for m in missing[:5]), "...")
        return 1
    if not (args.target and args.yes):
        print("DRY RUN: nothing uploaded. Add --target <project-ref> --yes to upload (to the DEV project).")
        for _, p, _ in items[:5]:
            print("  would upload", p)
        return 0
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        print("SUPABASE_SERVICE_ROLE_KEY is not set in the environment", file=sys.stderr)
        return 1
    base = f"https://{args.target}.supabase.co"
    print(f"UPLOADING to {base} bucket {BUCKET}")
    counts = {"uploaded": 0, "exists": 0}
    for local, path, ctype in items:
        if exists(base, key, path):
            counts["exists"] += 1
            continue
        counts[upload(base, key, local, path, ctype)] += 1
    print(counts)
    return 0


if __name__ == "__main__":
    sys.exit(main())
