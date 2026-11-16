import React from 'react';
import { Headphones, Volume2 } from 'lucide-react';
import type { AppSettings } from '../../types/leitner';
import { useI18n } from '../../i18n/I18nProvider';
import { speechService } from '../../services/speechService';
import { audioController } from '../../services/dictation/audioController';
import { browserSources, hasGermanVoice } from '../../services/dictation/browserSources';
import { STORY_MEDIA_BASE } from '../../config';
import { BetaBadge } from './BetaBadge';

interface Props {
  settings: AppSettings;
  onUpdateSettings: (s: Partial<AppSettings>) => void;
  cardClass: string;
  titleClass: string;
}

/** Settings > story dictation: the learner chooses between the natural Piper voices (B) and the device voice (C). */
export const AudioModeSettings: React.FC<Props> = ({ settings, onUpdateSettings, cardClass, titleClass }) => {
  const { t } = useI18n();
  const mode = settings.dictationAudioMode ?? 'B';
  const options: { id: 'B' | 'C'; title: string; body: string }[] = [
    { id: 'B', title: t.dictation.settings.modeB, body: t.dictation.settings.modeBBody },
    { id: 'C', title: t.dictation.settings.modeC, body: t.dictation.settings.modeCBody },
  ];

  const test = async () => {
    audioController.stop();
    const ctrl = new AbortController();
    const sample = { id: 'test', hash: '', text: 'Guten Tag! Wie geht es Ihnen?', speaker: 'NARRATOR', endMark: '?' as const, quoteBalance: 0, flags: [], links: [], grammar: [] };
    if (mode === 'C') await browserSources.speak(sample, settings.speechRate, ctrl.signal).catch(() => undefined);
    else await browserSources.playFile(`${STORY_MEDIA_BASE}/audio/B/test.mp3`, settings.speechRate, ctrl.signal).catch(() => speechService.speak(sample.text, settings.speechRate));
  };

  return (
    <div className={cardClass}>
      <h2 className={titleClass}>
        <Headphones className="w-5 h-5 text-indigo-600 shrink-0" />
        <span>{t.dictation.settings.title} <BetaBadge /></span>
      </h2>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">{t.dictation.settings.mode}</legend>
        {options.map(o => (
          <label key={o.id} className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer min-h-11 ${mode === o.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
            <input type="radio" name="dictation-audio-mode" value={o.id} checked={mode === o.id} onChange={() => onUpdateSettings({ dictationAudioMode: o.id })} className="mt-1 accent-indigo-600" />
            <span>
              <span className="block text-sm font-semibold text-slate-900 dark:text-white">{o.title}</span>
              <span className="block text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{o.body}</span>
              {o.id === 'C' && !hasGermanVoice() && <span className="block text-xs text-amber-700 dark:text-amber-300 mt-1">{t.dictation.settings.noGermanVoice}</span>}
            </span>
          </label>
        ))}
      </fieldset>
      {mode === 'C' && (
        <button type="button" onClick={() => void test()} className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 min-h-11 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-semibold">
          <Volume2 className="w-4 h-4" />{t.dictation.settings.test}
        </button>
      )}
      <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{t.dictation.settings.credit}</p>
    </div>
  );
};
