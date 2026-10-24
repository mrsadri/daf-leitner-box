import { LeitnerCard } from '../types/leitner';
import { toLocalDateString } from './dates';

/**
 * RFC 4180 CSV parser (quoted fields may contain commas, quotes and line breaks).
 *
 * The previous version stripped the quotes while splitting lines and then split each line
 * on commas again, so a quoted field containing a comma (e.g. "October 23, 2026 8:32 PM")
 * became two fields and every following column shifted by one.
 */
export function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let insideQuotes = false;

  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (insideQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++; // escaped quote
        } else {
          insideQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      insideQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[i + 1] === '\n') i++; // CRLF
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter(r => r.some(v => v.trim()));
  if (nonEmpty.length < 2) return [];

  const headers = nonEmpty[0].map(h => h.trim());
  return nonEmpty.slice(1).map(values => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = (values[index] || '').trim();
    });
    return record;
  });
}

export function transformCsvToCards(records: Record<string, string>[]): LeitnerCard[] {
  const todayStr = toLocalDateString(new Date());

  return records.map((r, idx) => {
    const wort = r['Wort'] || '';
    const persisch = r['Persisch'] || '';
    const artikel = r['Artikel'] || '–';
    const lektion = r['Lektion'] || '01';
    const nr = r['Nr'] || String(idx + 1);

    // Extract clean article if not separated
    let cleanArtikel = artikel;
    if (cleanArtikel === '–' || !cleanArtikel) {
      if (wort.startsWith('der ')) cleanArtikel = 'der';
      else if (wort.startsWith('die ')) cleanArtikel = 'die';
      else if (wort.startsWith('das ')) cleanArtikel = 'das';
    }

    // Lektion + Nr is unique in the book, so the id stays stable even if the CSV rows are reordered.
    // (The old id also contained the row index, which orphaned users' progress whenever the CSV changed.)
    const id = r['Nr'] ? `daf_${lektion}_${nr}` : `daf_${lektion}_${wort.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '')}_${idx}`;

    return {
      id,
      type: 'vocab',
      box: 0, // initially in Box 0 when added
      lastReviewedAt: null,
      nextReviewDate: todayStr,
      createdAt: new Date().toISOString(),
      reviewCount: 0,
      correctCount: 0,
      wrongCount: 0,

      wort,
      persisch,
      artikel: cleanArtikel,
      beispiel: r['Beispiel'] || '',
      formen: r['Formen'] || '',
      plural: r['Plural'] || '',
      wortart: r['Wortart'] || '',
      oesterreich: r['Österreich'] || '',
      lektion,
      niveau: r['Niveau'] || 'A1',
      nr,
      feld: r['Feld'] || ''
    };
  });
}
