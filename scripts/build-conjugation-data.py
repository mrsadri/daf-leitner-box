#!/usr/bin/env python3
"""
Adds the columns the conjugation popup needs (see docs/conjugation-filter-plan.md), for every verb:

  Infinitiv    clean infinitive without sich / prepositions / notes: "mitfahren", "freuen", "Ski fahren"
  Präsens      3rd person singular, without the reflexive pronoun: "fährt mit", "stellt vor"
  Präteritum   3rd person singular when it can't be derived by the regular rule: "fuhr mit", "brachte"
               (empty = regular; tests/conjugation-data.test.ts checks that such verbs really are regular)
  Reflexiv     "akk", "dat", "akk?" (optional sich) or empty

Sources, in order: scripts/data/conjugation-overrides.json, the Formen column, and for compounds the
Präteritum of their base verb elsewhere in the list (mitfahren ← fahren).
Safe to re-run. Usage: python3 scripts/build-conjugation-data.py
"""
import csv, io, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / 'public/data/wortschatz-daf-kompakt.csv'
OVERRIDES = {k: v for k, v in json.loads((ROOT / 'scripts/data/conjugation-overrides.json').read_text(encoding='utf-8')).items() if not k.startswith('_')}

PERSIAN = re.compile(r'[؀-ۿ]')
PREPOSITIONS = r'(?:an|auf|aus|bei|für|in|mit|nach|über|um|von|vor|zu|als|gegen|nach)'


def clean_infinitive(wort: str) -> str:
    w = wort
    w = re.sub(r'\([^)]*\)', ' ', w)                  # (sich), (Geld), (ugs.)
    w = w.split(' / ')[0]                               # "herumlaufen / rumlaufen"
    w = re.sub(r',.*$', '', w)                          # "stecken, in + A / D"
    w = re.sub(rf'\s+{PREPOSITIONS}\s*\+.*$', '', w)    # "freuen auf + Akk"
    w = re.sub(r'\s*\+.*$', '', w)                      # "danken + Dat"
    w = re.sub(r'(?<!\S)(sich|jdn\.|jdm\.|etw\.)(?=\s|$)', ' ', w)   # whole words only (not "sichern")
    w = re.sub(rf'\s+({PREPOSITIONS}|etwas)\s*$', '', w.strip())   # "dienen als", "angeben etwas"
    return re.sub(r'\s+', ' ', w).strip()


def clean_form(seg: str) -> str:
    s = re.sub(r'^(Wo\?|Wohin\?)\s*', '', seg.strip())
    s = re.sub(r'^es\s+', '', s)
    s = re.sub(r'\((sich|ein)\)', ' ', s)
    s = re.sub(r'\([^)]*\)', ' ', s)
    s = re.sub(r'\s*\+.*$', '', s)
    s = s.split(' / ')[0]
    s = re.sub(r'\bsich\b', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


def reflexive(wort: str, formen: str, perfekt: str) -> str:
    answers = [a.strip() for a in perfekt.split('|')]
    with_sich = [a for a in answers if ' sich ' in f' {a} ']
    if not with_sich and not re.search(r'\bsich\b', wort):
        return ''
    case = 'dat' if re.search(r'reflexiv \(Dat\)|sich \(D\)|·\s*Dat\b|mit Dativ', formen) else 'akk'
    # Optional when the Perfekt is also accepted without sich ("hat sich verändert | hat verändert")
    return case + '?' if len(with_sich) < len(answers) else case


raw = CSV_PATH.read_bytes()
crlf = b'\r\n' in raw
rows = list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))))
header = list(rows[0].keys())
for col in ('Infinitiv', 'Präsens', 'Präteritum', 'Reflexiv'):
    if col not in header:
        header.append(col)

verbs = [r for r in rows if r['Wortart'] == 'Verb' and r.get('Perfekt')]
for r in rows:
    for col in ('Infinitiv', 'Präsens', 'Präteritum', 'Reflexiv'):
        r.setdefault(col, '')

problems = []
for r in verbs:
    key = f"{r['Lektion']}/{r['Nr']}"
    o = OVERRIDES.get(key, {})
    segs = [s.strip() for s in re.split(r'[·|]', r['Formen']) if s.strip()]
    finite = []
    for s in segs:
        if re.match(r'^(es\s+)?(hat|ist)\b', s) or PERSIAN.search(s) or s in ('trennbar', 'untrennbar'):
            break
        finite.append(clean_form(s))
    r['Infinitiv'] = o.get('Infinitiv', clean_infinitive(r['Wort']))
    r['Präsens'] = o.get('Präsens', finite[0] if finite else '')
    r['Präteritum'] = o.get('Präteritum', finite[1] if len(finite) > 1 else '')
    r['Reflexiv'] = o.get('Reflexiv', reflexive(r['Wort'], r['Formen'], r['Perfekt']))
    if not r['Präsens']:
        problems.append(f'{key} {r["Wort"]!r}: no Präsens')

# Compounds without a Präteritum: borrow it from the base verb ("mitfahren" ← "fahren": "fuhr" → "fuhr mit")
by_inf = {r['Infinitiv']: r for r in verbs if r['Präteritum']}
for r in verbs:
    if r['Präteritum']:
        continue
    parts = r['Präsens'].split(' ')
    particle = ' '.join(parts[1:])
    inf = r['Infinitiv'].replace(' ', '')
    if not particle:
        continue
    base_inf = inf[len(particle.replace(' ', '')):] if inf.startswith(particle.replace(' ', '')) else ''
    base = by_inf.get(base_inf)
    if base:
        r['Präteritum'] = f"{base['Präteritum'].split(' ')[0]} {particle}"

if problems:
    sys.exit('\n'.join(problems))

buf = io.StringIO()
writer = csv.DictWriter(buf, fieldnames=header, lineterminator='\r\n' if crlf else '\n')
writer.writeheader()
writer.writerows(rows)
with open(CSV_PATH, 'w', encoding='utf-8-sig', newline='') as f:
    f.write(buf.getvalue())
print(f'verbs: {len(verbs)} · with explicit Präteritum: {sum(1 for r in verbs if r["Präteritum"])} · reflexive: {sum(1 for r in verbs if r["Reflexiv"])}')
