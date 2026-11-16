"""Audio post-processing with ffmpeg (docs/dictation/05-audio.md, "Generation scripts").

Per segment: pitch shift and tempo (asetrate plus atempo; this ffmpeg build has no rubberband), then segments are
joined with an 80 ms crossfade, silence is trimmed, loudness is normalized (EBU R128, -16 LUFS, true peak -1.5 dB),
80 ms lead and 250 ms tail padding are added, and the result is encoded as MP3, mono, 64 kbps.
"""
from __future__ import annotations

import json
import subprocess
import wave
from pathlib import Path

LEAD_MS = 80
TAIL_MS = 250
CROSSFADE_S = 0.08
OUT_RATE = 22050
BITRATE = "64k"


def write_wav(path: Path, samples, rate: int) -> None:
    import numpy as np
    pcm = (np.clip(samples, -1.0, 1.0) * 32767.0).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm.tobytes())


def segment_filter(rate: int, semitones: float, tempo: float) -> str:
    """asetrate shifts pitch AND speed; atempo gives the speed back (times the wanted tempo)."""
    if semitones == 0 and tempo == 1.0:
        return "anull"
    factor = 2 ** (semitones / 12.0)
    parts = []
    if semitones != 0:
        parts += [f"asetrate={round(rate * factor)}", f"aresample={rate}"]
    t = tempo / factor
    while t > 2.0:
        parts.append("atempo=2.0"); t /= 2.0
    while t < 0.5:
        parts.append("atempo=0.5"); t /= 0.5
    if abs(t - 1.0) > 1e-6:
        parts.append(f"atempo={t:.5f}")
    return ",".join(parts) or "anull"


def build_filtergraph(n: int, rate: int, semitones: list[float], tempos: list[float]) -> str:
    chains = [f"[{i}:a]{segment_filter(rate, semitones[i], tempos[i])}[s{i}]" for i in range(n)]
    last = "s0"
    for i in range(1, n):
        chains.append(f"[{last}][s{i}]acrossfade=d={CROSSFADE_S}:c1=tri:c2=tri[x{i}]")
        last = f"x{i}"
    # trim only the leading and trailing silence (stop_periods would cut everything after the first pause)
    trim = "silenceremove=start_periods=1:start_threshold=-45dB"
    tail = (f"[{last}]{trim},areverse,{trim},areverse,"
            f"loudnorm=I=-16:TP=-1.5:LRA=11,"
            f"adelay={LEAD_MS}|{LEAD_MS},apad=pad_dur={TAIL_MS / 1000}[out]")
    return ";".join(chains + [tail])


def encode(wavs: list[Path], rate: int, semitones: list[float], tempos: list[float], out_mp3: Path) -> None:
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"]
    for w in wavs:
        cmd += ["-i", str(w)]
    cmd += ["-filter_complex", build_filtergraph(len(wavs), rate, semitones, tempos), "-map", "[out]",
            "-ac", "1", "-ar", str(OUT_RATE), "-c:a", "libmp3lame", "-b:a", BITRATE, str(out_mp3)]
    subprocess.run(cmd, check=True)


def probe(path: Path) -> dict:
    """Duration in ms, bytes, and mean volume (dB) of an audio file."""
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=sample_rate,channels",
                          "-of", "json", str(path)], capture_output=True, text=True, check=True).stdout
    info = json.loads(out)
    vol = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "volumedetect", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    mean = None
    for line in vol.splitlines():
        if "mean_volume:" in line:
            mean = float(line.split("mean_volume:")[1].split("dB")[0])
    return {"ms": round(float(info["format"]["duration"]) * 1000), "bytes": path.stat().st_size,
            "rate": int(info["streams"][0]["sample_rate"]), "channels": int(info["streams"][0]["channels"]), "mean_db": mean}
