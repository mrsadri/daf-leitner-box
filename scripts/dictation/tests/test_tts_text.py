import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.tts_text import cardinal, speech  # noqa: E402


def say(t):
    return speech(t)[0]


class TtsText(unittest.TestCase):
    def test_cardinals(self):
        self.assertEqual(cardinal(0), "null")
        self.assertEqual(cardinal(21), "einundzwanzig")
        self.assertEqual(cardinal(97), "siebenundneunzig")
        self.assertEqual(cardinal(450), "vierhundertfünfzig")
        self.assertEqual(cardinal(8000), "achttausend")
        self.assertEqual(cardinal(1976), "eintausendneunhundertsechsundsiebzig")

    def test_unchanged_text_returns_none(self):
        self.assertIsNone(say("Es regnet in Graz."))

    def test_ordinal_case_follows_preposition(self):
        self.assertEqual(say("Am 19. Oktober kommt sie."), "Am neunzehnten Oktober kommt sie.")
        self.assertEqual(say("Montag, 19. Oktober."), "Montag, neunzehnter Oktober.")
        self.assertEqual(say("Vom 20. Dezember bis zum 6. Januar."), "Vom zwanzigsten Dezember bis zum sechsten Januar.")
        self.assertEqual(say("Der 1. November ist Umzugstag."), "Der erste November ist Umzugstag.")

    def test_clock_times(self):
        self.assertEqual(say("Um 9:00 Uhr beginnt es."), "Um neun Uhr beginnt es.")
        self.assertEqual(say("Um 14:30 Uhr."), "Um vierzehn Uhr dreißig.")

    def test_prices(self):
        self.assertEqual(say("Das kostet 450 Euro."), "Das kostet vierhundertfünfzig Euro.")
        self.assertEqual(say("Es kostet 1,89 Euro."), "Es kostet ein Euro neunundachtzig.")

    def test_phone_numbers(self):
        self.assertEqual(say("Meine Nummer ist 0664 23 59 18."),
                         "Meine Nummer ist null sechs sechs vier, dreiundzwanzig, neunundfünfzig, achtzehn.")

    def test_year_and_abbreviation(self):
        self.assertIn("neunzehnhundertsechsundsiebzig", say("Im Mai 1976."))
        self.assertEqual(say("Tel. ist besetzt."), "Telefon ist besetzt.")

    def test_race_time_is_flagged_not_guessed(self):
        out, notes = speech("Er gewann in 1:02:11.")
        self.assertIsNone(out)
        self.assertTrue(any("race time" in n for n in notes))

    def test_postal_code_is_flagged(self):
        out, notes = speech("8020.")
        self.assertTrue(any("postal code" in n for n in notes))


if __name__ == "__main__":
    unittest.main()
