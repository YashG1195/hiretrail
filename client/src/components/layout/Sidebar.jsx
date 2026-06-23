// src/components/layout/Sidebar.jsx
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, FileText, BarChart3,
  LogOut, ChevronRight, Zap,
} from 'lucide-react';
import { clsx } from 'clsx';
import useAuthStore from '../../store/authStore';
import { logout } from '../../api/authApi';
import toast from 'react-hot-toast';

const NAV = [
  { to: '/',        label: 'Dashboard', icon: LayoutDashboard },
  { to: '/jobs',    label: 'Jobs',      icon: Briefcase       },
  { to: '/resumes', label: 'Resumes',   icon: FileText        },
  { to: '/reports', label: 'Reports',   icon: BarChart3       },
];

export default function Sidebar() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await logout(); } catch {}
    clearAuth();
    navigate('/login');
    toast.success('Logged out');
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <aside className="flex flex-col w-60 shrink-0 border-r border-surface-700 bg-surface-900 h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-surface-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <span className="font-bold text-white text-sm tracking-tight">HireTrail</span>
            <p className="text-[10px] text-slate-500 -mt-0.5">ATS Platform</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group',
              isActive
                ? 'bg-primary-500/15 text-primary-400 border border-primary-500/20'
                : 'text-slate-400 hover:text-white hover:bg-surface-700',
            )}
          >
            {({ isActive }) => (
              <>
                <Icon size={18} className={isActive ? 'text-primary-400' : 'text-slate-500 group-hover:text-slate-300'} />
                <span className="flex-1">{label}</span>
                {isActive && <ChevronRight size={14} className="text-primary-500" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-surface-700">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-700 transition-colors">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-600 to-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors shrink-0"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
