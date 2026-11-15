"""Stable sentence ids from a committed lock file (04-content-pipeline.md, "Stable sentence ids").

The id is not the position. Per sequence: (1) exact-text matches in order (LCS),
(1b) exact-text matches that moved, (2) pairing of edited sentences between anchors when
the text similarity is at least 0.6, (3) everything else gets a new id; leftover old
sentences are retired and their ids are never reused.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass
from difflib import SequenceMatcher

SIMILARITY = 0.6


def text_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:12]


@dataclass
class Summary:
    kept: int = 0
    edited: int = 0
    added: int = 0
    retired: int = 0

    def __str__(self) -> str:
        return f"{self.edited} edited, {self.added} added, {self.retired} retired, {self.kept} unchanged"


def empty_lock() -> dict:
    return {"version": 1, "nextCounter": 1, "sequences": {}}


def _lcs_pairs(old: list[str], new: list[str]) -> list[tuple[int, int]]:
    n, m = len(old), len(new)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n - 1, -1, -1):
        for j in range(m - 1, -1, -1):
            dp[i][j] = dp[i + 1][j + 1] + 1 if old[i] == new[j] else max(dp[i + 1][j], dp[i][j + 1])
    i = j = 0
    pairs = []
    while i < n and j < m:
        if old[i] == new[j]:
            pairs.append((i, j))
            i += 1
            j += 1
        elif dp[i + 1][j] >= dp[i][j + 1]:
            i += 1
        else:
            j += 1
    return pairs


def assign_ids(lock: dict, story_no: str, seq_key: str, seq_no: int, texts: list[str]) -> tuple[list[str], Summary]:
    """Return the id for each new sentence text of one sequence and update the lock in place.

    seq_key is e.g. 'S01-Q1'; story_no is e.g. '01'; seq_no is the sequence number 1..6.
    """
    entries = lock["sequences"].setdefault(seq_key, [])
    active = [e for e in entries if not e.get("retired")]
    old_texts = [e["text"] for e in active]
    summary = Summary()
    result: list[str | None] = [None] * len(texts)
    used_old: set[int] = set()

    # (1) exact matches, in order
    for oi, ni in _lcs_pairs(old_texts, texts):
        result[ni] = active[oi]["id"]
        used_old.add(oi)
        summary.kept += 1
    # (1b) exact matches that moved
    for ni, t in enumerate(texts):
        if result[ni] is not None:
            continue
        for oi, ot in enumerate(old_texts):
            if oi not in used_old and ot == t:
                result[ni] = active[oi]["id"]
                used_old.add(oi)
                summary.kept += 1
                break
    # (2) edited sentences between anchors: same gap size, position pairing at similarity >= 0.6
    anchors = [(-1, -1)]
    # anchor positions are the matched (old index, new index) pairs in new order
    id_to_old = {active[oi]["id"]: oi for oi in used_old}
    for ni, rid in enumerate(result):
        if rid is not None:
            anchors.append((id_to_old[rid], ni))
    anchors.append((len(active), len(texts)))
    for (o0, n0), (o1, n1) in zip(anchors, anchors[1:]):
        if o1 <= o0 or n1 <= n0:
            continue   # a moved anchor breaks the order; skip this gap
        gap_old = [oi for oi in range(o0 + 1, o1) if oi not in used_old]
        gap_new = [ni for ni in range(n0 + 1, n1) if result[ni] is None]
        if gap_old and len(gap_old) == len(gap_new):
            for oi, ni in zip(gap_old, gap_new):
                if SequenceMatcher(None, old_texts[oi], texts[ni]).ratio() >= SIMILARITY:
                    result[ni] = active[oi]["id"]
                    used_old.add(oi)
                    summary.edited += 1
    # (3) new ids for the rest
    for ni, rid in enumerate(result):
        if rid is None:
            counter = lock["nextCounter"]
            lock["nextCounter"] = counter + 1
            result[ni] = f"s{story_no}q{seq_no}n{counter:04d}"
            summary.added += 1
    for oi, e in enumerate(active):
        if oi not in used_old:
            e["retired"] = True
            summary.retired += 1

    # rewrite the sequence entries: current sentences in order, retired ones kept at the end
    by_id = {e["id"]: e for e in entries}
    kept_entries = []
    for ni, rid in enumerate(result):
        prev = result[ni - 1] if ni else None
        kept_entries.append({"id": rid, "hash": text_hash(texts[ni]), "text": texts[ni], "prev": prev})
        by_id.pop(rid, None)
    retired_entries = [e for e in by_id.values() if e.get("retired")]
    lock["sequences"][seq_key] = kept_entries + retired_entries
    return [r for r in result if r is not None], summary
