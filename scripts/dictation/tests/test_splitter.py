import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib.parse import parse_story
from lib.splitter import Abbreviations, split_paragraph, split_sequence

ROOT = Path(__file__).resolve().parents[3]
STORIES = ROOT / "DaF-kompakt-work" / "DaF-kompakt" / "output"
AB = Abbreviations.load()


def texts(par):
    return [s.text for s in split_paragraph(par, AB)]


class SplitterRules(unittest.TestCase):
    def test_s1_paragraph_end_is_boundary_and_missing_mark_is_error(self):
        self.assertEqual(texts("Es regnet."), ["Es regnet."])
        with self.assertRaises(ValueError):
            split_sequence(["Das hat kein Ende"], AB)

    def test_s2_terminal_mark_outside_quotes(self):
        self.assertEqual(texts("Es regnet. Wir bleiben hier!"), ["Es regnet.", "Wir bleiben hier!"])

    def test_s3_dialogue_tag_after_quote_is_one_sentence(self):
        self.assertEqual(texts("„Wie geht’s?“, fragt Lucía am Telefon."), ["„Wie geht’s?“, fragt Lucía am Telefon."])

    def test_s4_uppercase_after_closing_quote_is_boundary(self):
        self.assertEqual(texts("„Danke!“ Sie lacht."), ["„Danke!“", "Sie lacht."])

    def test_s4_lowercase_after_closing_quote_is_not(self):
        self.assertEqual(len(texts("„Danke!“ sagt Jonas.")), 1)

    def test_s5_short_quote_stays_whole(self):
        q = "„Das ist Frau Lechner. Sie ist die Direktorin.“"
        self.assertEqual(texts(q), [q])

    def test_s5_long_quote_splits_and_records_balance(self):
        words = " ".join(["wort"] * 12)
        q = f"„Erster Satz {words}. Zweiter Satz {words}.“"
        parts = split_paragraph(q, AB)
        self.assertEqual(len(parts), 2)
        self.assertEqual(parts[0].quote_balance, 1)
        self.assertEqual(parts[1].quote_balance, -1)
        self.assertTrue(any("S5" in n for n in parts[0].notes))

    def test_s6_colon_before_quote(self):
        self.assertEqual(len(texts("Sie sagt: „Ich komme.“")), 1)

    def test_s6_paragraph_ending_in_colon_joins_the_quote(self):
        got, _ = split_sequence(["Sie schreibt eine SMS:", "„Hallo Mutter!“"], AB)
        self.assertEqual([s.text for s in got], ["Sie schreibt eine SMS: „Hallo Mutter!“"])

    def test_s7_nested_single_quotes_never_split(self):
        t = "Sie hat gesagt: ‚Das Apartment ist schon weg. Schade!‘ Dann geht sie."
        self.assertEqual(texts(t), ["Sie hat gesagt: ‚Das Apartment ist schon weg. Schade!‘", "Dann geht sie."])

    def test_s8_abbreviation_before_digit(self):
        self.assertEqual(texts("Tel. 0316 72 14 ist besetzt."), ["Tel. 0316 72 14 ist besetzt."])

    def test_s8_never_final_abbreviation(self):
        self.assertEqual(len(texts("Das ist z. B. Jonas.")), 1)
        self.assertEqual(len(texts("Frau Dr. Wagner kommt.")), 1)

    def test_s8_initial(self):
        self.assertEqual(len(texts("Wer ist H.? Er weiß es nicht.")), 2)
        self.assertEqual(len(texts("Bahram und H., Graz, im Mai.")), 1)

    def test_s9_ordinal_before_month_is_not_a_boundary(self):
        got = split_paragraph("Montag, 19. Oktober. Dann kommt Dienstag.", AB)
        self.assertEqual(got[0].text, "Montag, 19. Oktober.")
        self.assertIn("ordinalDot", got[0].flags)

    def test_s10_digit_dot_before_uppercase_is_reviewed_boundary(self):
        got = split_paragraph("Hausnummer 14. Eine Frau kommt.", AB)
        self.assertEqual([s.text for s in got], ["Hausnummer 14.", "Eine Frau kommt."])
        self.assertIn("endsDigitDot", got[0].flags)
        self.assertTrue(any("S10" in n for n in got[0].notes))

    def test_s11_numbers_with_inner_punctuation(self):
        for t in ("Der Läufer war 1:52 schnell.", "Das kostet 3,5 Euro.", "Tel. 0664 23 59 ruft an.", "Es sind 1.000 Leute da."):
            self.assertEqual(len(texts(t)), 1, t)

    def test_s12_ellipsis_inside_quote_followed_by_word(self):
        self.assertEqual(len(texts("„Ich … ich weiß nicht.“")), 1)

    def test_s13_ellipsis_at_end_of_quote(self):
        got = split_paragraph("„Vielleicht …“ Sie geht.", AB)
        self.assertEqual(got[0].text, "„Vielleicht …“")
        self.assertEqual(got[0].end_mark, "…")
        self.assertIn("ellipsis", got[0].flags)

    def test_s14_semicolon_hyphen_parentheses(self):
        self.assertEqual(len(texts("Er kommt; sie geht (wirklich) - und ich bleibe.")), 1)

    def test_s15_long_sentences_are_flagged_not_split(self):
        t = "Dort gibt es " + ", ".join(f"ein Ding{i}" for i in range(14)) + "."
        got = split_paragraph(t, AB)
        self.assertEqual(len(got), 1)
        self.assertIn("long", got[0].flags)

    def test_s16_one_word_sentence(self):
        got = split_paragraph("Danke! Bitte.", AB)
        self.assertEqual([s.text for s in got], ["Danke!", "Bitte."])
        self.assertEqual(got[0].flags, [])

    def test_flags(self):
        s = split_paragraph("„Um 9 Uhr!“", AB)[0]
        self.assertEqual(set(s.flags), {"digits", "quoted"})


class GoldenCounts(unittest.TestCase):
    """The sentence counts only change when the source Markdown changes."""

    def count(self, n):
        story = parse_story(STORIES / f"story-{n}.md")
        return [len(split_sequence(q.paragraphs, AB)[0]) for q in story.sequences]

    def test_story_01(self):
        self.assertEqual(sum(self.count("01")), 352)

    def test_story_02(self):
        self.assertEqual(sum(self.count("02")), 431)


if __name__ == "__main__":
    unittest.main()
