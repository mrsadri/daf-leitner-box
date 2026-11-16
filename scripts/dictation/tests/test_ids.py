import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lib.ids import assign_ids, empty_lock  # noqa: E402


def run(lock, texts):
    return assign_ids(lock, "01", "S01-Q1", 1, texts)


class StableIds(unittest.TestCase):
    def setUp(self):
        self.lock = empty_lock()
        self.base = ["Montag, acht Uhr morgens.", "Die Annenstraße ist ruhig.", "Nilufar hat einen Termin.", "Sie ist müde."]
        self.ids, s = run(self.lock, self.base)

    def test_first_run_assigns_new_ids_with_counter(self):
        self.assertEqual(self.ids, ["s01q1n0001", "s01q1n0002", "s01q1n0003", "s01q1n0004"])
        self.assertEqual(self.lock["nextCounter"], 5)

    def test_second_run_is_stable(self):
        ids2, s = run(self.lock, self.base)
        self.assertEqual(ids2, self.ids)
        self.assertEqual((s.added, s.edited, s.retired), (0, 0, 0))

    def test_edit_keeps_id(self):
        texts = list(self.base)
        texts[1] = "Die Annenstraße in Graz ist ruhig."
        ids2, s = run(self.lock, texts)
        self.assertEqual(ids2, self.ids)
        self.assertEqual(s.edited, 1)

    def test_insert_gets_new_id_and_keeps_the_others(self):
        texts = self.base[:2] + ["Ein ganz neuer Satz über Kaffee."] + self.base[2:]
        ids2, s = run(self.lock, texts)
        self.assertEqual(ids2[:2] + ids2[3:], self.ids[:2] + self.ids[2:])
        self.assertEqual(ids2[2], "s01q1n0005")
        self.assertEqual(s.added, 1)

    def test_delete_retires_and_never_reuses(self):
        texts = self.base[:1] + self.base[2:]
        ids2, s = run(self.lock, texts)
        self.assertEqual(ids2, [self.ids[0], self.ids[2], self.ids[3]])
        self.assertEqual(s.retired, 1)
        retired = [e["id"] for e in self.lock["sequences"]["S01-Q1"] if e.get("retired")]
        self.assertEqual(retired, [self.ids[1]])
        # a later new sentence does not reuse the retired id
        ids3, _ = run(self.lock, texts + ["Noch ein neuer Satz hier."])
        self.assertNotIn(ids3[-1], self.ids)

    def test_reorder_keeps_ids(self):
        texts = [self.base[1], self.base[0], self.base[2], self.base[3]]
        ids2, s = run(self.lock, texts)
        self.assertEqual(ids2, [self.ids[1], self.ids[0], self.ids[2], self.ids[3]])
        self.assertEqual((s.added, s.retired), (0, 0))

    def test_dissimilar_replacement_is_retire_plus_add(self):
        texts = list(self.base)
        texts[3] = "Völlig anderer Inhalt hier zu lesen."
        ids2, s = run(self.lock, texts)
        self.assertNotEqual(ids2[3], self.ids[3])
        self.assertEqual((s.added, s.retired), (1, 1))


if __name__ == "__main__":
    unittest.main()
