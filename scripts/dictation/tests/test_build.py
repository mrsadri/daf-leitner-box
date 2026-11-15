import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import build_story  # noqa: E402

REPO = build_story.REPO


class BuildStory(unittest.TestCase):
    def test_build_is_deterministic_and_matches_the_committed_files(self):
        for no in ("01", "02"):
            a = build_story.build(no)
            self.assertFalse(a["errors"], a["errors"][:3])
            b = build_story.build(no)
            self.assertEqual(build_story.dump_story(a["story"]), build_story.dump_story(b["story"]))
            published = (REPO / "public" / "data" / "stories" / f"story-{no}.json").read_text(encoding="utf-8")
            self.assertEqual(published, build_story.dump_story(a["story"]),
                             f"story-{no}.json is stale: run build_story.py {no} --publish")

    def test_second_run_assigns_no_new_ids(self):
        res = build_story.build("01")
        for line in res["summaries"]:
            self.assertIn("0 edited, 0 added, 0 retired", line)

    def test_no_unknown_speakers_and_all_speakers_in_cast(self):
        cast_ids = {c["id"] for c in build_story.load_json(REPO / "content" / "dictation" / "cast.json", {})["characters"]}
        for no in ("01", "02"):
            story = build_story.build(no)["story"]
            for q in story["sequences"]:
                for s in q["sentences"]:
                    self.assertIn(s["speaker"], cast_ids)
                    for g in s.get("segments", []):
                        self.assertIn(g["speaker"], cast_ids)

    def test_text_equals_markdown_apart_from_bold(self):
        """Every sentence of a sequence, joined, equals the Markdown text without bold markers."""
        import re
        for no in ("01", "02"):
            story = build_story.build(no)["story"]
            parsed = build_story.parse_story(build_story.SOURCE / f"story-{no}.md")
            for q, pq in zip(story["sequences"], parsed.sequences):
                got = re.sub(r"\s+", "", "".join(s["text"] for s in q["sentences"]))
                want = re.sub(r"\s+", "", "".join(pq.paragraphs))
                self.assertEqual(got, want, q["id"])


if __name__ == "__main__":
    unittest.main()
