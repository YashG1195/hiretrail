// src/components/ui/Card.jsx
import { clsx } from 'clsx';

export default function Card({ children, className, hover, onClick }) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'rounded-xl border border-surface-600 bg-surface-800 p-5',
        hover && 'hover:border-surface-500 hover:bg-surface-700 cursor-pointer transition-colors',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StatCard({ label, value, sub, icon: Icon, color = 'primary', trend }) {
  const colors = {
    primary: { bg: 'bg-primary-500/10', text: 'text-primary-400', border: 'border-primary-500/20' },
    green:   { bg: 'bg-green-500/10',   text: 'text-green-400',   border: 'border-green-500/20'   },
    amber:   { bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/20'   },
    violet:  { bg: 'bg-violet-500/10',  text: 'text-violet-400',  border: 'border-violet-500/20'  },
    red:     { bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/20'     },
  };
  const c = colors[color] || colors.primary;

  return (
    <div className={clsx('rounded-xl border bg-surface-800 p-5 flex gap-4 items-start', c.border)}>
      {Icon && (
        <div className={clsx('p-2.5 rounded-xl shrink-0', c.bg)}>
          <Icon size={20} className={c.text} />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-2xl font-bold text-white">{value ?? '—'}</p>
        <p className="text-sm text-slate-400 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
    </div>
  );
}
