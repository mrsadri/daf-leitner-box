import React from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { Icon3D } from './ui/Icon3D';

// Trail points on a 600×150 picture: valley (Box 0) to summit (Box 5)
const STAGES = [
  { name: 'Tal', x: 52, y: 132 },
  { name: 'Alm', x: 150, y: 116 },
  { name: 'Waldrand', x: 245, y: 98 },
  { name: 'Hütte', x: 330, y: 78 },
  { name: 'Grat', x: 405, y: 52 },
  { name: 'Gipfel', x: 468, y: 24 }
];

/**
 * Decoration for the Leitner boxes: a mountain with a hiking trail from the valley (Box 0) to the summit
 * (Box 5), marked with red-white-red trail blazes like Austrian hiking paths. Purely decorative: box labels
 * elsewhere stay "Box 0 … Box 5". Mirrored in the Persian interface so the valley is where reading starts.
 */
export const MountainTrail: React.FC = () => {
  const { digits } = useI18n();
  return (
    <figure className="relative w-full max-w-3xl mx-auto select-none" aria-hidden="true" data-testid="mountain-trail">
      <svg viewBox="0 0 600 150" className="w-full h-auto rtl:-scale-x-100" preserveAspectRatio="xMidYMax meet">
        <defs>
          <linearGradient id="mt-main" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3f93c6" />
            <stop offset="1" stopColor="#acd3ea" />
          </linearGradient>
          <linearGradient id="mt-back" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d5e9f5" />
            <stop offset="1" stopColor="#eef6fb" />
          </linearGradient>
        </defs>
        <path d="M0 150 L70 95 L130 118 L210 60 L280 102 L360 70 L430 96 L520 46 L600 92 L600 150 Z" fill="url(#mt-back)" className="dark:opacity-30" />
        <path d="M0 150 L40 138 L140 112 L240 92 L330 72 L405 46 L468 20 L520 52 L560 70 L600 96 L600 150 Z" fill="url(#mt-main)" className="dark:opacity-70" />
        <path d="M440 40 L468 20 L494 38 L482 36 L470 44 L458 36 Z" fill="#ffffff" />
        <polyline
          points={STAGES.map(s => `${s.x},${s.y}`).join(' ')}
          fill="none" stroke="#ffffff" strokeWidth="2.5" strokeDasharray="5 5" strokeLinecap="round" opacity="0.9"
        />
        {/* Cable car line */}
        <line x1="190" y1="8" x2="330" y2="58" stroke="#475569" strokeWidth="1.2" className="dark:stroke-slate-400" />
        {STAGES.map(s => (
          <g key={s.name} transform={`translate(${s.x - 5} ${s.y - 6})`}>
            <rect width="10" height="3.6" fill="#c8102e" />
            <rect y="3.6" width="10" height="3.6" fill="#ffffff" />
            <rect y="7.2" width="10" height="3.6" fill="#c8102e" />
          </g>
        ))}
      </svg>
      {/* Stage names (German) with the box number */}
      {STAGES.map((s, i) => (
        <span
          key={s.name}
          lang="de"
          className="absolute -translate-y-full px-1.5 py-0.5 rounded-md bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 text-[9px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap shadow-xs ltr:-translate-x-1/2 rtl:translate-x-1/2"
          style={{ insetInlineStart: `${(s.x / 600) * 100}%`, top: `${((s.y - 8) / 150) * 100}%` }}
        >
          {s.name} · {digits(String(i))}
        </span>
      ))}
      <span className="absolute" style={{ insetInlineStart: `${(205 / 600) * 100}%`, top: '2%' }}><Icon3D name="cable-car" size={34} /></span>
      <span className="absolute bottom-0" style={{ insetInlineStart: '1%' }}><Icon3D name="edelweiss" size={38} /></span>
    </figure>
  );
};
