// src/pages/DashboardPage.jsx
import { useQuery } from '@tanstack/react-query';
import { getJobStats } from '../api/jobsApi';
import { getSummary } from '../api/reportsApi';
import { StatCard } from '../components/ui/Card';
import { PageLoader } from '../components/ui/Spinner';
import { StatusBadge } from '../components/ui/Badge';
import { fDate, fDaysSince } from '../utils/formatters';
import { STATUS_CONFIG, STATUS_ORDER } from '../utils/constants';
import { Briefcase, TrendingUp, Award, CheckCircle2, Building2, Clock } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Link } from 'react-router-dom';

const COLORS = STATUS_ORDER.map(s => STATUS_CONFIG[s]?.hex || '#94a3b8');

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-800 border border-surface-600 rounded-xl px-3 py-2 shadow-xl">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="text-sm font-semibold" style={{ color: p.color }}>{p.value} {p.name}</p>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['job-stats'],
    queryFn: () => getJobStats().then(r => r.data),
  });

  const { data: reportData, isLoading: reportLoading } = useQuery({
    queryKey: ['report-summary'],
    queryFn: () => getSummary().then(r => r.data.report),
  });

  if (statsLoading || reportLoading) return <PageLoader />;

  const stats = statsData?.stats || {};
  const report = reportData || {};

  const pieData = STATUS_ORDER
    .filter(s => (report.byStatus?.[s] || 0) > 0)
    .map(s => ({ name: STATUS_CONFIG[s].label, value: report.byStatus[s], fill: STATUS_CONFIG[s].hex }));

  const monthData = (report.applicationsByMonth || []).map(m => {
    const [yr, mo] = m.month.split('-');
    return {
      name: new Date(`${yr}-${mo}-01`).toLocaleString('en-US', { month: 'short' }),
      Applications: m.count,
    };
  });

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Applications" value={report.totalApplications ?? 0} icon={Briefcase} color="primary" />
        <StatCard label="In Active Pipeline" value={(report.byStatus?.applied ?? 0) + (report.byStatus?.phone_screen ?? 0) + (report.byStatus?.technical ?? 0) + (report.byStatus?.interview ?? 0)} icon={TrendingUp} color="violet" />
        <StatCard label="Avg ATS Score" value={report.avgAtsScore ? `${report.avgAtsScore}/100` : 'N/A'} icon={Award} color="amber" />
        <StatCard label="Offers Received" value={report.byStatus?.offer ?? 0} icon={CheckCircle2} color="green" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Applications over time */}
        <div className="xl:col-span-2 rounded-xl border border-surface-600 bg-surface-800 p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Applications Over Time</h2>
          {monthData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthData} margin={{ top: 5, right: 5, bottom: 0, left: -25 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c1c2e" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Applications" stroke="#6366f1" strokeWidth={2} fill="url(#areaGrad)" dot={{ fill: '#6366f1', r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-sm text-slate-500">
              No data yet — add your first application!
            </div>
          )}
        </div>

        {/* Status breakdown */}
        <div className="rounded-xl border border-surface-600 bg-surface-800 p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Status Breakdown</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={3}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#151521', border: '1px solid #25253d', borderRadius: 12, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-sm text-slate-500">No data</div>
          )}
        </div>
      </div>

      {/* Recent applications */}
      <div className="rounded-xl border border-surface-600 bg-surface-800">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-600">
          <h2 className="text-sm font-semibold text-slate-300">Recent Applications</h2>
          <Link to="/jobs" className="text-xs text-primary-400 hover:text-primary-300 transition-colors">View all →</Link>
        </div>
        <div className="divide-y divide-surface-700">
          {(stats.recentJobs || []).length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No applications yet</p>
          ) : (
            (stats.recentJobs || []).slice(0, 5).map(job => (
              <Link key={job._id} to={`/jobs/${job._id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-700 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-surface-700 flex items-center justify-center shrink-0">
                  <Building2 size={16} className="text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{job.jobTitle}</p>
                  <p className="text-xs text-slate-500 truncate">{job.companyName}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={job.status} />
                  <span className="text-xs text-slate-600 flex items-center gap-1">
                    <Clock size={10} /> {fDaysSince(job.appliedDate)}d
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
