"""Parser for the story Markdown (`story-NN.md`)."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

from .normalize import bold_spans, normalize_text, strip_bold


class StoryError(Exception):
    """A structural problem in the source Markdown (a build error)."""


@dataclass
class ParsedSequence:
    number: int
    title: str
    situation_fa: str
    situation_en: str
    paragraphs: list[str]          # clean text, bold stripped, normalized
    bold: list[str] = field(default_factory=list)   # target words (coverage report)


@dataclass
class ParsedStory:
    title: str
    lessons: tuple[int, int]
    sequences: list[ParsedSequence]


EXPECTED_SEQUENCES = 6


def _section(body: str, label: str, next_labels: list[str]) -> str | None:
    pattern = r"^\*\*" + re.escape(label) + r"\*\*[ \t]*\n(.*?)(?=^\*\*(?:" + "|".join(
        re.escape(n) for n in next_labels) + r")|\Z)"
    m = re.search(pattern, body, re.S | re.M)
    return m.group(1).strip() if m else None


def parse_story(path: Path, expected_sequences: int = EXPECTED_SEQUENCES) -> ParsedStory:
    raw = Path(path).read_text(encoding="utf-8")
    title_m = re.match(r"#\s+(.+)", raw)
    if not title_m:
        raise StoryError(f"{path}: missing '# Title' heading")
    lessons_m = re.search(r"\*\*Lektionen?\s+(\d+)(?:\s+bis\s+(\d+))?\*\*", raw)
    if not lessons_m:
        raise StoryError(f"{path}: missing '**Lektionen A bis B**' line")
    first = int(lessons_m.group(1))
    last = int(lessons_m.group(2) or first)

    parts = re.split(r"^## ", raw, flags=re.M)[1:]
    sequences: list[ParsedSequence] = []
    for part in parts:
        head, _, body = part.partition("\n")
        m = re.match(r"Sequenz\s+(\d+):\s*(.+)", head.strip())
        if not m:
            continue  # "Lösungen" and anything else
        n = int(m.group(1))
        labels = ["Situation (فارسی)", "Situation (English)", "Text", "Fragen"]
        fa = _section(body, labels[0], labels[1:])
        en = _section(body, labels[1], labels[2:])
        text = _section(body, labels[2], labels[3:])
        missing = [l for l, v in zip(labels[:3], (fa, en, text)) if not v]
        if missing:
            raise StoryError(f"{path}: Sequenz {n} lacks section(s): {', '.join(missing)}")
        paragraphs = [p for p in re.split(r"\n\s*\n", text) if p.strip()]
        sequences.append(ParsedSequence(
            number=n,
            title=m.group(2).strip(),
            situation_fa=normalize_text(strip_bold(fa)),
            situation_en=normalize_text(strip_bold(en)),
            paragraphs=[normalize_text(strip_bold(p)) for p in paragraphs],
            bold=[b for p in paragraphs for b in bold_spans(p)],
        ))
    if len(sequences) != expected_sequences:
        raise StoryError(f"{path}: expected {expected_sequences} sequences, found {len(sequences)}")
    numbers = [s.number for s in sequences]
    if numbers != list(range(1, expected_sequences + 1)):
        raise StoryError(f"{path}: sequence numbers must be 1..{expected_sequences}, got {numbers}")
    return ParsedStory(title=normalize_text(title_m.group(1)), lessons=(first, last), sequences=sequences)
