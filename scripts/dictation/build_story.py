#!/usr/bin/env python3
"""Build the per-sentence dataset of a story (see docs/dictation/04-content-pipeline.md).

  python3 scripts/dictation/build_story.py 01 --report     review files in build/dictation/
  python3 scripts/dictation/build_story.py 01 --publish    public/data/stories/story-01.json + index.json

Standard library only. Nothing here talks to a network or to Supabase.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from lib import ids as idlib  # noqa: E402
from lib import grammar as gram  # noqa: E402
from lib import linker, tts_text  # noqa: E402
from lib.attribution import NARRATOR, UNKNOWN, Cast, attribute_sentences  # noqa: E402
from lib.normalize import odd_glyphs  # noqa: E402
from lib.parse import StoryError, parse_story  # noqa: E402
from lib.splitter import Abbreviations, join_colon_paragraphs, split_sequence  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
CONTENT = REPO / "content" / "dictation"
SOURCE = REPO / "DaF-kompakt-work" / "DaF-kompakt" / "output"
PUBLIC = REPO / "public" / "data" / "stories"
REPORTS = REPO / "build" / "dictation"
CONF_RANK = {"high": 0, "medium": 1, "low": 2}
# Mode B (Piper) needs a voice per character; Mode C is computed on the device; Mode A (paid TTS) is not used.
REQUIRED_VOICE_MODES = ("B",)


class BuildError(Exception):
    pass


def dump_json(data) -> str:
    """Stable formatting so Git diffs show only real changes."""
    return json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def _c(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def dump_story(story: dict) -> str:
    """One sentence per line: small files, and a Git diff shows exactly the changed sentences."""
    lines = ["{"]
    keys = sorted(k for k in story if k != "sequences")
    for k in keys:
        lines.append(f"{_c(k)}:{_c(story[k])},")
    lines.append('"sequences":[')
    seq_parts = []
    for q in story["sequences"]:
        head = {k: v for k, v in q.items() if k != "sentences"}
        head_s = _c(head)[:-1]          # drop the closing brace
        body = ",\n".join(_c(s) for s in q["sentences"])
        seq_parts.append(head_s + ',"sentences":[\n' + body + "\n]}")
    lines.append(",\n".join(seq_parts))
    lines.append("]}")
    return "\n".join(lines) + "\n"


def dump_index(idx: dict) -> str:
    return dump_json(idx)


def load_json(path: Path, default):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def first_sentence(text: str) -> str:
    m = re.match(r"(.+?[.!?؟])(\s|$)", text.strip())
    return (m.group(1) if m else text).strip()


def expand_ranges(ranges: list[str], order: list[str]) -> set[str]:
    covered: set[str] = set()
    pos = {sid: i for i, sid in enumerate(order)}
    for r in ranges:
        a, _, b = r.partition("-")
        b = b or a
        if a not in pos or b not in pos:
            raise BuildError(f"reviewed range {r!r}: unknown sentence id")
        covered.update(order[pos[a]:pos[b] + 1])
    return covered



def load_cards(content: Path, max_block: int) -> dict[str, dict]:
    cards: dict[str, dict] = {}
    for b in range(1, max_block + 1):
        data = load_json(content / "grammar" / f"block-{b:02d}.json", {"cards": []})
        for c in data["cards"]:
            cards[c["id"]] = c
    return cards


def apply_grammar(flat: list[dict], story_block: int, overrides: dict, cards: dict[str, dict],
                  warnings: list[str], errors: list[str]) -> tuple[dict[str, str], dict]:
    """Detect candidate points, apply the scope rule and the overrides. Returns ({point: first sentence id}, stats)."""
    gov = overrides.get("grammar", {})
    add, remove = gov.get("add", {}), gov.get("remove", {})
    seen_in_seq: set[tuple[str, str]] = set()
    first: dict[str, str] = {}
    stats = {"candidates": 0, "attached": 0}
    ids_by_sentence = {f["sentence"]["id"]: f for f in flat}
    for sid in list(add) + list(remove):
        if sid not in ids_by_sentence:
            warnings.append(f"overrides.grammar: unknown sentence id {sid}")
    for f in flat:
        s = f["sentence"]
        found = gram.detect(s["text"], s["links"], story_block)
        stats["candidates"] += len(found)
        kept = []
        for pid in found:
            if gram.scope_of(pid) == "sequence":
                key = (f["seq"], pid)
                if key in seen_in_seq:
                    continue
                seen_in_seq.add(key)
            kept.append(pid)
        kept = [p for p in kept if p not in remove.get(s["id"], [])]
        for p in add.get(s["id"], []):
            if p not in kept:
                kept.append(p)
        for p in kept:
            if p not in cards:
                errors.append(f"{s['id']}: grammar point {p} has no card in content/dictation/grammar/")
        s["grammar"] = sorted(kept)
        stats["attached"] += len(kept)
        for p in kept:
            first.setdefault(p, s["id"])
    return first, stats


def build_grammar_file(story: dict, first: dict[str, str], cards: dict[str, dict], root: Path,
                       warnings: list[str]) -> dict:
    """Cards used by the story, with example sentences resolved to text (earlier blocks come from their story file)."""
    used = {p for q in story["sequences"] for s in q["sentences"] for p in s["grammar"]}
    texts: dict[str, dict[str, str]] = {}

    def sentence_text(block: int, sid: str) -> str | None:
        if block == story["block"]:
            return next((s["text"] for q in story["sequences"] for s in q["sentences"] if s["id"] == sid), None)
        if block not in texts:
            path = root / "public" / "data" / "stories" / f"story-{block:02d}.json"
            other = load_json(path, None)
            texts[block] = {s["id"]: s["text"] for q in other["sequences"] for s in q["sentences"]} if other else {}
        return texts[block].get(sid)

    out = []
    for pid in sorted(used, key=lambda x: (cards[x]["block"], cards[x]["lesson"], x) if x in cards else (99, 99, x)):
        c = cards.get(pid)
        if c is None:
            continue
        if not c.get("rule"):
            warnings.append(f"grammar card {pid} has no rule text yet")
        ex = []
        for sid in c.get("examples", []):
            t = sentence_text(c["block"], sid)
            if t is None:
                warnings.append(f"grammar card {pid}: example {sid} not found")
            else:
                ex.append({"id": sid, "text": t})
        card = {k: v for k, v in c.items() if k != "examples"}
        card["examples"] = ex
        out.append(card)
    return {"storyId": story["id"], "block": story["block"], "cards": out,
            "first": {k: v for k, v in sorted(first.items())}}


def build(story_no: str, *, root: Path = REPO, source_dir: Path | None = None, lock_path: Path | None = None,
          write_lock: bool = False) -> dict:
    """Return {'story': dict, 'index_entry': dict, 'reports': {...}, 'warnings': [...], 'errors': [...]}"""
    content = root / "content" / "dictation"
    source_dir = source_dir or root / "DaF-kompakt-work" / "DaF-kompakt" / "output"
    parsed = parse_story(source_dir / f"story-{story_no}.md")
    abbr = Abbreviations.load(content / "abbreviations.json")
    cast = Cast.load(content / "cast.json")
    overrides = load_json(content / f"story-{story_no}.overrides.json", {})
    lock_path = lock_path or content / f"story-{story_no}.ids.json"
    lock = load_json(lock_path, idlib.empty_lock())
    inflections = load_json(content / "inflections.json", {"forms": {}})
    images = load_json(content / "images.json", {})
    index = linker.build_index(linker.load_cards(root / "public" / "data" / "wortschatz-daf-kompakt.csv"), inflections)
    protected = set(overrides.get("protectedWords", []))
    names = {w for c in cast.characters for a in c["aliases"] for w in a.split()} | protected
    last_lesson = parsed.lessons[1]
    errors: list[str] = []
    warnings: list[str] = []
    summaries: list[str] = []

    sequences = []
    flat: list[dict] = []           # all sentences in reading order, with report extras
    split_notes: list[str] = []
    glyphs: Counter = Counter()
    coverage = {"tokens": 0, "linked": 0, "bold": 0, "bold_linked": 0}
    unresolved: Counter = Counter()
    bold_unresolved: Counter = Counter()

    for seq in parsed.sequences:
        key = f"S{story_no}-Q{seq.number}"
        try:
            splits, seq_notes = split_sequence(seq.paragraphs, abbr)
        except ValueError as e:
            errors.append(f"{key}: {e}")
            continue
        joined, _ = join_colon_paragraphs(seq.paragraphs)
        split_notes.extend(f"{key}: {n}" for n in seq_notes)
        attrs = attribute_sentences(joined, splits, cast)
        sentence_ids, summary = idlib.assign_ids(lock, story_no, key, seq.number, [s.text for s in splits])
        summaries.append(f"{key}: {summary}")
        sentences = []
        for sp, at, sid in zip(splits, attrs, sentence_ids):
            for g in odd_glyphs(sp.text):
                glyphs[g] += 1
            for n in sp.notes:
                split_notes.append(f"{key} {sid}: {n} | {sp.text[:80]}")
            lr = linker.link_sentence(sp.text, index, last_lesson, protected, names)
            coverage["tokens"] += lr.content_tokens
            coverage["linked"] += lr.linked_tokens
            unresolved.update(lr.unresolved)
            sentence = {
                "id": sid,
                "hash": idlib.text_hash(sp.text),
                "text": sp.text,
                "speaker": at.speaker,
                "endMark": sp.end_mark,
                "quoteBalance": sp.quote_balance,
                "flags": sorted(sp.flags),
                "links": lr.links,
                "grammar": [],
            }
            spoken, tts_notes = tts_text.speech(sp.text)
            for n in tts_notes:
                split_notes.append(f"{key} {sid}: TTS {n}")
            if at.segments:
                sentence["segments"] = []
                for g in at.segments:
                    seg = {"text": g.text, "speaker": g.speaker}
                    seg_spoken, _ = tts_text.speech(g.text)
                    if seg_spoken:
                        seg["speech"] = seg_spoken
                    sentence["segments"].append(seg)
            elif spoken:
                sentence["speech"] = spoken
            sentences.append(sentence)
            flat.append({"seq": key, "sentence": sentence, "rule": at.rule, "confidence": at.confidence})
        for b in seq.bold:
            br = linker.link_sentence(b, index, last_lesson, protected, names)
            coverage["bold"] += br.content_tokens
            coverage["bold_linked"] += br.linked_tokens
            bold_unresolved.update(br.unresolved)
        image_info = images.get(key)
        sequences.append({
            "id": key,
            "order": seq.number,
            "title": seq.title,
            "situation": {"fa": seq.situation_fa, "en": seq.situation_en},
            # key carries the source hash (images.json, prepare_images.py), so a replaced picture gets a new URL
            "image": ({"key": f"images/{key}.{image_info['hash']}" if image_info.get("hash") else f"images/{key}",
                       "w": image_info["w"], "h": image_info["h"],
                       "alt": overrides.get("alt", {}).get(key) or {"fa": first_sentence(seq.situation_fa), "en": first_sentence(seq.situation_en)}}
                      if image_info else None),
            "sentences": sentences,
        })
    if errors:
        return {"errors": errors, "warnings": warnings}

    # overrides: speakers, speech
    order = [f["sentence"]["id"] for f in flat]
    by_id = {f["sentence"]["id"]: f for f in flat}
    for sid, ov in overrides.get("speakers", {}).items():
        if sid not in by_id:
            warnings.append(f"overrides.speakers: unknown sentence id {sid}")
            continue
        s = by_id[sid]["sentence"]
        if isinstance(ov, str):
            s["speaker"] = ov
            s.pop("segments", None)
        else:
            s["segments"] = [{"text": t, "speaker": spk} for t, spk in ov["segments"]]
            s["speaker"] = max(s["segments"], key=lambda g: len(g["text"]) if g["speaker"] != NARRATOR else 0)["speaker"]
        by_id[sid]["rule"], by_id[sid]["confidence"] = "override", "high"
    for sid, text in overrides.get("speech", {}).items():
        if sid in by_id:
            by_id[sid]["sentence"]["speech"] = text
        else:
            warnings.append(f"overrides.speech: unknown sentence id {sid}")

    cards = load_cards(content, int(story_no))
    first_use, gram_stats = apply_grammar(flat, int(story_no), overrides, cards, warnings, errors)
    grammar_reviewed = bool(overrides.get("grammar", {}).get("reviewed", False))
    if not grammar_reviewed:
        warnings.append("grammar points are automatic candidates: review story-%s.grammar.md and set grammar.reviewed" % story_no)

    covered = expand_ranges(overrides.get("reviewed", []), order)
    cast_ids = cast.ids()
    voices = load_json(content / "voices.json", None)
    unreviewed = []
    for f in flat:
        s = f["sentence"]
        used = {s["speaker"]} | {g["speaker"] for g in s.get("segments", [])}
        for spk in used:
            if spk == UNKNOWN:
                errors.append(f"{s['id']}: speaker UNKNOWN: {s['text'][:60]}")
            elif spk not in cast_ids:
                errors.append(f"{s['id']}: speaker {spk} is not in cast.json")
            elif voices is not None and not all(spk in voices.get(m, {}) for m in REQUIRED_VOICE_MODES):
                errors.append(f"{s['id']}: speaker {spk} missing in voices.json for a mode")
        if f["confidence"] in ("medium", "low") and s["id"] not in covered:
            unreviewed.append(s["id"])
    speakers_reviewed = not unreviewed
    if unreviewed:
        warnings.append(f"{len(unreviewed)} medium/low speaker rows are not covered by overrides.reviewed")
    if voices is None:
        warnings.append("content/dictation/voices.json not found: voice coverage not checked")
    missing_images = [q["id"] for q in sequences if q["image"] is None]
    if missing_images:
        warnings.append(f"no image for {', '.join(missing_images)} (placeholder state is shown)")
    ratio = coverage["linked"] / max(1, coverage["tokens"])
    bratio = coverage["bold_linked"] / max(1, coverage["bold"])
    if ratio < 0.97:
        warnings.append(f"linked content tokens {ratio:.1%} (target 97%); target-word coverage {bratio:.1%}")

    story = {
        "id": f"story-{story_no}",
        "title": parsed.title,
        "block": int(story_no),
        "lessons": list(parsed.lessons),
        "speakersReviewed": speakers_reviewed,
        "grammarReviewed": grammar_reviewed,
        "names": sorted(names),          # proper names and protected words: never offered as new vocabulary cards
        "sequences": sequences,
    }
    story["contentVersion"] = hashlib.sha256(dump_story(story).encode("utf-8")).hexdigest()[:12]
    n_sent = sum(len(q["sentences"]) for q in sequences)
    index_entry = {"id": story["id"], "title": story["title"], "lessons": story["lessons"], "block": story["block"],
                   "sequences": len(sequences), "sentences": n_sent, "contentVersion": story["contentVersion"],
                   "file": f"story-{story_no}.json"}
    reports = render_reports(story_no, story, flat, unreviewed, split_notes, glyphs, coverage, unresolved,
                             bold_unresolved, summaries, covered)
    grammar_file = build_grammar_file(story, first_use, cards, root, warnings)
    reports[f"story-{story_no}.grammar.md"] = render_grammar_report(story, cards, first_use, gram_stats)
    return {"story": story, "grammar": grammar_file, "index_entry": index_entry, "reports": reports, "warnings": warnings, "errors": errors,
            "lock": lock, "summaries": summaries}


def render_grammar_report(story: dict, cards: dict[str, dict], first: dict[str, str], stats: dict) -> str:
    by_point: dict[str, list[tuple[str, str, str]]] = {}
    for q in story["sequences"]:
        for s in q["sentences"]:
            for p in s["grammar"]:
                by_point.setdefault(p, []).append((q["id"], s["id"], s["text"]))
    lines = [f"# Grammar review: {story['id']} ({story['title']})", "",
             "Points are automatic candidates. Remove wrong ones with `grammar.remove` and add missed ones with "
             f"`grammar.add` in `content/dictation/{story['id']}.overrides.json` (`{{\"S01-Q1\": ...}}` keys are sentence ids), "
             "then set `grammar.reviewed` to true. Points marked `sequence` are attached to the first sentence of each "
             "sequence that carries them (they are very common).", "",
             f"- candidates before the scope rule: {stats['candidates']}; attached: {stats['attached']}", ""]
    for pid in sorted(by_point, key=lambda x: (cards[x]["block"], cards[x]["lesson"], x) if x in cards else (99, 99, x)):
        c = cards.get(pid, {})
        lines += [f"## {pid}", "", f"{c.get('title', '?')} (block {c.get('block')}, lesson {c.get('lesson')}); scope {gram.scope_of(pid)}; "
                  f"{len(by_point[pid])} sentences; first: {first.get(pid)}", ""]
        for seq, sid, text in by_point[pid][:60]:
            lines.append(f"- {sid} ({seq}): {text[:130]}")
        if len(by_point[pid]) > 60:
            lines.append(f"- ... and {len(by_point[pid]) - 60} more")
        lines.append("")
    missing = [pid for pid in cards if cards[pid]["block"] <= story["block"] and pid not in by_point]
    lines += ["## Points with no sentence in this story", ""] + ([f"- {m}" for m in missing] or ["- none"])
    return "\n".join(lines) + "\n"


def render_reports(story_no, story, flat, unreviewed, split_notes, glyphs, coverage, unresolved, bold_unresolved,
                   summaries, covered) -> dict[str, str]:
    sp = [f"# Speaker review: story {story_no} ({story['title']})", "",
          "Rows marked `!` are medium or low confidence and need a decision. Fix mistakes in "
          f"`content/dictation/story-{story_no}.overrides.json` (`speakers`), then list the checked id ranges in `reviewed`.", ""]
    current = None
    for f in flat:
        if f["seq"] != current:
            current = f["seq"]
            sp += ["", f"## {current}", "", "| id | text | speaker | rule | conf |", "|---|---|---|---|---|"]
        s = f["sentence"]
        if s["speaker"] == NARRATOR and not s.get("segments") and f["confidence"] == "high":
            continue          # narration is not listed, only dialogue
        mark = "!" if f["confidence"] != "high" and s["id"] not in covered else ""
        seg = " + ".join(f"{g['speaker']}" for g in s.get("segments", []))
        sp.append(f"| {s['id']} | {s['text'][:110].replace('|', '/')} | {s['speaker']}{' (' + seg + ')' if seg else ''} | {f['rule']} | {f['confidence']}{mark} |")
    sp += ["", f"Unreviewed medium/low rows: {len(unreviewed)}"]

    sl = [f"# Split review: story {story_no}", "", "## Sentence counts", ""]
    for q in story["sequences"]:
        sl.append(f"- {q['id']}: {len(q['sentences'])} sentences")
    sl += ["", "## Id summary", ""] + [f"- {x}" for x in summaries]
    sl += ["", "## Decisions that need a human look (S5, S8, S10, S13, joins, TTS)", ""]
    sl += [f"- {n}" for n in split_notes if not re.search(r"S5:", n)] or ["- none"]
    sl += ["", f"(S5 long-quote splits: {sum(1 for n in split_notes if 'S5:' in n)}, listed in the JSON, not repeated here)"]
    sl += ["", "## Unusual glyphs", ""] + ([f"- {g!r} U+{ord(g):04X} x{c}" for g, c in glyphs.most_common()] or ["- none"])

    lk = [f"# Link review: story {story_no}", "",
          f"- linked content tokens: {coverage['linked']}/{coverage['tokens']} = {coverage['linked'] / max(1, coverage['tokens']):.1%}",
          f"- linked target words (bold in the Markdown): {coverage['bold_linked']}/{coverage['bold']} = {coverage['bold_linked'] / max(1, coverage['bold']):.1%}",
          "", "## Unresolved target words (bold)", ""]
    lk += [f"- {w} x{c}" for w, c in bold_unresolved.most_common()] or ["- none"]
    lk += ["", "## Unresolved content words (add to inflections.json or protectedWords)", ""]
    lk += [f"- {w} x{c}" for w, c in unresolved.most_common(200)] or ["- none"]
    amb = Counter()
    for f in flat:
        for l in f["sentence"]["links"]:
            if len(l["cards"]) > 1:
                amb[(f["sentence"]["text"][l["s"]:l["e"]], tuple(l["cards"]))] += 1
    lk += ["", "## Words with several candidate cards", ""] + [f"- {w}: {', '.join(c)} x{n}" for (w, c), n in amb.most_common(60)]
    return {f"story-{story_no}.speakers.md": "\n".join(sp) + "\n", f"story-{story_no}.splits.md": "\n".join(sl) + "\n",
            f"story-{story_no}.links.md": "\n".join(lk) + "\n"}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("story", help="story number, e.g. 01")
    ap.add_argument("--report", action="store_true", help="write the review files to build/dictation/")
    ap.add_argument("--publish", action="store_true", help="write public/data/stories JSON and the id lock file")
    ap.add_argument("--allow-unreviewed", action="store_true", help="publish with unreviewed medium/low speaker rows (development only)")
    ap.add_argument("--allow-missing-images", action="store_true", help="publish sequences without an image")
    args = ap.parse_args(argv)
    no = args.story.zfill(2)
    try:
        res = build(no)
    except (StoryError, BuildError) as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    for w in res.get("warnings", []):
        print(f"warning: {w}")
    if res["errors"]:
        for e in res["errors"][:40]:
            print(f"ERROR: {e}", file=sys.stderr)
        print(f"{len(res['errors'])} error(s); nothing written", file=sys.stderr)
        if not args.report:
            return 1
    if args.report and "reports" in res:
        REPORTS.mkdir(parents=True, exist_ok=True)
        for name, text in res["reports"].items():
            (REPORTS / name).write_text(text, encoding="utf-8")
        print(f"review files written to {REPORTS.relative_to(REPO)}/")
    if args.publish:
        if res["errors"]:
            return 1
        story = res["story"]
        if not story["speakersReviewed"] and not args.allow_unreviewed:
            print("ERROR: unreviewed medium/low speaker rows; review them or pass --allow-unreviewed (development only)", file=sys.stderr)
            return 1
        if any(q["image"] is None for q in story["sequences"]) and not args.allow_missing_images:
            print("ERROR: missing images; pass --allow-missing-images to publish with placeholders", file=sys.stderr)
            return 1
        PUBLIC.mkdir(parents=True, exist_ok=True)
        (PUBLIC / f"story-{no}.json").write_text(dump_story(story), encoding="utf-8")
        (PUBLIC / f"story-{no}.grammar.json").write_text(dump_json(res["grammar"]), encoding="utf-8")
        idx_path = PUBLIC / "index.json"
        idx = load_json(idx_path, {"version": 1, "stories": []})
        idx["stories"] = sorted([s for s in idx["stories"] if s["id"] != story["id"]] + [res["index_entry"]], key=lambda s: s["id"])
        idx_path.write_text(dump_json(idx), encoding="utf-8")
        (CONTENT / f"story-{no}.ids.json").write_text(dump_json(res["lock"]), encoding="utf-8")
        print(f"published story-{no}: {res['index_entry']['sentences']} sentences, contentVersion {story['contentVersion']}")
        for s in res["summaries"]:
            print("  ", s)
    return 0


if __name__ == "__main__":
    sys.exit(main())
