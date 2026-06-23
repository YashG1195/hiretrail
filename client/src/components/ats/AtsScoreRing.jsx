// src/components/ats/AtsScoreRing.jsx
import { clsx } from 'clsx';

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function AtsScoreRing({ score, size = 160 }) {
  const pct = Math.max(0, Math.min(100, score ?? 0));
  const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;

  const color =
    pct >= 70 ? '#4ade80' :
    pct >= 40 ? '#facc15' :
    '#f87171';

  const label =
    pct >= 70 ? 'Strong Match' :
    pct >= 40 ? 'Partial Match' :
    'Weak Match';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 130 130" fill="none">
          {/* Track */}
          <circle cx="65" cy="65" r={RADIUS} stroke="#1c1c2e" strokeWidth="10" />
          {/* Progress */}
          <circle
            cx="65" cy="65" r={RADIUS}
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            transform="rotate(-90 65 65)"
            style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
          />
          {/* Glow */}
          <circle
            cx="65" cy="65" r={RADIUS}
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            transform="rotate(-90 65 65)"
            opacity="0.25"
            filter="blur(3px)"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold" style={{ color }}>{score ?? '—'}</span>
          <span className="text-xs text-slate-500">/100</span>
        </div>
      </div>
      <span className="text-xs font-medium px-2.5 py-0.5 rounded-full" style={{ color, background: `${color}18` }}>
        {score != null ? label : 'Not analyzed'}
      </span>
    </div>
  );
}
