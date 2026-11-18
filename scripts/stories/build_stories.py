#!/usr/bin/env python3
"""Build the Stories content: one JSON file per book, plus an index.

  python3 scripts/stories/build_stories.py            write public/data/stories/ and a report in build/stories/
  python3 scripts/stories/build_stories.py --check    exit 1 if the committed JSON is not what the sources produce (CI)

Sources (all committed):
  content/stories/source/story-NN.md     the 10 books; each has 6 sequences, and each sequence is one story
  content/stories/quiz/book-NN.json      3 multiple-choice questions per story (German), written by hand
  content/stories/images.json            illustrations (scripts/stories/prepare_images.py) with alt texts
  content/stories/names.json             proper names: shown as plain text, never offered as vocabulary
  public/data/wortschatz-daf-kompakt.csv the word list the stories link to

Output:
  public/data/stories/index.json         books, their lessons, story ids and titles, content version
  public/data/stories/book-NN.json       per story: situation (fa/en), image, pages, quiz

A page is a list of paragraphs; a paragraph is a list of segments: a plain string, or a word object
  {"t": text, "c": [card ids], "b": 1 if bold in the source (lesson word), "g": "m"|"f"|"n"|"pl" (noun gender)}
Plain strings may contain words that are not in the word list; the app makes those tappable too.

Standard library only. Nothing here talks to a network or to Supabase.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from lib import linker  # noqa: E402
from lib.sentences import sentence_count
from lib.gender import noun_gender  # noqa: E402
from lib.normalize import normalize_text  # noqa: E402
from lib.pages import group_pages  # noqa: E402
from lib.parse import parse_story, StoryError  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
CONTENT = REPO / "content" / "stories"
SOURCE = CONTENT / "source"
QUIZ = CONTENT / "quiz"
PUBLIC = REPO / "public" / "data" / "stories"
REPORTS = REPO / "build" / "stories"
CSV_FILE = REPO / "public" / "data" / "wortschatz-daf-kompakt.csv"
BOLD_OPEN, BOLD_CLOSE = "\ue010", "\ue011"   # stand-ins for ** while the text is normalized
MAX_CANDIDATES = 3   # cards a word may belong to (the app picks the one the learner owns, else the first)


class BuildError(Exception):
    pass


def dump(data) -> str:
    """Compact JSON for the app (served gzipped; the source files are what people read and review)."""
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n"


def bold_text(raw_paragraph: str) -> tuple[str, list[tuple[int, int]]]:
    """Normalized paragraph text and the character ranges that were bold in the source."""
    marked, opened = [], False
    for part in raw_paragraph.split("**"):
        marked.append(part)
        marked.append(BOLD_CLOSE if opened else BOLD_OPEN)
        opened = not opened
    s = normalize_text("".join(marked[:-1]))
    text, ranges, start = [], [], None
    for ch in s:
        if ch == BOLD_OPEN:
            start = len(text)
        elif ch == BOLD_CLOSE:
            if start is not None and len(text) > start:
                ranges.append((start, len(text)))
            start = None
        else:
            text.append(ch)
    return "".join(text), ranges


def raw_paragraphs(md: str) -> dict[int, list[str]]:
    """Sequence number -> its Text paragraphs with the ** markers kept."""
    out: dict[int, list[str]] = {}
    for part in re.split(r"^## ", md, flags=re.M)[1:]:
        head, _, body = part.partition("\n")
        m = re.match(r"Sequenz\s+(\d+):", head.strip())
        if not m:
            continue
        t = re.search(r"^\*\*Text\*\*[ \t]*\n(.*?)(?=^\*\*Fragen\*\*|\Z)", body, re.S | re.M)
        out[int(m.group(1))] = [p for p in re.split(r"\n\s*\n", t.group(1).strip()) if p.strip()] if t else []
    return out


def load_rows() -> dict[str, dict]:
    with open(CSV_FILE, encoding="utf-8-sig", newline="") as f:
        return {f"daf_{r['Lektion']}_{r['Nr']}": r for r in csv.DictReader(f)}


def segments(text: str, bold: list[tuple[int, int]], links: list[dict], rows: dict[str, dict]) -> tuple[list, dict]:
    """Split one paragraph into plain strings and word objects."""
    toks = linker.tokenize(text)
    by_start: dict[int, dict] = {}
    for l in links:
        for s, e, w in toks:
            if s >= l["s"] and e <= l["e"]:
                by_start[s] = l
    stats = {"words": len(toks), "linked": 0, "gender": 0}
    out: list = []
    pos = 0
    prev_word: str | None = None
    for s, e, w in toks:
        link = by_start.get(s)
        is_bold = any(bs <= s and e <= be for bs, be in bold)
        if link or is_bold:
            if s > pos:
                out.append(text[pos:s])
            seg: dict = {"t": w}
            if link:
                seg["c"] = link["cards"][:MAX_CANDIDATES]
                stats["linked"] += 1
                row = rows.get(link["cards"][0])
                if row and row["Wortart"] == "Nomen" and link["kind"] == "form":
                    g = noun_gender(w, row["Artikel"], row["Wort"], row["Plural"], prev_word)
                    if g:
                        seg["g"] = g
                        stats["gender"] += 1
            if is_bold:
                seg["b"] = 1
            out.append(seg)
            pos = e
        prev_word = w
    if pos < len(text):
        out.append(text[pos:])
    # merge neighbouring plain strings
    merged: list = []
    for x in out:
        if isinstance(x, str) and merged and isinstance(merged[-1], str):
            merged[-1] += x
        else:
            merged.append(x)
    return merged, stats


WORD = re.compile(r"[^\W\d_]+", re.U)


def quiz_page(question: dict, paragraphs: list[str], pages: list[list[int]]) -> int:
    """The page whose text shares the most words with the question and its correct answer (or `para` if given)."""
    if "para" in question:
        para = question["para"] - 1
    else:
        probe = {w.lower() for w in WORD.findall(question["q"] + " " + question["options"][question["answer"]]) if len(w) > 3}
        scores = [len(probe & {w.lower() for w in WORD.findall(p)}) for p in paragraphs]
        para = max(range(len(paragraphs)), key=lambda i: (scores[i], -i))
    return next(i for i, page in enumerate(pages) if para in page)


def check_quiz(story_id: str, items: list, errors: list[str]) -> None:
    if len(items) != 3:
        errors.append(f"{story_id}: {len(items)} quiz questions (need 3)")
    for k, q in enumerate(items, 1):
        opts = q.get("options", [])
        if not q.get("q", "").strip():
            errors.append(f"{story_id} Q{k}: empty question")
        if len(opts) != 4 or any(not str(o).strip() for o in opts):
            errors.append(f"{story_id} Q{k}: need 4 non-empty options")
        elif len({o.strip().lower() for o in opts}) != 4:
            errors.append(f"{story_id} Q{k}: options must differ")
        if not isinstance(q.get("answer"), int) or not 0 <= q["answer"] < 4:
            errors.append(f"{story_id} Q{k}: answer must be 0..3")


def build(allow_missing_quiz: bool = False) -> tuple[dict[str, str], list[str], list[str]]:
    """Returns ({relative output path: content}, errors, report lines)."""
    rows = load_rows()
    inflections = json.loads((CONTENT / "inflections.json").read_text(encoding="utf-8"))
    index = linker.build_index(list(rows.values()), inflections)
    images = json.loads((CONTENT / "images.json").read_text(encoding="utf-8"))
    names = set(json.loads((CONTENT / "names.json").read_text(encoding="utf-8"))["names"])
    files: dict[str, str] = {}
    errors: list[str] = []
    report: list[str] = []
    books_index = []
    unlinked_caps: dict[str, int] = {}

    for src in sorted(SOURCE.glob("story-[0-9][0-9].md")):
        n = int(src.stem.split("-")[1])
        book_id = f"B{n:02d}"
        try:
            parsed = parse_story(src)
        except StoryError as e:
            errors.append(str(e))
            continue
        raw = raw_paragraphs(src.read_text(encoding="utf-8"))
        quiz_file = QUIZ / f"book-{n:02d}.json"
        quiz = json.loads(quiz_file.read_text(encoding="utf-8")) if quiz_file.exists() else {}
        last_lesson = parsed.lessons[1]
        stories = []
        totals = {"words": 0, "linked": 0, "gender": 0}
        for seq in parsed.sequences:
            sid = f"S{n:02d}-Q{seq.number}"
            paras = raw[seq.number]
            if len(paras) != len(seq.paragraphs):
                errors.append(f"{sid}: paragraph count differs between parser and builder")
                continue
            texts, segs = [], []
            for p in paras:
                text, bold = bold_text(p)
                lr = linker.link_sentence(text, index, last_lesson, set(), names)
                sg, st = segments(text, bold, lr.links, rows)
                for k in totals:
                    totals[k] += st[k]
                for w in lr.unresolved:
                    if w[:1].isupper() and w not in names:
                        unlinked_caps[w] = unlinked_caps.get(w, 0) + 1
                texts.append(text)
                segs.append(sg)
            counts = [len(linker.tokenize(t)) for t in texts]
            pages = group_pages(counts)
            items = quiz.get(sid)
            if items is None:
                if not allow_missing_quiz:
                    errors.append(f"{sid}: no quiz in {quiz_file.relative_to(REPO)}")
                items = []
            else:
                check_quiz(sid, items, errors)
            img = images.get(sid)
            stories.append({
                "id": sid,
                "sentenceCount": sentence_count(texts),
                "n": seq.number,
                "title": seq.title,
                "situation": {"fa": seq.situation_fa, "en": seq.situation_en},
                "image": {"key": f"images/{sid}.{img['hash']}", "w": img["w"], "h": img["h"], "alt": img.get("alt")} if img else None,
                "pages": [[segs[i] for i in page] for page in pages],
                "quiz": [{"q": q["q"], "options": q["options"], "answer": q["answer"], "page": quiz_page(q, texts, pages)} for q in items],
            })
        book_names = sorted(w for w in names if any(w in t for s in stories for page in s["pages"] for para in page for t in [json.dumps(para, ensure_ascii=False)]))
        book = {"id": book_id, "n": n, "title": parsed.title, "lessons": list(parsed.lessons), "names": book_names, "stories": stories}
        body = dump(book)
        version = hashlib.sha256(body.encode()).hexdigest()[:10]
        files[f"book-{n:02d}.json"] = dump({"contentVersion": version, **book})
        books_index.append({"id": book_id, "n": n, "title": parsed.title, "lessons": list(parsed.lessons), "contentVersion": version,
                            "stories": [{"id": s["id"], "n": s["n"], "title": s["title"], "image": s["image"]["key"] if s["image"] else None} for s in stories]})
        pct = 100 * totals["linked"] / max(1, totals["words"])
        report.append(f"{book_id} {parsed.title!r}: {len(stories)} stories, {sum(len(s['pages']) for s in stories)} pages, "
                      f"{totals['words']} words, {totals['linked']} linked ({pct:.0f}%), {totals['gender']} with a gender underline")
    files["index.json"] = dump({"book": {"id": "graz-photo", "title": "راز عکسی از گراتس", "storyIds": [b["id"] for b in books_index]}, "books": books_index})
    caps = sorted(unlinked_caps.items(), key=lambda x: -x[1])
    report.append("")
    report.append("Capitalized words that are neither linked nor in names.json (names to add, or nouns missing from the word list):")
    report.append(", ".join(f"{w}×{c}" for w, c in caps))
    return files, errors, report


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="compare with the committed files, write nothing")
    ap.add_argument("--allow-missing-quiz", action="store_true", help="development only: build stories without a quiz")
    args = ap.parse_args(argv)
    files, errors, report = build(args.allow_missing_quiz)
    for e in errors:
        print("ERROR", e, file=sys.stderr)
    if errors:
        return 1
    if args.check:
        stale = [name for name, body in files.items() if not (PUBLIC / name).exists() or (PUBLIC / name).read_text(encoding="utf-8") != body]
        extra = [p.name for p in PUBLIC.glob("*.json") if p.name not in files]
        for name in stale:
            print(f"STALE public/data/stories/{name} (run scripts/stories/build_stories.py)", file=sys.stderr)
        for name in extra:
            print(f"EXTRA public/data/stories/{name}", file=sys.stderr)
        return 1 if stale or extra else 0
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for p in PUBLIC.glob("*.json"):
        if p.name not in files:
            p.unlink()
    for name, body in files.items():
        (PUBLIC / name).write_text(body, encoding="utf-8")
    REPORTS.mkdir(parents=True, exist_ok=True)
    (REPORTS / "report.txt").write_text("\n".join(report) + "\n", encoding="utf-8")
    print("\n".join(report[:12]))
    print(f"wrote {len(files)} files to public/data/stories/, report in build/stories/report.txt")
    return 0


if __name__ == "__main__":
    sys.exit(main())
