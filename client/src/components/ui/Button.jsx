// src/components/ui/Button.jsx
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

const variants = {
  primary:   'bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/20',
  secondary: 'bg-surface-700 hover:bg-surface-600 text-slate-200 border border-surface-500',
  ghost:     'hover:bg-surface-700 text-slate-300 hover:text-white',
  danger:    'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30',
  success:   'bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30',
};

const sizes = {
  xs:  'px-2.5 py-1 text-xs rounded-md',
  sm:  'px-3 py-1.5 text-sm rounded-lg',
  md:  'px-4 py-2 text-sm rounded-lg',
  lg:  'px-5 py-2.5 text-base rounded-xl',
};

export default function Button({
  children, variant = 'primary', size = 'md',
  loading, disabled, icon: Icon, className, ...props
}) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center gap-2 font-medium transition-all cursor-pointer',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant], sizes[size], className,
      )}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : Icon ? <Icon size={14} /> : null}
      {children}
    </button>
  );
}
