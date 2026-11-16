import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.pages import group_pages  # noqa: E402
from lib.gender import noun_gender  # noqa: E402


class Pages(unittest.TestCase):
    def test_short_dialogue_lines_share_a_page(self):
        self.assertEqual(group_pages([10] * 12), [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]])  # 120 words fit exactly

    def test_new_page_before_going_over(self):
        self.assertEqual(group_pages([60, 50, 30, 80]), [[0, 1], [2, 3]])

    def test_long_paragraph_alone_and_never_split(self):
        self.assertEqual(group_pages([50, 200, 50]), [[0], [1], [2]])

    def test_tiny_last_page_merged(self):
        self.assertEqual(group_pages([100, 100, 20]), [[0], [1, 2]])

    def test_single_tiny_page_kept(self):
        self.assertEqual(group_pages([5]), [[0]])

    def test_empty(self):
        self.assertEqual(group_pages([]), [])

    def test_every_paragraph_exactly_once_in_order(self):
        counts = [7, 33, 120, 1, 1, 90, 45, 3, 130, 12]
        flat = [i for p in group_pages(counts) for i in p]
        self.assertEqual(flat, list(range(len(counts))))


class Gender(unittest.TestCase):
    def test_singular_by_article(self):
        self.assertEqual(noun_gender("Termin", "der", "der Termin", "die Termine", None), "m")
        self.assertEqual(noun_gender("Stadt", "die", "die Stadt", "die Städte", "eine"), "f")
        self.assertEqual(noun_gender("Formular", "das", "das Formular", "die Formulare", "das"), "n")

    def test_case_forms_are_singular(self):
        self.assertEqual(noun_gender("Tages", "der", "der Tag", "die Tage", "des"), "m")

    def test_plural(self):
        self.assertEqual(noun_gender("Städte", "die", "die Stadt", "die Städte", None), "pl")
        self.assertEqual(noun_gender("Kindern", "das", "das Kind", "die Kinder", "den"), "pl")

    def test_same_spelling_needs_the_word_before(self):
        # der Lehrer / die Lehrer
        self.assertEqual(noun_gender("Lehrer", "der", "der Lehrer", "die Lehrer", "die"), "pl")
        self.assertEqual(noun_gender("Lehrer", "der", "der Lehrer", "die Lehrer", "zwei"), "pl")
        self.assertEqual(noun_gender("Lehrer", "der", "der Lehrer", "die Lehrer", "ein"), "m")
        self.assertIsNone(noun_gender("Lehrer", "der", "der Lehrer", "die Lehrer", "mit"))
        # weak noun: den Kollegen (singular accusative) and die Kollegen (plural) look the same
        self.assertIsNone(noun_gender("Kollegen", "der", "der Kollege", "die Kollegen", "den"))
        self.assertEqual(noun_gender("Kollegen", "der", "der Kollege", "die Kollegen", "zwei"), "pl")

    def test_no_underline_for_odd_articles(self):
        self.assertIsNone(noun_gender("Teil", "der/das", "der/das Teil", "die Teile", None))
        self.assertIsNone(noun_gender("Ferien", "–", "die Ferien", "", None))

    def test_unknown_form_gets_nothing(self):
        self.assertIsNone(noun_gender("Terminkalender", "der", "der Termin", "die Termine", None))


if __name__ == "__main__":
    unittest.main()
