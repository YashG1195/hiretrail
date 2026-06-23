// src/components/ui/Spinner.jsx
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

export default function Spinner({ size = 'md', className }) {
  const sizes = { sm: 16, md: 24, lg: 36 };
  return (
    <Loader2
      size={sizes[size] || sizes.md}
      className={clsx('animate-spin text-primary-400', className)}
    />
  );
}

export function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <Spinner size="lg" />
      <p className="text-sm text-slate-500">Loading…</p>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-surface-700 flex items-center justify-center mb-4">
          <Icon size={24} className="text-slate-500" />
        </div>
      )}
      <p className="text-base font-medium text-slate-300 mb-1">{title}</p>
      {description && <p className="text-sm text-slate-500 mb-4">{description}</p>}
      {action}
    </div>
  );
}
