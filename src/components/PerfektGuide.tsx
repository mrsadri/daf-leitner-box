import React from 'react';
import { Lightbulb } from 'lucide-react';
import type { PerfektGuide as Guide, SegmentPart } from '../services/perfektGuide';
import { diffSegments } from '../services/conjugation';
import { useI18n } from '../i18n/I18nProvider';

const PART_STYLE: Record<SegmentPart, string> = {
  prefix: 'bg-violet-100 text-violet-800 dark:bg-violet-950/70 dark:text-violet-200',
  ge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-200',
  stem: 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white',
  ending: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200'
};

/** Rule for the prefix type, or null for a plain ge- verb. */
function usePrefixRule(guide: Guide): string | null {
  const g = useI18n().t.perfektGuide;
  switch (guide.prefix) {
    case 'separable': return g.separable(guide.separable);
    case 'inseparable': return guide.separable ? g.sepInsep(guide.separable, guide.inseparable) : g.inseparable(guide.inseparable);
    case 'ieren': return guide.separable ? g.sepIeren(guide.separable) : g.ieren;
    case 'phrase': return g.phrase(guide.separable);
    case 'unstressed': return g.unstressed;
    default: return null;
  }
}

/** "an + ge + [stem] + en": the verb's own prefixes and ending, with the stem left open. */
const Formula: React.FC<{ guide: Guide }> = ({ guide }) => {
  const { t, lang } = useI18n();
  return (
    <span dir="ltr" className="inline-flex flex-wrap items-center gap-1 align-middle">
      {guide.segments.map((s, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-slate-400">+</span>}
          {s.part === 'stem'
            ? <span lang={lang} className={`px-1 rounded ${PART_STYLE.stem} font-normal italic`}>{t.perfektGuide.parts.stem}</span>
            : <span lang="de" className={`px-1 rounded font-bold ${PART_STYLE[s.part]}`}>{s.text.trim()}</span>}
        </React.Fragment>
      ))}
    </span>
  );
};

/** Before answering: group, pattern and prefix rule; neither the participle's stem nor the auxiliary. */
export const PerfektHint: React.FC<{ guide: Guide }> = ({ guide }) => {
  const g = useI18n().t.perfektGuide;
  const prefixRule = usePrefixRule(guide);
  return (
    <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 text-xs text-amber-950 dark:text-amber-100 space-y-1.5 leading-relaxed" data-testid="perfekt-hint">
      <p className="flex items-center gap-1.5 font-bold">
        <Lightbulb className="w-4 h-4 text-amber-600 shrink-0" />
        {g.hintTitle}
      </p>
      <p><span className="font-semibold">{g.group}</span> {g.groups[guide.group]}. {g.groupDesc[guide.group]}</p>
      <p><span className="font-semibold">{g.formula}</span> <Formula guide={guide} /></p>
      {prefixRule && <p>{prefixRule}</p>}
      {guide.endingEt && <p>{g.endingEt}</p>}
    </div>
  );
};

/** After answering (and on the new-words card): the participle in parts, the group, and why haben/sein. */
export const PerfektExplanation: React.FC<{ guide: Guide; bare?: boolean }> = ({ guide, bare = false }) => {
  const { t, lang } = useI18n();
  const g = t.perfektGuide;
  const prefixRule = usePrefixRule(guide);

  return (
    <div
      className={`space-y-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed ${bare ? '' : 'p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800'}`}
      data-testid="perfekt-explanation"
    >
      {!bare && <p className="font-bold text-slate-900 dark:text-white">{g.explainTitle}</p>}

      {/* The participle in its parts; letters of the stem that changed in red */}
      <div dir="ltr" className="flex flex-wrap items-end gap-1">
        {guide.segments.map((s, i) => (
          <span key={i} className="flex flex-col items-center gap-0.5">
            <span lang="de" className={`px-1.5 py-0.5 rounded-md text-sm font-bold ${PART_STYLE[s.part]}`}>
              {s.part === 'stem' && guide.stemChanged
                ? diffSegments(s.text, guide.infinitiveStem).map((d, k) => (
                    <span key={k} className={d.irregular ? 'text-red-600 dark:text-red-400' : undefined}>{d.text}</span>
                  ))
                : s.text.trim()}
            </span>
            <span lang={lang} className="text-[10px] text-slate-500 dark:text-slate-400">{g.parts[s.part]}</span>
          </span>
        ))}
      </div>

      <p><span className="font-semibold">{g.group}</span> {g.groups[guide.group]}. {g.groupDesc[guide.group]}</p>
      {prefixRule && <p>{prefixRule}</p>}
      {guide.endingEt && <p>{g.endingEt}</p>}
      {guide.stemChanged && <p>{g.stemChanged(guide.infinitiveStem, guide.participleStem)}</p>}
      <p><span className="font-semibold">{g.auxTitle}</span> {g.aux[guide.auxReason]}</p>
    </div>
  );
};
