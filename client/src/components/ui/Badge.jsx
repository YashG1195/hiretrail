// src/components/ui/Badge.jsx
import { clsx } from 'clsx';
import { STATUS_CONFIG } from '../../utils/constants';

export function StatusBadge({ status, className }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'bg-slate-500/15 text-slate-400 border-slate-500/30', dot: 'bg-slate-400' };
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
      cfg.color, className,
    )}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  );
}

export function Badge({ children, variant = 'default', className }) {
  const variants = {
    default: 'bg-surface-700 text-slate-300 border border-surface-500',
    primary: 'bg-primary-500/15 text-primary-400 border border-primary-500/30',
    success: 'bg-green-500/15 text-green-400 border border-green-500/30',
    warning: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
    danger:  'bg-red-500/15 text-red-400 border border-red-500/30',
  };
  return (
    <span className={clsx(
      'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
      variants[variant], className,
    )}>
      {children}
    </span>
  );
}
