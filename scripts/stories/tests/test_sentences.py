import unittest
from lib.sentences import sentence_count

class Sentences(unittest.TestCase):
    def test_punctuation_dialogue_and_abbreviations(self):
        self.assertEqual(sentence_count(['Hallo! Wie geht es dir? Gut.']), 3)
        self.assertEqual(sentence_count(['Dr. Braun kommt z. B. um 3.5 Uhr. Er wartet.']), 2)
        self.assertEqual(sentence_count(['„Hallo!“ „Wer bist du?“']), 2)
        self.assertEqual(sentence_count(['Ein letzter Satz ohne Punkt']), 1)
