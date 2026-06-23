// src/components/ui/Input.jsx
import { clsx } from 'clsx';
import { forwardRef } from 'react';

const Input = forwardRef(function Input(
  { label, error, hint, icon: Icon, className, containerClassName, ...props },
  ref
) {
  return (
    <div className={clsx('flex flex-col gap-1.5', containerClassName)}>
      {label && (
        <label className="text-sm font-medium text-slate-300">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        )}
        <input
          ref={ref}
          {...props}
          className={clsx(
            'w-full rounded-lg border bg-surface-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500',
            'focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            Icon && 'pl-9',
            error ? 'border-red-500/60' : 'border-surface-600',
            className,
          )}
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
});

export default Input;

export function Textarea({ label, error, hint, className, containerClassName, ...props }) {
  return (
    <div className={clsx('flex flex-col gap-1.5', containerClassName)}>
      {label && <label className="text-sm font-medium text-slate-300">{label}</label>}
      <textarea
        {...props}
        rows={props.rows || 4}
        className={clsx(
          'w-full rounded-lg border bg-surface-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 resize-none',
          'focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500',
          error ? 'border-red-500/60' : 'border-surface-600',
          className,
        )}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Select({ label, error, children, className, containerClassName, ...props }) {
  return (
    <div className={clsx('flex flex-col gap-1.5', containerClassName)}>
      {label && <label className="text-sm font-medium text-slate-300">{label}</label>}
      <select
        {...props}
        className={clsx(
          'w-full rounded-lg border bg-surface-800 px-3 py-2 text-sm text-slate-100',
          'focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500',
          error ? 'border-red-500/60' : 'border-surface-600',
          className,
        )}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
