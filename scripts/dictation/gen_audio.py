#!/usr/bin/env python3
"""Generate the audio files of a story with Piper (Mode B) and write the audio index.

  python3 scripts/dictation/gen_audio.py 01 --dry-run          what would be generated, no model needed
  python3 scripts/dictation/gen_audio.py 01                    generate missing files (incremental)
  python3 scripts/dictation/gen_audio.py 01 --sentence s01q1n0013 --force
  python3 scripts/dictation/gen_audio.py --test-sample                the sample of the Settings "Test" button (test.mp3)

Runs on the owner's machine, never in CI. Needs `pip install piper-tts numpy` in a virtual environment, ffmpeg, and
`brew install espeak-ng` (see lib/piper_tts.py). No key, no network call: Piper is local.

Files: build/dictation/audio/B/<key>.mp3 (not committed), key = first 16 hex of sha256(voice settings | speech text).
Index: public/data/stories/story-NN.audio.B.json maps sentence id to {key, ms, bytes, textHash} (committed).
Changing the text or one character's voice changes only the affected keys, so only those files are generated again.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from lib import tts_text  # noqa: E402
from lib.piper_tts import VoiceSettings  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
CONTENT = REPO / "content" / "dictation"
PUBLIC = REPO / "public" / "data" / "stories"
AUDIO_DIR = REPO / "build" / "dictation" / "audio"
QUOTES = re.compile(r"[„“”‚‘«»\"]")


def spoken(text: str, speech: str | None) -> str:
    """The text handed to the synthesizer: the reviewed `speech` override or the rule-based rewrite, without quote glyphs."""
    s = speech or tts_text.speech(text)[0] or text
    s = QUOTES.sub("", s)
    return re.sub(r"\s+", " ", s).strip()


def parts_of(sentence: dict) -> list[dict]:
    if sentence.get("segments"):
        return [{"text": spoken(g["text"], g.get("speech")), "speaker": g["speaker"]} for g in sentence["segments"]]
    return [{"text": spoken(sentence["text"], sentence.get("speech")), "speaker": sentence["speaker"]}]


def voice_for(voices: dict, mode: str, speaker: str) -> VoiceSettings:
    entry = voices.get(mode, {}).get(speaker)
    if entry is None:
        raise SystemExit(f"voices.json has no entry for {speaker} in mode {mode}")
    return VoiceSettings(**entry)


def file_key(parts: list[dict], voices: dict, mode: str) -> str:
    raw = "||".join(voice_for(voices, mode, p["speaker"]).key_part() + "|" + p["text"] for p in parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def plan(story: dict, voices: dict, mode: str, only: str | None) -> list[dict]:
    out = []
    for q in story["sequences"]:
        for s in q["sentences"]:
            if only and s["id"] != only:
                continue
            parts = parts_of(s)
            out.append({"id": s["id"], "parts": parts, "key": file_key(parts, voices, mode),
                        "textHash": s["hash"], "chars": sum(len(p["text"]) for p in parts)})
    return out


# The multi-speaker MLS model sometimes renders very short lines ("Ja.", "Ich!") as near silence (raw peak below 0.01).
# A synthesis counts as audible from this raw peak and length; otherwise other noise and length settings are tried.
MIN_PEAK = 0.03
MIN_SECONDS = 0.3
RETRIES = ((0.667, 0.8, 1.0), (0.667, 0.8, 1.5), (0.5, 0.5, 1.2), (0.667, 0.8, 0.85), (0.8, 1.0, 1.3))


def synthesize_audible(engine, settings: VoiceSettings, text: str, where: str):
    """Returns (samples, rate, note). Raises RuntimeError when no attempt is audible; silence is never published."""
    import dataclasses
    import numpy as np

    def ok(smp, rate) -> bool:
        a = np.asarray(smp)
        return len(a) / rate >= MIN_SECONDS and float(np.abs(a).max()) >= MIN_PEAK

    smp, rate = engine.synthesize(settings, text, where=where)
    if ok(smp, rate):
        return smp, rate, ""
    best = (float(np.abs(np.asarray(smp)).max()), smp, rate, "")
    for ns, nw, ls in RETRIES:
        alt = dataclasses.replace(settings, noise_scale=ns, noise_w=nw, length_scale=ls)
        smp2, rate2 = engine.synthesize(alt, text, where=where)
        if ok(smp2, rate2):
            return smp2, rate2, f"retried with noise {ns}/{nw}, length {ls}"
        pk = float(np.abs(np.asarray(smp2)).max())
        if pk > best[0]:
            best = (pk, smp2, rate2, "")
    raise RuntimeError(f"no audible synthesis for {text!r} (best raw peak {best[0]:.3f}); add a speech override or use another voice")


# The Settings "Test" button plays this file (src/components/dictation/AudioModeSettings.tsx); same text as there
TEST_SAMPLE_TEXT = "Guten Tag! Wie geht es Ihnen?"
TEST_SAMPLE_FILE = "test.mp3"


def write_test_sample(mode: str) -> int:
    from lib import audio
    from lib.piper_tts import PiperEngine
    voices = json.loads((CONTENT / "voices.json").read_text(encoding="utf-8"))
    settings = voice_for(voices, mode, "NARRATOR")
    engine = PiperEngine()
    out = AUDIO_DIR / mode / TEST_SAMPLE_FILE
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        samples, rate, _ = synthesize_audible(engine, settings, TEST_SAMPLE_TEXT, "test")
        wav = Path(tmp) / "test.wav"
        audio.write_wav(wav, samples, rate)
        audio.encode([wav], rate, [settings.pitch_semitones], [settings.tempo], out)
    print(f"wrote {out.relative_to(REPO)} ({audio.probe(out)['ms']} ms)")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("story", nargs="?")
    ap.add_argument("--test-sample", action="store_true", help=f"write {TEST_SAMPLE_FILE} (narrator voice) and exit")
    ap.add_argument("--mode", default="B", choices=["B"], help="only B (Piper) is implemented; A is a paid provider adapter for later")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--sentence", help="only this sentence id")
    ap.add_argument("--force", action="store_true", help="generate again even if the file exists")
    ap.add_argument("--limit", type=int, default=0, help="stop after this many files (for trials)")
    args = ap.parse_args(argv)
    if args.test_sample:
        return write_test_sample(args.mode)
    if not args.story:
        ap.error("story number required (or --test-sample)")
    no = args.story.zfill(2)
    story = json.loads((PUBLIC / f"story-{no}.json").read_text(encoding="utf-8"))
    voices = json.loads((CONTENT / "voices.json").read_text(encoding="utf-8"))
    out_dir = AUDIO_DIR / args.mode
    out_dir.mkdir(parents=True, exist_ok=True)
    index_path = PUBLIC / f"story-{no}.audio.{args.mode}.json"
    index = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else {"version": 1, "mode": args.mode, "sentences": {}}

    items = plan(story, voices, args.mode, args.sentence)
    todo = [i for i in items if args.force or not (out_dir / f"{i['key']}.mp3").exists()]
    chars = sum(i["chars"] for i in todo)
    print(f"story-{no}: {len(items)} sentences, {len(todo)} to generate ({chars} characters), {len(items) - len(todo)} already there")
    if args.dry_run:
        return 0

    from lib import audio
    from lib.phoneme_fix import PhonemeError
    from lib.piper_tts import PiperEngine
    engine = PiperEngine()
    t0 = time.time()
    failures = []
    done = 0
    with tempfile.TemporaryDirectory() as tmp:
        for item in todo:
            if args.limit and done >= args.limit:
                break
            try:
                wavs, semis, tempos = [], [], []
                rate = 22050
                for n, part in enumerate(item["parts"]):
                    settings = voice_for(voices, args.mode, part["speaker"])
                    samples, rate, note = synthesize_audible(engine, settings, part["text"], item["id"])
                    if note:
                        print(f"  {item['id']} ({part['speaker']}): {note}")
                    wav = Path(tmp) / f"{item['key']}_{n}.wav"
                    audio.write_wav(wav, samples, rate)
                    wavs.append(wav); semis.append(settings.pitch_semitones); tempos.append(settings.tempo)
                audio.encode(wavs, rate, semis, tempos, out_dir / f"{item['key']}.mp3")
                done += 1
                if done % 25 == 0:
                    print(f"  {done}/{len(todo)}  ({time.time() - t0:.0f}s)")
            except PhonemeError as e:
                failures.append(f"{item['id']}: {e}")
            except Exception as e:   # one bad sentence must not stop the run; it is listed at the end
                failures.append(f"{item['id']}: {type(e).__name__}: {e}")
    # (re)write the index entries for every planned sentence whose file exists
    from lib import audio as audio_lib
    for item in items:
        f = out_dir / f"{item['key']}.mp3"
        if f.exists():
            info = audio_lib.probe(f)
            index["sentences"][item["id"]] = {"key": item["key"], "ms": info["ms"], "bytes": info["bytes"], "textHash": item["textHash"]}
    # drop index entries of ids that no longer exist in the story
    valid = {s["id"] for q in story["sequences"] for s in q["sentences"]}
    index["sentences"] = {k: v for k, v in sorted(index["sentences"].items()) if k in valid}
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    print(f"generated {done} files in {time.time() - t0:.0f}s; index has {len(index['sentences'])}/{len(valid)} sentences")
    for f in failures:
        print("FAILED", f, file=sys.stderr)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
