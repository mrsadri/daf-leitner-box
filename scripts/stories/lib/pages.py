"""Group a story's paragraphs into book pages (docs/refactor/03-plan-checklist.md, 5.3). Pure.

Rules:
  - add paragraphs to a page until the next one would take it over MAX_WORDS
  - a paragraph is never split; a paragraph longer than MAX_WORDS gets a page of its own
  - a last page under MIN_LAST words is merged into the page before it
Many paragraphs are one line of dialogue, so a page usually holds several of them.
"""
from __future__ import annotations

MAX_WORDS = 120
MIN_LAST = 40


def group_pages(word_counts: list[int], max_words: int = MAX_WORDS, min_last: int = MIN_LAST) -> list[list[int]]:
    """Paragraph indexes per page, in order."""
    pages: list[list[int]] = []
    current: list[int] = []
    size = 0
    for i, n in enumerate(word_counts):
        if current and size + n > max_words:
            pages.append(current)
            current, size = [], 0
        current.append(i)
        size += n
    if current:
        pages.append(current)
    if len(pages) >= 2 and sum(word_counts[i] for i in pages[-1]) < min_last:
        last = pages.pop()
        pages[-1].extend(last)
    return pages
