#!/usr/bin/env python3
"""
One-off data step for the Perfekt quiz (see docs/plural-perfekt-plan.md):

1. Splits multi-verb cards into one card per verb (scripts/data/verb-splits.json).
   The first verb keeps the original row, so its card id daf_<Lektion>_<Nr> and every
   user's progress on it stay the same; further verbs get Nr + b, c, d (new ids).
2. Adds a `Perfekt` column for verbs: read from `Formen` when it holds exactly one simple
   "hat …" / "ist …", otherwise from scripts/data/perfekt-overrides.json.

Safe to re-run: rows that were already split are recognised by their Nr suffix.
Usage: python3 scripts/build-verb-data.py
"""
import csv, io, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / 'public/data/wortschatz-daf-kompakt.csv'
SPLITS = json.loads((ROOT / 'scripts/data/verb-splits.json').read_text(encoding='utf-8'))
OVERRIDES = json.loads((ROOT / 'scripts/data/perfekt-overrides.json').read_text(encoding='utf-8'))
SPLITS = {k: v for k, v in SPLITS.items() if not k.startswith('_')}
OVERRIDES = {k: v for k, v in OVERRIDES.items() if not k.startswith('_')}

SIMPLE = re.compile(r'^(hat|ist) (ge\w+|\w+t|\w+en)$')

raw = CSV_PATH.read_bytes()
crlf = b'\r\n' in raw
rows = list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))))
header = list(rows[0].keys())
if 'Perfekt' not in header:
    header.append('Perfekt')

key = lambda r: f"{r['Lektion']}/{r['Nr']}"
existing_ids = {key(r) for r in rows}
SUFFIX = 'bcdefg'

out = []
for r in rows:
    k = key(r)
    already_split = f'{k}b' in existing_ids
    if k in SPLITS and not already_split:
        parts = SPLITS[k]
        for n, part in enumerate(parts):
            new = dict(r) if n == 0 else {h: '' for h in header} | {
                h: r[h] for h in ('Artikel', 'Created time', 'Feld', 'Lektion', 'Niveau', 'Wortart')
            }
            if n > 0:
                new['Nr'] = f"{r['Nr']}{SUFFIX[n - 1]}"
                if key(new) in existing_ids:
                    sys.exit(f'id clash: {key(new)}')
            for field in ('Wort', 'Persisch', 'Englisch', 'Formen', 'Perfekt'):
                new[field] = part[field]
            new['Formen_en'] = part.get('Formen_en', '')
            new['Plural'] = ''
            if not part.get('keepExample'):
                new['Beispiel'] = new['Beispiel_en'] = ''
            elif n > 0:
                new['Beispiel'], new['Beispiel_en'] = r['Beispiel'], r['Beispiel_en']
            if not part.get('keepAustria'):
                new['Österreich'] = new['Österreich_en'] = ''
            elif n > 0:
                new['Österreich'], new['Österreich_en'] = r['Österreich'], r['Österreich_en']
            out.append(new)
        continue

    r.setdefault('Perfekt', '')
    if k in OVERRIDES:
        r['Perfekt'] = OVERRIDES[k]
    elif r['Wortart'] == 'Verb' and not r['Perfekt'] and not already_split:
        segs = [s.strip() for s in re.split(r'[·|]', r['Formen'])]
        perf = [s for s in segs if re.match(r'^(hat|ist)\b', s)]
        if len(perf) == 1 and SIMPLE.match(perf[0]):
            r['Perfekt'] = perf[0]
        else:
            sys.exit(f'no Perfekt for {k} {r["Wort"]!r}: add it to perfekt-overrides.json')
    # Data typo
    r['Formen'] = r['Formen'].replace('einggeräumt', 'eingeräumt')
    out.append(r)

buf = io.StringIO()
writer = csv.DictWriter(buf, fieldnames=header, lineterminator='\r\n' if crlf else '\n')
writer.writeheader()
writer.writerows(out)
with open(CSV_PATH, 'w', encoding='utf-8-sig', newline='') as f:
    f.write(buf.getvalue())

verbs = [r for r in out if r['Wortart'] == 'Verb']
print(f'rows: {len(rows)} -> {len(out)} · verbs: {len(verbs)} · with Perfekt: {sum(1 for r in verbs if r["Perfekt"])}')
