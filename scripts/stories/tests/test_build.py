import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import build_stories as b  # noqa: E402


class BoldText(unittest.TestCase):
    def test_bold_ranges_survive_normalization(self):
        text, ranges = b.bold_text("**Montag**,  acht Uhr. Die   **Stadt** ist ruhig.")
        self.assertEqual(text, "Montag, acht Uhr. Die Stadt ist ruhig.")
        self.assertEqual([text[s:e] for s, e in ranges], ["Montag", "Stadt"])

    def test_no_bold(self):
        self.assertEqual(b.bold_text("Hallo Welt"), ("Hallo Welt", []))


class Quiz(unittest.TestCase):
    good = {"q": "Wer?", "options": ["a", "b", "c", "d"], "answer": 2}

    def errors(self, items):
        e: list[str] = []
        b.check_quiz("S01-Q1", items, e)
        return e

    def test_valid(self):
        self.assertEqual(self.errors([self.good] * 3), [])

    def test_needs_three(self):
        self.assertTrue(self.errors([self.good] * 2))

    def test_options(self):
        self.assertTrue(self.errors([self.good, self.good, {**self.good, "options": ["a", "b", "c"]}]))
        self.assertTrue(self.errors([self.good, self.good, {**self.good, "options": ["a", "A", "c", "d"]}]))
        self.assertTrue(self.errors([self.good, self.good, {**self.good, "options": ["a", "", "c", "d"]}]))

    def test_answer_index(self):
        self.assertTrue(self.errors([self.good, self.good, {**self.good, "answer": 4}]))

    def test_page_follows_the_text_or_para(self):
        paras = ["Nilufar trinkt Tee.", "Jonas spielt Gitarre im Park.", "Lucía tanzt Salsa."]
        pages = [[0], [1], [2]]
        q = {"q": "Was spielt Jonas?", "options": ["Gitarre", "Klavier", "Geige", "Bass"], "answer": 0}
        self.assertEqual(b.quiz_page(q, paras, pages), 1)
        self.assertEqual(b.quiz_page({**q, "para": 3}, paras, pages), 2)


class Committed(unittest.TestCase):
    def test_committed_json_is_up_to_date(self):
        files, errors, _ = b.build()
        self.assertEqual(errors, [])
        for name, body in files.items():
            self.assertEqual((b.PUBLIC / name).read_text(encoding="utf-8"), body, f"{name} is stale: run build_stories.py")


if __name__ == "__main__":
    unittest.main()
