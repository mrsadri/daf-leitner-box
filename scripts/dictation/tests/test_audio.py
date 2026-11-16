import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.audio import build_filtergraph, segment_filter  # noqa: E402


class FilterGraph(unittest.TestCase):
    def test_no_change_is_a_null_filter(self):
        self.assertEqual(segment_filter(22050, 0, 1.0), "anull")

    def test_pitch_up_two_semitones_compensates_speed(self):
        f = segment_filter(22050, 2, 1.0)
        self.assertIn("asetrate=24750", f)           # 22050 * 2^(2/12)
        self.assertIn("atempo=0.8909", f)           # 1 / 1.12246

    def test_tempo_alone(self):
        self.assertEqual(segment_filter(22050, 0, 1.05), "atempo=1.05000")

    def test_two_segments_are_crossfaded_once(self):
        g = build_filtergraph(2, 22050, [0, 0], [1.0, 1.0])
        self.assertEqual(g.count("acrossfade"), 1)
        self.assertIn("loudnorm=I=-16:TP=-1.5", g)
        self.assertIn("adelay=80|80", g)
        self.assertIn("apad=pad_dur=0.25", g)

    def test_silence_is_trimmed_at_both_ends_only(self):
        g = build_filtergraph(1, 22050, [0], [1.0])
        self.assertNotIn("stop_periods", g)             # that option would cut everything after the first pause
        self.assertEqual(g.count("silenceremove=start_periods=1"), 2)
        self.assertEqual(g.count("areverse"), 2)

    def test_single_segment_has_no_crossfade(self):
        self.assertNotIn("acrossfade", build_filtergraph(1, 22050, [0], [1.0]))


if __name__ == "__main__":
    unittest.main()
