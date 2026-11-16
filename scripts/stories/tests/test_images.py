import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.images import clean_name, crop_box, source_key  # noqa: E402


class SourceKey(unittest.TestCase):
    def test_plain_names(self):
        self.assertEqual(source_key("S01-Q1.jpg"), "S01-Q1")
        self.assertEqual(source_key("S02-Q6.png"), "S02-Q6")
        self.assertEqual(source_key("S10-Q3.webp"), "S10-Q3")
        self.assertEqual(source_key("s01-q4.JPEG"), "S01-Q4")

    def test_invisible_characters_and_spaces(self):
        # The first delivery had a zero-width space in front of three names
        self.assertEqual(source_key("​S01-Q1.jpg"), "S01-Q1")
        self.assertEqual(source_key("﻿S01-Q2.jpg"), "S01-Q2")       # BOM
        self.assertEqual(source_key("S01-Q3‎.jpg"), "S01-Q3")       # LRM
        self.assertEqual(source_key("  S01-Q5.jpg "), "S01-Q5")
        self.assertEqual(clean_name("​S01‍-Q6.jpg"), "S01-Q6.jpg")

    def test_rejects(self):
        for name in ["S01-Q1.md", "S01-Q7.jpg", "S1-Q1.jpg", "S01-Q0.jpg", "S01_Q1.jpg", "S01-Q1 copy.jpg", "S01-Q1.jpg.png", ".DS_Store"]:
            self.assertIsNone(source_key(name), name)


class CropBox(unittest.TestCase):
    def test_exact_4_3(self):
        self.assertEqual(crop_box(1600, 1200), (0, 0, 1600, 1200))

    def test_delivered_size_is_slightly_wide(self):
        left, top, right, bottom = crop_box(2400, 1792)
        self.assertEqual((top, bottom), (0, 1792))
        self.assertAlmostEqual((right - left) / 1792, 4 / 3, places=2)
        self.assertEqual(left, (2400 - (right - left)) // 2)

    def test_slightly_tall(self):
        left, top, right, bottom = crop_box(2400, 1850)
        self.assertEqual((left, right), (0, 2400))
        self.assertEqual(bottom - top, 1800)

    def test_refuses_wrong_shape_or_too_small(self):
        with self.assertRaises(ValueError):
            crop_box(1920, 1080)       # 16:9
        with self.assertRaises(ValueError):
            crop_box(1200, 900)        # 4:3 but smaller than the output
        with self.assertRaises(ValueError):
            crop_box(1792, 2400)       # portrait


if __name__ == "__main__":
    unittest.main()
