"""Phonemizes the ich-sound words with the real Piper and asserts the cedilla fix (docs/dictation/05-audio.md).
Skipped when Piper, a voice model or espeak-ng data is missing, so CI stays green without them."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

WORDS = ["ich", "mich", "Milch", "Mädchen", "China", "Chemie", "Küche", "richtig", "nicht", "sprechen", "Österreich"]


def engine_or_none():
    try:
        from lib.piper_tts import MODELS_DIR, PiperEngine
        if not (MODELS_DIR / "de_DE-thorsten-medium.onnx").exists():
            return None
        return PiperEngine()
    except Exception:
        return None


class PiperPhonemes(unittest.TestCase):
    def test_ich_sound_words_survive_the_fix(self):
        engine = engine_or_none()
        if engine is None:
            self.skipTest("Piper, the thorsten model or espeak-ng data is not installed")
        voice = engine.voice("de_DE-thorsten-medium")
        for word in WORDS:
            raw = voice.phonemize(word)
            self.assertTrue(raw, word)
            fixed = engine.phonemes("de_DE-thorsten-medium", word, where=word)
            joined = "".join("".join(s) for s in fixed)
            self.assertNotIn("̧", joined, word)
            if any("ç" in "".join(s) for s in raw):
                self.assertIn("ç", joined, f"{word}: the pair must become the precomposed ç")


if __name__ == "__main__":
    unittest.main()
