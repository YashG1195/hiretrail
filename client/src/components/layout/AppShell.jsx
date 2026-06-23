// src/components/layout/AppShell.jsx
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { Outlet, useLocation } from 'react-router-dom';

const PAGE_META = {
  '/':        { title: 'Dashboard',  subtitle: 'Your job search at a glance'     },
  '/jobs':    { title: 'Jobs',       subtitle: 'Manage your applications'         },
  '/resumes': { title: 'Resumes',    subtitle: 'Upload and analyze your resumes'  },
  '/reports': { title: 'Reports',    subtitle: 'Analytics and export'             },
};

export default function AppShell() {
  const { pathname } = useLocation();
  const meta = PAGE_META[pathname] || PAGE_META[Object.keys(PAGE_META).find(k => pathname.startsWith(k) && k !== '/')] || {};

  return (
    <div className="flex min-h-screen bg-surface-950">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar title={meta.title} subtitle={meta.subtitle} />
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
