// src/components/layout/Topbar.jsx
import { Sun, Moon, Bell } from 'lucide-react';
import useAuthStore from '../../store/authStore';

export default function Topbar({ title, subtitle }) {
  const { theme, toggleTheme } = useAuthStore();

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-surface-700 bg-surface-900/80 backdrop-blur-md">
      <div>
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-surface-700 text-slate-400 hover:text-white transition-colors"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button className="p-2 rounded-lg hover:bg-surface-700 text-slate-400 hover:text-white transition-colors">
          <Bell size={18} />
        </button>
      </div>
    </header>
  );
}
