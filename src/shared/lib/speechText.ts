/** Preserve all German alternatives, with a pause at punctuation, and omit the translation. */
export function speechText(text: string): string {
  return text.split('·')[0].replace(/\s*[/,;()]\s*/g, ', ').replace(/[,\s]+$/g, '').trim();
}
