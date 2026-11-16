#!/usr/bin/env python3
"""Propose the Mode B casting: one Piper voice per character, written to content/dictation/voices.json.

  python3 scripts/dictation/cast_voices.py [--rescan]

The MLS German model (CC-BY 4.0, 236 speakers) is scanned once with a fixed sentence: median pitch (F0) tells men from
women and higher from lower voices, and speakers with a very slow, very fast or very quiet delivery are skipped. Each
character then gets the unused speaker closest to a target pitch for their profile (docs/dictation/05-audio.md). The
narrator is the CC0 voice `thorsten`. Children are the highest suitable speaker shifted up with ffmpeg.

This is a PROPOSAL made without listening: run `gen_audio.py --audition` (or listen to the first sentences) and change
single entries in voices.json by hand. Any entry changed there regenerates exactly that character's files.
Licences: thorsten, kerstin: CC0. MLS: CC-BY 4.0 (OpenSLR 94): the app must name the source (Settings > About).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

REPO = Path(__file__).resolve().parents[2]
CONTENT = REPO / "content" / "dictation"
SCAN = REPO / "build" / "dictation" / "mls-scan.json"
SENTENCE = "Guten Morgen, ich heiße Nilufar und komme aus Shiraz."
MLS = "de_DE-mls-medium"

# character -> (target F0 in Hz, pitch shift in semitones, tempo, length_scale); None F0 = special handling below
TARGETS = {
    "NILI": (200, 0, 1.0, 1.0), "LUCIA": (230, 0, 1.03, 1.0), "LECHNER": (165, 0, 0.97, 1.0), "WAGNER": (185, 0, 1.0, 1.0),
    "EMILY": (210, 0, 1.0, 1.0), "MEI": (220, 0, 1.0, 1.0), "AYSE": (195, 0, 1.0, 1.0), "CLAUDIA": (180, 0, 1.0, 1.0),
    "HERMINE": (170, 0, 0.92, 1.0), "PICHLER": (165, 0, 0.94, 1.0), "SABINE": (215, 0, 1.02, 1.0),
    "GUEST_F1": (190, 0, 1.0, 1.0), "GUEST_F2": (205, 0, 1.0, 1.0),
    "JONAS": (115, 0, 0.98, 1.0), "KENJI": (125, 0, 1.0, 1.0), "PIERRE": (135, 0, 1.0, 1.0), "KEMAL": (108, 0, 1.0, 1.0),
    "MARTIN": (105, 0, 0.98, 1.0), "EBNER": (98, 0, 0.96, 1.0), "FELIX": (130, 0, 1.02, 1.0),
    "GUEST_M1": (118, 0, 1.0, 1.0), "GUEST_M2": (128, 0, 1.0, 1.0),
}
CHILDREN = {"LENA": ("f", 2.0, 1.03), "PAUL": ("m", 4.0, 1.03)}     # sex, semitones up, tempo
# the model's own recommended noise profile, a little shorter pauses and a little faster delivery than the audiobook pace
MLS_DEFAULTS = {"noise_scale": 0.333, "noise_w": 0.333, "length_scale": 0.85, "tempo": 1.1}
FIXED = {"NARRATOR": {"model": "de_DE-thorsten-medium", "length_scale": 1.05},
         "NOVAK": {"model": "de_DE-kerstin-medium", "length_scale": 0.98}}


def scan() -> dict:
    if SCAN.exists():
        return json.loads(SCAN.read_text(encoding="utf-8"))
    import numpy as np
    from lib.piper_tts import PiperEngine, VoiceSettings
    engine = PiperEngine()
    cfg = json.loads((engine.models_dir / f"{MLS}.onnx.json").read_text(encoding="utf-8"))

    def f0(x, sr):
        fr, hop = int(0.04 * sr), int(0.02 * sr)
        vals = []
        for i in range(0, len(x) - fr, hop):
            w = x[i:i + fr]
            if np.sqrt(np.mean(w ** 2)) < 0.02:
                continue
            w = w - w.mean()
            ac = np.correlate(w, w, "full")[fr - 1:]
            lo, hi = int(sr / 400), int(sr / 70)
            k = int(np.argmax(ac[lo:hi])) + lo
            if ac[k] / ac[0] > 0.4:
                vals.append(sr / k)
        return float(np.median(vals)) if vals else 0.0

    out = {}
    for name, sid in cfg["speaker_id_map"].items():
        smp, sr = engine.synthesize(VoiceSettings(MLS, speaker=sid), SENTENCE)
        out[name] = {"sid": sid, "f0": round(f0(smp, sr)), "dur": round(len(smp) / sr, 2), "rms": round(float(np.sqrt(np.mean(smp ** 2))), 3)}
    SCAN.parent.mkdir(parents=True, exist_ok=True)
    SCAN.write_text(json.dumps(out), encoding="utf-8")
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--rescan", action="store_true")
    args = ap.parse_args(argv)
    if args.rescan and SCAN.exists():
        SCAN.unlink()
    data = scan()
    # MLS comes from audiobooks: many speakers pause for a long time. Only the quick ones are usable for dictation.
    ok = {k: v for k, v in data.items() if v["dur"] <= 3.6 and v["rms"] >= 0.02 and v["f0"] > 0}
    male = {k: v for k, v in ok.items() if v["f0"] < 150}
    female = {k: v for k, v in ok.items() if v["f0"] >= 160}
    used: set[str] = set()
    cast = json.loads((CONTENT / "cast.json").read_text(encoding="utf-8"))["characters"]
    voices: dict[str, dict] = {}

    def pick(pool: dict, target: float) -> str:
        name = min((k for k in pool if k not in used), key=lambda k: abs(pool[k]["f0"] - target))
        used.add(name)
        return name

    for c in cast:
        cid = c["id"]
        if cid in FIXED:
            voices[cid] = dict(FIXED[cid])
        elif cid in CHILDREN:
            sex, st, tempo = CHILDREN[cid]
            pool = female if sex == "f" else male
            name = pick(pool, 999)                           # the highest suitable speaker
            voices[cid] = {"model": MLS, "speaker": pool[name]["sid"], **MLS_DEFAULTS, "pitch_semitones": st, "tempo": round(tempo * MLS_DEFAULTS["tempo"], 3)}
        elif cid in TARGETS:
            f0t, st, tempo, ls = TARGETS[cid]
            pool = female if c["sex"] == "f" else male
            name = pick(pool, f0t)
            voices[cid] = {"model": MLS, "speaker": pool[name]["sid"], **MLS_DEFAULTS, "length_scale": round(ls * MLS_DEFAULTS["length_scale"], 3),
                           "tempo": round(tempo * MLS_DEFAULTS["tempo"], 3)}
        else:
            raise SystemExit(f"no casting rule for {cid}: add it to TARGETS in cast_voices.py")
    out = {
        "_comment": "Mode B (Piper) casting, proposed by cast_voices.py WITHOUT listening. Edit single entries by hand; a changed entry regenerates only that character's audio. Mode C voices are computed on the device (src/services/dictation/voiceMap.ts). Mode A (paid TTS) is not used.",
        "_licences": "thorsten and kerstin: CC0. MLS (OpenSLR 94): CC-BY 4.0, credit required in the app.",
        "B": voices,
        "C": {},
    }
    (CONTENT / "voices.json").write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote content/dictation/voices.json: {len(voices)} characters, {len(used)} MLS speakers used")
    for cid, v in voices.items():
        print(f"  {cid:9} {v['model'].replace('de_DE-', ''):18} speaker={v.get('speaker', '-')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
