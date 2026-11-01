import React from 'react';
import { useI18n } from '../../i18n/I18nProvider';

/**
 * Onboarding illustrations: thiings.co 3D icons and small chips, each a separate animated layer
 * (keyframes in index.css, `.ob-*`). The composition is mirrored for nobody: it reads the same in both languages.
 * Decorative only (aria-hidden); the slide text says everything.
 */

interface LayerProps {
  /** Centre of the layer, in % of the stage */
  x: number;
  y: number;
  /** Width in % of the stage (height follows the content) */
  w: number;
  /** Entrance keyframes (ob-pop, ob-rise, ob-drop, ob-from-side, ob-grow) */
  enter?: string;
  /** Idle loop keyframes (ob-float, ob-bob, ob-ring, ob-glow, ob-swing, ob-flicker, ob-twinkle, ob-hop, ob-breathe) */
  idle?: string;
  delay?: number;
  dur?: number;
  origin?: string;
  from?: string;
  z?: number;
  children: React.ReactNode;
}

const Layer: React.FC<LayerProps> = ({ x, y, w, enter = 'ob-pop', idle, delay = 0, dur = 4, origin, from, z, children }) => (
  <div className="ob-l" style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, zIndex: z }}>
    <div className="ob-in" style={{ '--ob-in': enter, '--d': `${delay}s`, '--from': from } as React.CSSProperties}>
      <div className="ob-idle" style={{ '--ob-idle': idle ?? 'none', '--d': `${delay}s`, '--dur': `${dur}s`, '--origin': origin } as React.CSSProperties}>
        {children}
      </div>
    </div>
  </div>
);

const Img: React.FC<{ name: string; className?: string }> = ({ name, className = '' }) => (
  <img src={`/icons3d/${name}.webp`} alt="" draggable={false} decoding="async" className={`block w-full h-auto select-none pointer-events-none drop-shadow-md ${className}`} />
);

const Blob: React.FC<{ className: string }> = ({ className }) => (
  <Layer x={50} y={52} w={84} enter="ob-grow" z={0}>
    <div className={`w-full aspect-square rounded-full ${className}`} />
  </Layer>
);

const Chip: React.FC<{ children: React.ReactNode; className?: string; lang?: string }> = ({ children, className = '', lang }) => (
  <span lang={lang} dir="ltr" className={`inline-flex items-center justify-center w-full px-1 py-[0.3em] rounded-xl border-2 bg-white dark:bg-slate-900 shadow-md font-bold whitespace-nowrap ${className}`}>
    {children}
  </span>
);

const Sparkle: React.FC<{ x: number; y: number; w: number; delay: number }> = ({ x, y, w, delay }) => (
  <Layer x={x} y={y} w={w} enter="ob-grow" idle="ob-twinkle" delay={delay} dur={2.4} z={3}>
    <svg viewBox="0 0 24 24" className="w-full h-auto text-amber-400"><path fill="currentColor" d="M12 0c.8 6.4 5.6 11.2 12 12-6.4.8-11.2 5.6-12 12-.8-6.4-5.6-11.2-12-12C6.4 11.2 11.2 6.4 12 0z" /></svg>
  </Layer>
);

const stageText = 'text-[clamp(9px,3.4cqw,13px)]';

/** 1. Leitner: word cards fly in an arc into the filing cabinet; the alarm clock rings, the bulb glows. */
export const LeitnerIllustration: React.FC = () => {
  const { t } = useI18n();
  const cards = [
    { days: 1, x0: '-46cqw', y0: '-34cqw', x1: '-24cqw', y1: '-40cqw', d: 1.0 },
    { days: 2, x0: '46cqw', y0: '-30cqw', x1: '22cqw', y1: '-40cqw', d: 2.2 },
    { days: 4, x0: '-44cqw', y0: '10cqw', x1: '-30cqw', y1: '-26cqw', d: 3.4 },
    { days: 8, x0: '44cqw', y0: '12cqw', x1: '30cqw', y1: '-24cqw', d: 4.6 }
  ];
  return (
    <>
      <Blob className="bg-indigo-100 dark:bg-indigo-400/15" />
      <Layer x={50} y={58} w={56} enter="ob-rise" idle="ob-float" delay={0.1} dur={5} z={2}>
        <Img name="filing-cabinet-lg" />
      </Layer>
      {/* Cards land in the top drawer */}
      {cards.map(c => (
        <div key={c.days} className="ob-l" style={{ left: '50%', top: '43%', width: '24%', zIndex: 3 }}>
          <div
            className="ob-fly"
            style={{ '--x0': c.x0, '--y0': c.y0, '--x1': c.x1, '--y1': c.y1, '--d': `${c.d}s` } as React.CSSProperties}
          >
            <span className={`flex flex-col items-center w-full rounded-lg border-2 border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 shadow-lg overflow-hidden ${stageText}`}>
              <span className="block w-full h-[0.45em] bg-indigo-500" />
              <span dir="auto" className="py-[0.35em] font-bold text-indigo-700 dark:text-indigo-300 whitespace-nowrap">{t.common.day(c.days)}</span>
            </span>
          </div>
        </div>
      ))}
      <Layer x={81} y={21} w={25} enter="ob-drop" idle="ob-ring" delay={0.45} dur={3.2} origin="50% 15%" z={4}>
        <Img name="alarm-clock" />
      </Layer>
      <Layer x={19} y={23} w={20} idle="ob-glow" delay={0.6} dur={2.8} z={4}>
        <Img name="lightbulb" />
      </Layer>
      <Layer x={20} y={82} w={20} idle="ob-float" delay={0.8} dur={4.5} z={4}>
        <Chip className={`border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-mono-num text-[clamp(12px,5cqw,18px)]`}><span>2<sup className="text-[0.6em] ms-[0.05em] -top-[0.55em]">n</sup></span></Chip>
      </Layer>
    </>
  );
};

/** 2. A1–B1: der / die / das pop out of the book, the Perfekt slides in, the graduation cap lands on the book. */
export const WordsIllustration: React.FC = () => (
  <>
    <Blob className="bg-emerald-100 dark:bg-emerald-400/10" />
    <Layer x={50} y={60} w={58} enter="ob-rise" idle="ob-float" delay={0.1} dur={5} z={2}>
      <Img name="book-lg" />
    </Layer>
    <Layer x={70} y={33} w={27} enter="ob-drop" idle="ob-bob" delay={0.55} dur={4.5} z={4}>
      <Img name="graduation-cap" />
    </Layer>
    {([
      { art: 'der', x: 18, y: 26, d: 0.8, dur: 3.6, cls: 'border-blue-300 dark:border-blue-800 text-blue-600 dark:text-blue-400' },
      { art: 'die', x: 42, y: 14, d: 0.95, dur: 4.1, cls: 'border-red-300 dark:border-red-800 text-red-600 dark:text-red-400' },
      { art: 'das', x: 22, y: 50, d: 1.1, dur: 4.6, cls: 'border-emerald-300 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400' }
    ] as const).map(a => (
      <Layer key={a.art} x={a.x} y={a.y} w={19} idle="ob-float" delay={a.d} dur={a.dur} z={5}>
        <Chip lang="de" className={`${a.cls} text-[clamp(11px,4.4cqw,16px)]`}>{a.art}</Chip>
      </Layer>
    ))}
    <Layer x={27} y={88} w={36} enter="ob-from-side" from="-70%" idle="ob-float" delay={1.3} dur={4.2} z={5}>
      <Chip lang="de" className={`border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 ${stageText}`}>hat gelernt</Chip>
    </Layer>
    <Layer x={77} y={88} w={30} enter="ob-from-side" from="70%" idle="ob-float" delay={1.5} dur={4.8} z={5}>
      <Chip className={`border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-mono-num ${stageText}`}>A1 → B1</Chip>
    </Layer>
  </>
);

/** 3. Competition: "You" overtakes in a mini leaderboard; the medal swings, the bell rings, the flame flickers. */
export const CompetitionIllustration: React.FC = () => {
  const { t } = useI18n();
  return (
    <>
      <Blob className="bg-amber-100 dark:bg-amber-400/10" />
      <Layer x={50} y={40} w={46} idle="ob-breathe" delay={0.1} dur={4} z={2}>
        <Img name="trophy-lg" />
      </Layer>
      <Sparkle x={29} y={20} w={8} delay={0.9} />
      <Sparkle x={70} y={12} w={6} delay={1.5} />
      <Sparkle x={69} y={50} w={7} delay={2.1} />
      <Layer x={84} y={22} w={21} enter="ob-drop" idle="ob-swing" delay={0.5} dur={3} origin="50% 0%" z={4}>
        <Img name="silver-medal" />
      </Layer>
      <Layer x={15} y={44} w={18} idle="ob-ring" delay={0.65} dur={3.6} origin="50% 12%" z={4}>
        <Img name="bell" />
      </Layer>
      <Layer x={85} y={57} w={15} idle="ob-flicker" delay={0.8} dur={1.6} origin="50% 100%" z={4}>
        <Img name="flame" />
      </Layer>
      <Layer x={16} y={18} w={18} idle="ob-hop" delay={0.95} dur={3.4} z={4}>
        <Img name="party-popper" />
      </Layer>
      {/* Mini leaderboard: the "You" row moves from 2nd to 1st place */}
      <Layer x={50} y={80} w={74} enter="ob-rise" delay={0.35} z={5}>
        <div dir="ltr" className={`relative w-full rounded-2xl bg-white dark:bg-slate-900 shadow-lg border border-slate-200 dark:border-slate-700 p-[3%] ${stageText}`}>
          <div className="relative grid grid-rows-2 gap-[6%] h-[clamp(52px,22cqw,72px)]">
            {[0, 1].map(slot => (
              <div key={slot} className="flex items-center gap-[4%] ps-[3%]">
                <span className="w-[1.6em] text-center font-bold font-mono-num text-slate-500">{slot + 1}</span>
              </div>
            ))}
            {/* Rows sit on top of the slots; the static layout shows "You" first */}
            <div className="ob-row-me absolute start-[13%] end-0 top-0 h-[47%] ps-[3%] pe-[3%] flex items-center gap-[4%] rounded-xl bg-indigo-50 dark:bg-indigo-950/70 ring-1 ring-indigo-200 dark:ring-indigo-800" style={{ '--d': '0.35s' } as React.CSSProperties}>
              <span className="w-[1.8em] h-[1.8em] rounded-full bg-indigo-600 shrink-0" />
              <span className="font-bold text-indigo-700 dark:text-indigo-300 truncate">{t.onboarding.you}</span>
              <span className="ms-auto h-[0.6em] w-[30%] rounded-full bg-indigo-400/80" />
            </div>
            <div className="ob-row-other absolute start-[13%] end-0 bottom-0 h-[47%] ps-[3%] pe-[3%] flex items-center gap-[4%] rounded-xl" style={{ '--d': '0.35s' } as React.CSSProperties}>
              <span className="w-[1.8em] h-[1.8em] rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
              <span className="h-[0.6em] w-[28%] rounded-full bg-slate-200 dark:bg-slate-700" />
              <span className="ms-auto h-[0.6em] w-[24%] rounded-full bg-slate-300 dark:bg-slate-600" />
            </div>
          </div>
        </div>
      </Layer>
    </>
  );
};
