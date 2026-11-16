import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.phoneme_fix import PhonemeError, fix_phonemes  # noqa: E402

ID_MAP = {c: [i] for i, c in enumerate(" ,.ɪçmˈɑːkʊntiəɛd")}


class PhonemeFix(unittest.TestCase):
    def test_cedilla_pair_is_composed(self):
        out = fix_phonemes([["ɪ", "c", "̧", " ", "m", "ˈ", "ɑ", "ː", "k"]], ID_MAP)
        self.assertEqual(out, [["ɪ", "ç", " ", "m", "ˈ", "ɑ", "ː", "k"]])

    def test_without_the_fix_the_symbols_would_not_match(self):
        # the pair is two separate keys, the composed symbol is a third one: all three exist in a real model,
        # but a model without U+0327 would drop it silently; here the combining mark is not in the map
        with self.assertRaises(PhonemeError):
            fix_phonemes([["c", "̧"]], {"c": [1]})   # no ç in the map: error, not a silent skip

    def test_unknown_phoneme_is_a_loud_error_naming_the_codepoint(self):
        with self.assertRaises(PhonemeError) as cm:
            fix_phonemes([["ɪ", "ʃ"]], ID_MAP, where="s01q1n0007")
        self.assertIn("s01q1n0007", str(cm.exception))
        self.assertIn("U+0283", str(cm.exception))

    def test_nothing_left_over(self):
        out = fix_phonemes([["m", "ɪ", "l", "c", "̧"]], {**ID_MAP, "l": [1]})
        self.assertFalse(any("̧" in s for sent in out for s in sent))

    def test_already_composed_input_is_unchanged(self):
        self.assertEqual(fix_phonemes([["ɪ", "ç"]], ID_MAP), [["ɪ", "ç"]])


if __name__ == "__main__":
    unittest.main()
