/**
 * Text normalization and tokenization for the dictation check. Pure (no browser APIs), unit-tested in
 * tests/dictationNormalize.test.ts. Rules: docs/dictation/06-answer-checking.md.
 *
 * The tokenizer is also the contract for the build-time word links (scripts/dictation/lib/linker.py): both use the
 * same word shape, so a link range always lines up with a token.
 */

export interface Token {
  text: string;               // as typed (after NFC), used for display offsets
  start: number;              // offsets in the normalized typed text
  end: number;
  kind: 'word' | 'punct';
  spaceBefore: boolean;       // whitespace directly before the token (false for the first token)
}

const DOUBLE_QUOTES = '„“”"«»';
const SINGLE_QUOTES = '‚‘’\'ʼ`';
const DASHES = '-–—';
const PUNCT_CHARS = `.,!?:;…()${DOUBLE_QUOTES}${SINGLE_QUOTES}${DASHES}`;

/** NFC, no-break spaces to spaces, line breaks to spaces. Whitespace runs are kept (spacing is checked per token). */
export function normalizeText(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[   ​]/g, ' ')
    .replace(/[\r\n\t]+/g, ' ');
}

/** Fold the glyph variants the keyboards cannot always type: quotes, apostrophes, dashes, three dots. */
export function foldToken(text: string): string {
  let out = '';
  for (const ch of text) {
    if (DOUBLE_QUOTES.includes(ch)) out += '"';
    else if (SINGLE_QUOTES.includes(ch)) out += "'";
    else if (DASHES.includes(ch)) out += '-';
    else out += ch;
  }
  return out.replace(/\.{3,}/g, '…');
}

export const isQuote = (ch: string) => DOUBLE_QUOTES.includes(ch);

// A word: letters or digits; inside it ’ ' - (geht’s, E-Mail) and, between digits, : , . (1:52, 3,5, 1.000)
const WORD = /[\p{L}\p{N}]+(?:(?:[’'ʼ-](?=[\p{L}\p{N}])|[:,.](?=\p{N})(?<=\p{N}[:,.]))[\p{L}\p{N}]+)*/uy;
const ELLIPSIS = /\.{3,}|…/y;

export function tokenize(raw: string): Token[] {
  const text = normalizeText(raw);
  const tokens: Token[] = [];
  let i = 0;
  let sawSpace = false;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) { sawSpace = true; i++; continue; }
    let token: Token | null = null;
    WORD.lastIndex = i;
    const w = WORD.exec(text);
    if (w) {
      token = { text: w[0], start: i, end: i + w[0].length, kind: 'word', spaceBefore: sawSpace && tokens.length > 0 };
    } else {
      ELLIPSIS.lastIndex = i;
      const e = ELLIPSIS.exec(text);
      if (e) token = { text: e[0], start: i, end: i + e[0].length, kind: 'punct', spaceBefore: sawSpace && tokens.length > 0 };
      else token = { text: ch, start: i, end: i + 1, kind: PUNCT_CHARS.includes(ch) ? 'punct' : 'word', spaceBefore: sawSpace && tokens.length > 0 };
    }
    tokens.push(token);
    i = token.end;
    sawSpace = false;
  }
  return tokens;
}

/** Number of double-quote glyphs (the submit trigger counts these; apostrophes and single quotes are not counted). */
export function countDoubleQuotes(text: string): number {
  let n = 0;
  for (const ch of text) if (DOUBLE_QUOTES.includes(ch)) n++;
  return n;
}
