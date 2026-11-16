import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:
    import numpy as np
except ImportError:          # CI runs the stdlib-only tests; numpy is part of the local Piper environment
    np = None

import gen_audio  # noqa: E402
from lib.piper_tts import VoiceSettings  # noqa: E402


class FakeEngine:
    """Quiet for the first attempts, audible once the noise setting is raised (like the MLS model on one-word lines)."""

    def __init__(self, audible_noise):
        self.audible_noise = audible_noise
        self.calls = 0

    def synthesize(self, settings, text, where=""):
        self.calls += 1
        amp = 0.2 if settings.noise_scale == self.audible_noise else 0.003
        return np.full(22050, amp, dtype="float32"), 22050


@unittest.skipIf(np is None, "numpy not installed")
class AudibleTests(unittest.TestCase):
    base = VoiceSettings(model="m", speaker=1, noise_scale=0.333, noise_w=0.333, length_scale=0.85, tempo=1.0)

    def test_audible_first_try_is_kept(self):
        e = FakeEngine(0.333)
        _, _, note = gen_audio.synthesize_audible(e, self.base, "Ja.", "s1")
        self.assertEqual((e.calls, note), (1, ""))

    def test_silent_result_is_retried_with_other_settings(self):
        e = FakeEngine(0.5)
        _, _, note = gen_audio.synthesize_audible(e, self.base, "Ja.", "s1")
        self.assertIn("retried", note)
        self.assertGreater(e.calls, 1)

    def test_silence_is_never_published(self):
        e = FakeEngine(99.0)
        with self.assertRaises(RuntimeError):
            gen_audio.synthesize_audible(e, self.base, "Ja.", "s1")


if __name__ == "__main__":
    unittest.main()
