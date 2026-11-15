/**
 * Auto-submit trigger for the dictation input (docs/dictation/06-answer-checking.md, "Submission trigger").
 * Pure: the component passes what the `input` event told it. The Check button and Enter always submit; this is only a
 * convenience, so a false trigger is harmless (resubmitting is free).
 */
import { countDoubleQuotes, isQuote } from './normalize.ts';

const TERMINAL = '.!?…';

export interface TriggerInput {
  /** InputEvent.inputType, for example 'insertText', 'insertFromPaste'. */
  inputType: string;
  /** The text the event inserted (InputEvent.data); null when unknown. */
  inserted: string | null;
  /** The textarea value after the event. */
  value: string;
  caretAtEnd: boolean;
  /** Between compositionstart and compositionend (IME). */
  composing: boolean;
  expected: {
    text: string;
    quoteBalance: number;         // opening minus closing double quotes in the expected sentence
    flags?: readonly string[];    // 'endsDigitDot' ...
  };
  /** content/dictation/abbreviations.json, without the final period ("Tel", "z. B"). */
  abbreviations: readonly string[];
}

const stripClosers = (s: string) => s.replace(/[“”‘’»)"'\s]+$/, '');

/** True when the period at the end of `value` belongs to a known abbreviation or an initial, and the expected sentence does not end there. */
function isAbbreviationDot(value: string, expectedText: string, abbreviations: readonly string[]): boolean {
  const body = value.slice(0, -1);
  const expectedBody = stripClosers(expectedText);
  for (const abbr of abbreviations) {
    if (body.endsWith(abbr) && (body.length === abbr.length || !/[\p{L}\p{N}]/u.test(body[body.length - abbr.length - 1]))) {
      return !expectedBody.endsWith(abbr + '.');
    }
  }
  // a single letter ("H.", the "z." of "z. B.") is an initial or part of an abbreviation
  const m = /(?:^|[\s„“"(])(\p{L})$/u.exec(body);
  if (m) return !expectedBody.endsWith(m[1] + '.');
  return false;
}

export function shouldSubmit(input: TriggerInput): boolean {
  const { inputType, inserted, value, caretAtEnd, composing, expected, abbreviations } = input;
  if (composing || !caretAtEnd) return false;
  if (inputType !== 'insertText' && inputType !== 'insertReplacementText') return false;   // paste, drop, IME never submit
  if (!value.trim()) return false;
  if (!inserted) return false;

  const last = value[value.length - 1];
  const insertedLast = inserted[inserted.length - 1];
  if (last !== insertedLast) return false;                     // the caret is at the end, so this must hold

  let closingAfterMark = false;
  if (isQuote(last)) {
    // a double quote directly after a terminal mark closes a sentence such as „Danke!“
    const before = value[value.length - 2];
    if (!before || !TERMINAL.includes(before)) return false;
    // only when the expected sentence itself ends with this quote; „Wie geht’s?“, fragt Lucía. continues after it
    if (!isQuote(expected.text.trimEnd().slice(-1))) return false;
    closingAfterMark = true;
  } else if (!TERMINAL.includes(last)) {
    return false;
  }

  // quote balance: the typed count must have the parity the expected sentence itself ends with
  const parity = Math.abs(expected.quoteBalance) % 2;
  if (countDoubleQuotes(value) % 2 !== parity) return false;

  // the mark itself, when it is not a closing quote
  if (!closingAfterMark) {
    if (last === '.') {
      // "..." counts once, on the third dot; two dots wait for the third
      if (/(?<!\.)\.\.$/.test(value)) return false;
      if (/\.{3}$/.test(value)) return !/\.{4}$/.test(value);
      if (/\d\.$/.test(value)) return false;                   // ordinal or sentence ending in digits plus period (S9, S10)
      if (isAbbreviationDot(value, expected.text, abbreviations)) return false;
    }
  }
  return true;
}

/** Hint for sentences whose last period cannot auto-submit. */
export const needsManualSubmitHint = (flags: readonly string[] | undefined) => !!flags?.includes('endsDigitDot');
