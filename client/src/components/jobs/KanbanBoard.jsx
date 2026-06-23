// src/components/jobs/KanbanBoard.jsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateJob } from '../../api/jobsApi';
import { STATUS_CONFIG, STATUS_ORDER } from '../../utils/constants';
import { StatusBadge } from '../ui/Badge';
import { fDate, fDaysSince } from '../../utils/formatters';
import { Building2, MapPin, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

function JobCard({ job, onClick }) {
  const days = fDaysSince(job.appliedDate);
  return (
    <div
      onClick={() => onClick(job)}
      className="bg-surface-900 border border-surface-600 hover:border-surface-400 rounded-xl p-4 cursor-pointer transition-colors group"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="font-semibold text-white text-sm truncate">{job.jobTitle}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <Building2 size={11} className="text-slate-500 shrink-0" />
            <p className="text-xs text-slate-400 truncate">{job.companyName}</p>
          </div>
        </div>
        {job.atsScore != null && (
          <span className={clsx(
            'shrink-0 text-xs font-bold px-2 py-0.5 rounded-lg',
            job.atsScore >= 70 ? 'bg-green-500/15 text-green-400' :
            job.atsScore >= 40 ? 'bg-yellow-500/15 text-yellow-400' :
            'bg-red-500/15 text-red-400',
          )}>
            {job.atsScore}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-500">
        {job.location && (
          <span className="flex items-center gap-1">
            <MapPin size={10} /> {job.location}
          </span>
        )}
        {days != null && (
          <span className="flex items-center gap-1 ml-auto">
            <Clock size={10} /> {days}d
          </span>
        )}
      </div>
    </div>
  );
}

export default function KanbanBoard({ jobs, onJobClick }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, status }) => updateJob(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Status updated');
    },
    onError: () => toast.error('Failed to update status'),
  });

  const columns = STATUS_ORDER.filter(s => !['withdrawn'].includes(s));

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((status) => {
        const cfg = STATUS_CONFIG[status];
        const colJobs = jobs.filter(j => j.status === status);
        return (
          <div key={status} className="flex flex-col w-64 shrink-0">
            {/* Column header */}
            <div className={clsx(
              'flex items-center justify-between px-3 py-2.5 rounded-xl mb-3 border',
              'bg-surface-800', cfg.color.split(' ').filter(c => c.startsWith('border')).join(' '),
            )}>
              <div className="flex items-center gap-2">
                <span className={clsx('w-2 h-2 rounded-full', cfg.dot)} />
                <span className="text-sm font-medium text-slate-200">{cfg.label}</span>
              </div>
              <span className="text-xs font-bold text-slate-400 bg-surface-700 px-2 py-0.5 rounded-md">
                {colJobs.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2 flex-1">
              {colJobs.map(job => (
                <JobCard key={job._id} job={job} onClick={onJobClick} />
              ))}
              {colJobs.length === 0 && (
                <div className="rounded-xl border-2 border-dashed border-surface-700 py-6 text-center text-xs text-slate-600">
                  No applications
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
