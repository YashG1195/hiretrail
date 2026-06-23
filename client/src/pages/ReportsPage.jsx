// src/pages/ReportsPage.jsx
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getSummary, downloadPdf, downloadCsv } from '../api/reportsApi';
import { StatCard } from '../components/ui/Card';
import { PageLoader } from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import { STATUS_CONFIG, STATUS_ORDER } from '../utils/constants';
import { Briefcase, Award, Timer, FileDown, Sheet } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell,
} from 'recharts';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-800 border border-surface-600 rounded-xl px-3 py-2 text-sm shadow-xl">
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      <p className="text-white font-semibold">{payload[0].value} applications</p>
    </div>
  );
};

export default function ReportsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['report-summary'],
    queryFn: () => getSummary().then(r => r.data.report),
  });

  const pdfMutation = useMutation({
    mutationFn: downloadPdf,
    onSuccess: () => toast.success('PDF downloaded'),
    onError: () => toast.error('PDF download failed'),
  });

  const csvMutation = useMutation({
    mutationFn: downloadCsv,
    onSuccess: () => toast.success('CSV downloaded'),
    onError: () => toast.error('CSV download failed'),
  });

  if (isLoading) return <PageLoader />;
  const report = data || {};

  const monthData = (report.applicationsByMonth || []).map(m => {
    const [yr, mo] = m.month.split('-');
    return {
      name: MONTH_NAMES[parseInt(mo, 10) - 1],
      count: m.count,
    };
  });

  const statusData = STATUS_ORDER
    .filter(s => (report.byStatus?.[s] || 0) > 0)
    .map(s => ({
      name: STATUS_CONFIG[s].label,
      count: report.byStatus[s],
      fill: STATUS_CONFIG[s].hex,
    }));

  return (
    <div className="space-y-6">
      {/* Export buttons */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">Analytics for all your job applications</p>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            icon={Sheet}
            loading={csvMutation.isPending}
            onClick={() => csvMutation.mutate()}
          >
            Export CSV
          </Button>
          <Button
            icon={FileDown}
            loading={pdfMutation.isPending}
            onClick={() => pdfMutation.mutate()}
          >
            Download PDF
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Applications" value={report.totalApplications ?? 0} icon={Briefcase} color="primary" />
        <StatCard label="Avg ATS Score" value={report.avgAtsScore ? `${report.avgAtsScore}/100` : 'N/A'} icon={Award} color="amber" />
        <StatCard label="Avg Days to Offer" value={report.avgDaysToOffer ? `${report.avgDaysToOffer}d` : 'N/A'} icon={Timer} color="green" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Monthly bar chart */}
        <div className="rounded-xl border border-surface-600 bg-surface-800 p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Applications by Month</h2>
          {monthData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthData} margin={{ top: 5, right: 5, bottom: 0, left: -25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c1c2e" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {monthData.map((_, i) => (
                    <Cell key={i} fill={i === monthData.length - 1 ? '#6366f1' : '#3730a3'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-sm text-slate-500">No data</div>
          )}
        </div>

        {/* Status breakdown */}
        <div className="rounded-xl border border-surface-600 bg-surface-800 p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Status Breakdown</h2>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart layout="vertical" data={statusData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c1c2e" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={90} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-sm text-slate-500">No data</div>
          )}
        </div>
      </div>

      {/* Top companies */}
      {report.topCompanies?.length > 0 && (
        <div className="rounded-xl border border-surface-600 bg-surface-800">
          <div className="px-5 py-4 border-b border-surface-600">
            <h2 className="text-sm font-semibold text-slate-300">Top Companies</h2>
          </div>
          <div className="divide-y divide-surface-700">
            {report.topCompanies.map((co, i) => {
              const pct = report.totalApplications > 0
                ? Math.round((co.count / report.totalApplications) * 100) : 0;
              return (
                <div key={co.name} className="flex items-center gap-4 px-5 py-3">
                  <span className="text-xs font-bold text-slate-600 w-5 text-right">{i + 1}</span>
                  <p className="flex-1 text-sm text-white font-medium">{co.name}</p>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-24 h-1.5 rounded-full bg-surface-700 overflow-hidden">
                      <div className="h-full rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-slate-400 w-16 text-right">{co.count} app{co.count !== 1 ? 's' : ''} · {pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
