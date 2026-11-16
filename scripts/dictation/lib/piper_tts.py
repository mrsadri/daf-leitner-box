"""Mode B: local synthesis with Piper (open source, runs offline on the owner's machine).

Needs `pip install piper-tts` (in a virtual environment) and the Homebrew/system espeak-ng data
(`brew install espeak-ng`): the espeak data path that the PyPI wheel has compiled in only exists on
the build machine of the wheel. Voice models (.onnx plus .onnx.json) come from
https://huggingface.co/rhasspy/piper-voices and live in build/dictation/piper-voices/ (not committed).
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from .phoneme_fix import fix_phonemes

REPO = Path(__file__).resolve().parents[3]
MODELS_DIR = REPO / "build" / "dictation" / "piper-voices"
ESPEAK_CANDIDATES = [
    os.environ.get("ESPEAK_DATA_DIR", ""),
    "/opt/homebrew/share/espeak-ng-data",
    "/usr/local/share/espeak-ng-data",
    "/usr/share/espeak-ng-data",
    "/usr/lib/x86_64-linux-gnu/espeak-ng-data",
]


def espeak_data_dir() -> str:
    for p in ESPEAK_CANDIDATES:
        if p and (Path(p) / "phontab").exists():
            return p
    raise RuntimeError("espeak-ng data not found: run `brew install espeak-ng` (or set ESPEAK_DATA_DIR)")


@dataclass(frozen=True)
class VoiceSettings:
    model: str                 # 'de_DE-thorsten-medium'
    speaker: int | None = None
    length_scale: float = 1.0  # larger = slower
    noise_scale: float = 0.667
    noise_w: float = 0.8
    pitch_semitones: float = 0.0   # applied with ffmpeg afterwards
    tempo: float = 1.0             # applied with ffmpeg afterwards

    def key_part(self) -> str:
        return (f"piper|{self.model}|{self.speaker}|{self.length_scale}|{self.noise_scale}|{self.noise_w}|"
                f"{self.pitch_semitones}|{self.tempo}")


class PiperEngine:
    def __init__(self, models_dir: Path = MODELS_DIR):
        from piper import PiperVoice  # imported late so that the other scripts need no Piper
        self._PiperVoice = PiperVoice
        self.models_dir = Path(models_dir)
        self._voices: dict[str, object] = {}
        self._espeak = espeak_data_dir()

    def voice(self, model: str):
        if model not in self._voices:
            path = self.models_dir / f"{model}.onnx"
            if not path.exists():
                raise FileNotFoundError(f"{path} missing; download the model and its .onnx.json from huggingface.co/rhasspy/piper-voices")
            self._voices[model] = self._PiperVoice.load(str(path), espeak_data_dir=self._espeak)
        return self._voices[model]

    def phonemes(self, model: str, text: str, where: str = "") -> list[list[str]]:
        v = self.voice(model)
        return fix_phonemes(v.phonemize(text), v.config.phoneme_id_map, where)

    def synthesize(self, settings: VoiceSettings, text: str, where: str = ""):
        """Return (float32 samples in [-1, 1], sample rate). Raises PhonemeError on an unknown phoneme."""
        import numpy as np
        from piper.config import SynthesisConfig
        v = self.voice(settings.model)
        cfg = SynthesisConfig(speaker_id=settings.speaker, length_scale=settings.length_scale,
                              noise_scale=settings.noise_scale, noise_w_scale=settings.noise_w, normalize_audio=False)
        chunks = []
        for symbols in self.phonemes(settings.model, text, where):
            ids = v.phonemes_to_ids(symbols)
            audio = v.phoneme_ids_to_audio(ids, cfg)
            chunks.append(np.asarray(audio, dtype=np.float32).reshape(-1))
            chunks.append(np.zeros(int(v.config.sample_rate * 0.12), dtype=np.float32))   # short breath between sentences
        samples = np.concatenate(chunks[:-1]) if chunks else np.zeros(0, dtype=np.float32)
        peak = float(np.max(np.abs(samples))) if samples.size else 0.0
        if peak > 1.0:
            samples = samples / peak
        return samples, int(v.config.sample_rate)
