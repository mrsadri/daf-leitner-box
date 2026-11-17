/**
 * The adjective declension drill: start screen (explanation + reference tables) -> a 5-minute round of
 * phrases -> end screen. Loaded lazily from LeitnerApp, like StoriesScreen.
 *
 * The timer runs off a fixed end time (Date.now() + 5 minutes), not accumulated ticks, so a background
 * tab never buys extra time. Feedback after a round never blocks the next one: "Next" and Enter always
 * move on, and speech is fired without waiting for it.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Trophy } from 'lucide-react';
import { Button, Card, Dialog, isDialogOpen } from '../../shared/ui';
import { De, Auto } from '../../shared/ui/Text';
import { useI18n } from '../../i18n/I18nProvider';
import { isDemoMode } from '../../shared/lib/demo';
import { speechService } from '../../shared/lib/speechService';
import {
  generateRound, declinePhrase, phraseText, roundContext,
  ARTICLE_ENDING_OPTIONS, ADJECTIVE_ENDING_OPTIONS, NOUN_ENDING_OPTIONS,
  type Round
} from './grammar';
import { EndingGroup } from './EndingGroup';
import { ReferenceTables } from './ReferenceTables';
import { startRun, queueFinish, flushQueue, updateLocalBest } from './drillSync';

const DURATION_MS = 5 * 60 * 1000;

type Phase = 'start' | 'running' | 'finished';
type RoundPhase = 'answering' | 'feedback';

interface Selections {
  article?: string;
  adjective?: string;
  noun?: string;
}

interface Mistake {
  context: string;
  correct: string;
  yours: string;
}

interface Props {
  userId: string;
  onRunningChange: (running: boolean) => void;
  onViewRecords: () => void;
}

function yourPhraseText(round: Round, sel: Selections): string {
  const parts: string[] = [];
  if (round.phrase.article) parts.push(round.phrase.article.prefix + (sel.article ?? ''));
  if (round.phrase.adjective) parts.push(round.phrase.adjective.prefix + (sel.adjective ?? ''));
  parts.push(round.phrase.noun.prefix + (sel.noun ?? ''));
  return parts.join(' ');
}

export default function DrillScreen({ userId, onRunningChange, onViewRecords }: Props) {
  const { t, num } = useI18n();
  const a = t.adjective;

  const [phase, setPhase] = useState<Phase>('start');
  const [round, setRound] = useState<Round>(() => generateRound());
  const [roundPhase, setRoundPhase] = useState<RoundPhase>('answering');
  const [selections, setSelections] = useState<Selections>({});
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [newRecord, setNewRecord] = useState(false);
  const [practice, setPractice] = useState(false);
  const [tick, setTick] = useState(0);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const endsAtRef = useRef(0);
  const runIdRef = useRef<string | null>(null);
  const scoreRef = useRef(0);
  const answeredRef = useRef(0);
  const mistakesRef = useRef<Mistake[]>([]);
  const finishedRef = useRef(false);

  const voiceAvailable = speechService.isSupported() && speechService.currentVoice() !== null;

  const doFinish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setPhase('finished');
    onRunningChange(false);
    let gotRecord = false;
    if (runIdRef.current) {
      queueFinish(userId, { id: runIdRef.current, score: scoreRef.current, answered: answeredRef.current });
      if (!isDemoMode) void flushQueue(userId);
      gotRecord = updateLocalBest(userId, scoreRef.current);
    }
    setNewRecord(gotRecord);
  };

  // Timer: ticks to re-render the clock; the actual deadline check uses the clock, not the tick count.
  useEffect(() => {
    if (phase !== 'running') return;
    const iv = setInterval(() => {
      setTick(x => x + 1);
      if (Date.now() >= endsAtRef.current) doFinish();
    }, 250);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // beforeunload warning while a run is in progress
  useEffect(() => {
    if (phase !== 'running') return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [phase]);

  const nextRound = () => {
    if (Date.now() >= endsAtRef.current) { doFinish(); return; }
    setRound(generateRound());
    setSelections({});
    setRoundPhase('answering');
  };

  // Enter always moves on from feedback, skipping any wait on speech or animation.
  useEffect(() => {
    if (phase !== 'running' || roundPhase !== 'feedback') return;
    const onKey = (e: KeyboardEvent) => {
      if (isDialogOpen()) return;
      if (e.key === 'Enter') { e.preventDefault(); nextRound(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, roundPhase]);

  // Score the round once every visible slot has an answer.
  useEffect(() => {
    if (phase !== 'running' || roundPhase !== 'answering') return;
    const needsArticle = round.phrase.article !== null;
    const needsAdjective = round.phrase.adjective !== null;
    if (needsArticle && selections.article === undefined) return;
    if (needsAdjective && selections.adjective === undefined) return;
    if (selections.noun === undefined) return;

    if (Date.now() >= endsAtRef.current) { doFinish(); return; }

    const correct =
      (!needsArticle || selections.article === round.phrase.article!.ending) &&
      (!needsAdjective || selections.adjective === round.phrase.adjective!.ending) &&
      selections.noun === round.phrase.noun.ending;

    answeredRef.current += 1;
    if (correct) {
      scoreRef.current += 1;
    } else {
      mistakesRef.current = [...mistakesRef.current, {
        context: roundContext(round),
        correct: phraseText(round.phrase),
        yours: yourPhraseText(round, selections)
      }];
    }
    setScore(scoreRef.current);
    setAnswered(answeredRef.current);
    setRoundPhase('feedback');
    if (speechService.currentVoice()) void speechService.speak(phraseText(round.phrase));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selections, roundPhase, phase]);

  const start = async () => {
    finishedRef.current = false;
    scoreRef.current = 0;
    answeredRef.current = 0;
    mistakesRef.current = [];
    setScore(0);
    setAnswered(0);
    setNewRecord(false);
    const id = await startRun();
    runIdRef.current = id;
    setPractice(!isDemoMode && id === null);
    endsAtRef.current = Date.now() + DURATION_MS;
    setRound(generateRound());
    setSelections({});
    setRoundPhase('answering');
    setPhase('running');
    onRunningChange(true);
  };

  const requestLeave = () => setConfirmLeave(true);
  const confirmedLeave = () => {
    setConfirmLeave(false);
    finishedRef.current = true;
    onRunningChange(false);
    setPhase('start');
  };

  // ----- Start -----
  if (phase === 'start') {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-12" data-testid="adjective-start">
        <header className="space-y-2">
          <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            <Trophy className="w-7 h-7 text-amber-500 shrink-0" />
            {a.start.title}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{a.start.body}</p>
        </header>
        <Card className="flex items-center justify-between gap-4">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{a.start.duration}</span>
          <Button onClick={() => void start()} data-testid="adjective-start-button">{a.start.startButton}</Button>
        </Card>
        {!voiceAvailable && (
          <p className="text-caption text-slate-500 dark:text-slate-400">{a.start.noVoice}</p>
        )}
        <ReferenceTables />
      </div>
    );
  }

  // ----- Finished -----
  if (phase === 'finished') {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-12" data-testid="adjective-finished">
        <Card className="text-center space-y-3">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{a.finished.title}</h1>
          {newRecord && <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{a.finished.newRecord}</p>}
          <p className="text-xl font-mono-num font-bold text-indigo-600 dark:text-indigo-400">{a.finished.scoreLine(score, answered)}</p>
          {practice && <p className="text-caption text-amber-700 dark:text-amber-400">{a.practiceBanner}</p>}
        </Card>

        <Card className="space-y-3">
          <h2 className="font-bold text-sm text-slate-900 dark:text-white">{a.finished.mistakesTitle}</h2>
          {mistakesRef.current.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">{a.finished.mistakesEmpty}</p>
          ) : (
            <ul className="space-y-3">
              {mistakesRef.current.map((m, i) => (
                <li key={i} className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-control space-y-1">
                  <De className="text-caption text-ink-soft block">{m.context}</De>
                  <p className="text-sm"><span className="text-slate-500 dark:text-slate-400">{a.finished.yourAnswer} </span><De className="text-red-600 dark:text-red-400">{m.yours}</De></p>
                  <p className="text-sm"><span className="text-slate-500 dark:text-slate-400">{a.finished.correctAnswer} </span><De className="text-emerald-700 dark:text-emerald-400 font-semibold">{m.correct}</De></p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setPhase('start')} data-testid="adjective-again">{a.finished.again}</Button>
          <Button variant="secondary" onClick={onViewRecords}>{a.finished.viewRecords}</Button>
        </div>
      </div>
    );
  }

  // ----- Running -----
  const remaining = Math.max(0, endsAtRef.current - Date.now());
  const seconds = Math.ceil(remaining / 1000);
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  void tick; // re-render driver for the clock above

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12" data-testid="adjective-running">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" icon={<ChevronLeft className="w-4 h-4 rtl:rotate-180" />} onClick={requestLeave}>
          {t.common.back}
        </Button>
        <div className="flex items-center gap-4">
          <span className="font-mono-num text-lg font-bold text-slate-900 dark:text-white" dir="ltr">{mm}:{ss}</span>
          <span className="font-mono-num text-sm font-semibold text-indigo-600 dark:text-indigo-400">{num(score)}/{num(answered)}</span>
        </div>
      </div>

      {practice && <p className="text-caption text-amber-700 dark:text-amber-400">{a.practiceBanner}</p>}

      <Card className={`space-y-4 gender-${round.number === 'pl' ? 'pl' : round.gender}`}>
        <De className="text-caption text-ink-soft block">{roundContext(round)}</De>
        <div className="flex flex-wrap items-end gap-5">
          {round.phrase.article && (
            <EndingGroup
              label={a.slot.article}
              prefix={round.phrase.article.prefix}
              options={ARTICLE_ENDING_OPTIONS[round.articleType]}
              value={selections.article ?? null}
              correct={round.phrase.article.ending}
              disabled={roundPhase === 'feedback'}
              onSelect={e => setSelections(s => ({ ...s, article: e }))}
            />
          )}
          {round.phrase.adjective && (
            <EndingGroup
              label={a.slot.adjective}
              prefix={round.phrase.adjective.prefix}
              options={ADJECTIVE_ENDING_OPTIONS}
              value={selections.adjective ?? null}
              correct={round.phrase.adjective.ending}
              disabled={roundPhase === 'feedback'}
              onSelect={e => setSelections(s => ({ ...s, adjective: e }))}
            />
          )}
          <EndingGroup
            label={a.slot.noun}
            prefix={round.phrase.noun.prefix}
            options={NOUN_ENDING_OPTIONS}
            value={selections.noun ?? null}
            correct={round.phrase.noun.ending}
            disabled={roundPhase === 'feedback'}
            onSelect={e => setSelections(s => ({ ...s, noun: e }))}
          />
        </div>

        {roundPhase === 'feedback' && (
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Auto className="text-sm text-slate-600 dark:text-slate-400">
              <De className="font-semibold">{phraseText(declinePhrase(round))}</De>
            </Auto>
            <Button onClick={nextRound} data-testid="adjective-next">{a.next}</Button>
          </div>
        )}
      </Card>

      {confirmLeave && (
        <Dialog
          onClose={() => setConfirmLeave(false)}
          title={a.leaveConfirm.title}
          description={a.leaveConfirm.body}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmLeave(false)}>{a.leaveConfirm.cancel}</Button>
              <Button variant="danger" onClick={confirmedLeave}>{a.leaveConfirm.confirm}</Button>
            </>
          }
        />
      )}
    </div>
  );
}
