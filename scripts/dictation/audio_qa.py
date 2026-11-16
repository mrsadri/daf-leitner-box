#!/usr/bin/env python3
"""Technical QA of the generated audio (docs/dictation/05-audio.md) and the list a human listens to.

  python3 scripts/dictation/audio_qa.py 01 [--mode B]

Checks every file of the index with ffprobe/ffmpeg: duration within [0.4 s, 1.5 s + 0.6 s per word], mean volume above
-50 dB, 22.05 kHz mono. Writes build/dictation/audio-qa-NN.md with the failures and the listening sample: 10 percent of
the sentences (seeded, so the same sample every run) plus every long, digit, ellipsis and quote-mixed sentence.
"""
from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import audio  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
PUBLIC = REPO / "public" / "data" / "stories"
AUDIO_DIR = REPO / "build" / "dictation" / "audio"
REPORT_DIR = REPO / "build" / "dictation"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("story")
    ap.add_argument("--mode", default="B")
    args = ap.parse_args(argv)
    no = args.story.zfill(2)
    story = json.loads((PUBLIC / f"story-{no}.json").read_text(encoding="utf-8"))
    index = json.loads((PUBLIC / f"story-{no}.audio.{args.mode}.json").read_text(encoding="utf-8"))["sentences"]
    sentences = {s["id"]: (q["id"], s) for q in story["sequences"] for s in q["sentences"]}
    failures, missing = [], []
    for sid, (seq, s) in sentences.items():
        entry = index.get(sid)
        f = AUDIO_DIR / args.mode / f"{entry['key']}.mp3" if entry else None
        if not entry or not f.exists():
            missing.append(sid)
            continue
        info = audio.probe(f)
        words = len(s["text"].split())
        lo, hi = 400, 1500 + 600 * words
        problems = []
        if not lo <= info["ms"] <= hi:
            problems.append(f"duration {info['ms']} ms outside [{lo}, {hi}]")
        if info["mean_db"] is None or info["mean_db"] < -50:
            problems.append(f"mean volume {info['mean_db']} dB")
        if info["rate"] != audio.OUT_RATE or info["channels"] != 1:
            problems.append(f"format {info['rate']} Hz, {info['channels']} ch")
        if problems:
            failures.append((sid, "; ".join(problems)))

    rng = random.Random(f"qa-{no}-{args.mode}")
    ids = sorted(sentences)
    sample = set(rng.sample(ids, max(1, len(ids) // 10)))
    special = {sid for sid, (_, s) in sentences.items()
               if set(s["flags"]) & {"long", "digits", "ellipsis"} or s.get("segments")}
    listen = sorted(sample | special)
    lines = [f"# Audio QA: story {no}, mode {args.mode}", "",
             f"- sentences: {len(sentences)}, with a file: {len(sentences) - len(missing)}, missing: {len(missing)}",
             f"- technical failures: {len(failures)}", ""]
    if missing:
        lines += ["## Missing files", ""] + [f"- {m}" for m in missing[:50]] + [""]
    if failures:
        lines += ["## Failures", ""] + [f"- {sid}: {why}" for sid, why in failures] + [""]
    lines += [f"## Listening sample ({len(listen)} sentences: 10 percent plus long, digit, ellipsis and mixed-voice sentences)", "",
              "| id | speaker | file | text |", "|---|---|---|---|"]
    for sid in listen:
        seq, s = sentences[sid]
        key = index.get(sid, {}).get("key", "-")
        lines.append(f"| {sid} | {s['speaker']} | {key}.mp3 | {s['text'][:90].replace('|', '/')} |")
    out = REPORT_DIR / f"audio-qa-{no}.md"
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"{out.relative_to(REPO)}: {len(failures)} failures, {len(missing)} missing, listening sample {len(listen)}")
    return 1 if failures or missing else 0


if __name__ == "__main__":
    sys.exit(main())
