import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib import grammar  # noqa: E402
from lib import linker  # noqa: E402

REPO = Path(__file__).resolve().parents[3]
INDEX = linker.build_index(linker.load_cards(REPO / "public" / "data" / "wortschatz-daf-kompakt.csv"),
                           json.loads((REPO / "content" / "dictation" / "inflections.json").read_text(encoding="utf-8")))


def detect(text: str, block: int = 2) -> set[str]:
    links = linker.link_sentence(text, INDEX, 6, set(), set()).links
    return {p.split("-", 3)[3] for p in grammar.detect(text, links, block)}


class DetectorTests(unittest.TestCase):
    def test_points_are_known_and_ids_match_cards(self):
        ids = set()
        for b in (1, 2):
            data = json.loads((REPO / "content" / "dictation" / "grammar" / f"block-0{b}.json").read_text(encoding="utf-8"))
            ids |= {c["id"] for c in data["cards"]}
        self.assertEqual({p.key for p in grammar.POINTS}, ids)

    def test_w_question_and_yes_no_question(self):
        self.assertIn("wortstellung-in-aussagen-w-fragen-und-ja-nein-fragen", detect("Woher kommst du?"))
        self.assertIn("wortstellung-in-aussagen-w-fragen-und-ja-nein-fragen", detect("Wohnst du in Graz?"))
        self.assertNotIn("wortstellung-in-aussagen-w-fragen-und-ja-nein-fragen", detect("Ich wohne in Graz."))

    def test_negation(self):
        self.assertIn("verneinung-mit-nicht-und-kein", detect("Ich habe keine Zeit."))
        self.assertIn("verneinung-mit-nicht-und-kein", detect("Das passt nicht."))
        self.assertNotIn("verneinung-mit-nicht-und-kein", detect("Das passt gut."))

    def test_accusative(self):
        self.assertIn("nominativ-und-akkusativ-mit-bestimmtem-artikel", detect("Sie besuchen den Markt."))
        self.assertIn("nominativ-und-akkusativ-mit-unbestimmtem-artikel-und-negativ", detect("Er hat einen Termin."))
        self.assertNotIn("nominativ-und-akkusativ-mit-bestimmtem-artikel", detect("Der Markt ist groß."))

    def test_modal_and_infinitive_at_the_end(self):
        got = detect("Frau Wagner möchte das Team vorstellen.")
        self.assertIn("modalverben-im-praesens-koennen-muessen-moecht", got)
        self.assertIn("modalverben-wortstellung-in-aussagesaetzen-und-w-fragen", got)

    def test_perfekt_kinds(self):
        self.assertIn("perfekt-regelmaessige-verben", detect("Er hat gestern gespielt."))
        self.assertIn("perfekt-unregelmaessige-verben-und-gemischte-verben", detect("Sie hat es geschrieben."))
        self.assertIn("perfekt-verben-mit-trennbaren-vorsilben-z-b-an-aus-weg-zurue", detect("Ich habe dich angerufen."))
        self.assertIn("perfekt-verben-mit-untrennbaren-vorsilben-z-b-be-er-ver", detect("Ich habe Leon besucht."))

    def test_adjective_after_sein_is_not_a_perfekt(self):
        self.assertNotIn("perfekt-verben-mit-untrennbaren-vorsilben-z-b-be-er-ver", detect("Das ist erlaubt."))

    def test_imperatives(self):
        self.assertIn("imperativsaetze", detect("Kommen Sie!"))
        self.assertIn("imperativsaetze-haben-und-sein", detect("Sei vorsichtig!"))
        self.assertIn("imperativsaetze-verben-mit-vokalwechsel", detect("Nimm einen Mantel mit!"))
        self.assertNotIn("imperativsaetze", detect("Kommst du?"))
        self.assertNotIn("imperativsaetze", detect("Er sagt: „Ich komme.“"))

    def test_suggestions(self):
        self.assertIn("vorschlaege-mit-sollen-wollen-wir-soll-ich", detect("Sollen wir einen Kaffee trinken?"))
        self.assertIn("vorschlaege-mit-sollen-wollen-wir-soll-ich", detect("Soll ich helfen?"))
        self.assertIn("vorschlaege-mit-wir", detect("Gehen wir doch ins Kino!"))

    def test_vowel_change_but_not_es_gibt(self):
        self.assertIn("praesens-verben-mit-vokalwechsel", detect("Er liest ein Buch."))
        self.assertNotIn("praesens-verben-mit-vokalwechsel", detect("Es gibt einen Balkon."))

    def test_block_filter(self):
        self.assertEqual({p for p in grammar.detect("Er hat gestern gespielt.", [], 1) if "-02-" in p}, set())

    def test_connectors_need_a_comma_before_denn(self):
        self.assertIn("konnektoren-denn-grund-oder-alternative-aber-gegensatz", detect("Ich bleibe hier, denn ich bin müde."))
        self.assertNotIn("konnektoren-denn-grund-oder-alternative-aber-gegensatz", detect("Wie spät ist es denn?"))

    def test_separable_present_and_with_modal(self):
        self.assertIn("praesens-verben-mit-trennbaren-vorsilben", detect("Sie holen den Schrank ab."))
        self.assertIn("praesens-verben-mit-trennbaren-vorsilben-und-modalverben", detect("Ab Montag kann Nilufar einziehen."))


class ScopeAndOverridesTests(unittest.TestCase):
    def test_sequence_scope_attaches_a_common_point_once_per_sequence(self):
        import build_story as b
        flat = [{"seq": "S01-Q1", "sentence": {"id": f"s01q1n000{i}", "text": "Die Frau und der Mann kommen.", "links": [], "grammar": []}}
                for i in range(1, 4)]
        warnings, errors = [], []
        cards = b.load_cards(REPO / "content" / "dictation", 1)
        first, _ = b.apply_grammar(flat, 1, {}, cards, warnings, errors)
        carrying = [f["sentence"]["id"] for f in flat if "g-01-02-artikel-bestimmt-und-unbestimmt" in f["sentence"]["grammar"]]
        self.assertEqual(carrying, ["s01q1n0001"])
        self.assertEqual(first["g-01-02-artikel-bestimmt-und-unbestimmt"], "s01q1n0001")

    def test_overrides_add_and_remove(self):
        import build_story as b
        flat = [{"seq": "S01-Q1", "sentence": {"id": "s01q1n0001", "text": "Ich habe keine Zeit.", "links": [], "grammar": []}}]
        cards = b.load_cards(REPO / "content" / "dictation", 1)
        ov = {"grammar": {"remove": {"s01q1n0001": ["g-01-02-verneinung-mit-nicht-und-kein"]},
                          "add": {"s01q1n0001": ["g-01-03-verbindung-von-satzteilen-mit-und"]}}}
        b.apply_grammar(flat, 1, ov, cards, [], [])
        self.assertEqual(flat[0]["sentence"]["grammar"], ["g-01-03-verbindung-von-satzteilen-mit-und"])

    def test_unknown_point_is_an_error(self):
        import build_story as b
        flat = [{"seq": "S01-Q1", "sentence": {"id": "s01q1n0001", "text": "Hallo.", "links": [], "grammar": []}}]
        errors = []
        b.apply_grammar(flat, 1, {"grammar": {"add": {"s01q1n0001": ["g-99-99-nope"]}}}, {}, [], errors)
        self.assertTrue(errors)


if __name__ == "__main__":
    unittest.main()
