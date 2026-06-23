// src/pages/JobsPage.jsx
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { listJobs, deleteJob, updateJob } from '../api/jobsApi';
import { StatusBadge } from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { PageLoader, EmptyState } from '../components/ui/Spinner';
import JobForm from '../components/jobs/JobForm';
import KanbanBoard from '../components/jobs/KanbanBoard';
import Input from '../components/ui/Input';
import { Select } from '../components/ui/Input';
import { fDate, fSalaryRange } from '../utils/formatters';
import { STATUS_ORDER, STATUS_CONFIG } from '../utils/constants';
import {
  Plus, LayoutList, Columns3, Trash2, Edit2, ExternalLink,
  Search, Building2, Award, Filter,
} from 'lucide-react';
import { clsx } from 'clsx';

export default function JobsPage() {
  const navigate   = useNavigate();
  const qc         = useQueryClient();
  const [view, setView]           = useState('list');    // 'list' | 'kanban'
  const [showForm, setShowForm]   = useState(false);
  const [editJob, setEditJob]     = useState(null);
  const [search, setSearch]       = useState('');
  const [statusFilter, setFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey:  ['jobs', { search, status: statusFilter }],
    queryFn:   () => listJobs({ search: search || undefined, status: statusFilter || undefined, limit: 50 }).then(r => r.data),
    keepPreviousData: true,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteJob,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['job-stats'] });
      toast.success('Application deleted');
    },
    onError: () => toast.error('Failed to delete'),
  });

  const jobs = data?.jobs || [];

  const handleDelete = (id, e) => {
    e.stopPropagation();
    if (window.confirm('Delete this application?')) deleteMutation.mutate(id);
  };

  const handleEdit = (job, e) => {
    e.stopPropagation();
    setEditJob(job);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditJob(null);
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Search company or title…"
            icon={Search}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onChange={e => setFilter(e.target.value)} className="w-40">
          <option value="">All statuses</option>
          {STATUS_ORDER.map(s => (
            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
          ))}
        </Select>

        {/* View toggle */}
        <div className="flex items-center bg-surface-800 border border-surface-600 rounded-xl p-1">
          <button
            onClick={() => setView('list')}
            className={clsx('px-3 py-1.5 rounded-lg text-sm transition-colors', view === 'list' ? 'bg-surface-700 text-white' : 'text-slate-400 hover:text-white')}
          >
            <LayoutList size={16} />
          </button>
          <button
            onClick={() => setView('kanban')}
            className={clsx('px-3 py-1.5 rounded-lg text-sm transition-colors', view === 'kanban' ? 'bg-surface-700 text-white' : 'text-slate-400 hover:text-white')}
          >
            <Columns3 size={16} />
          </button>
        </div>

        <Button icon={Plus} onClick={() => setShowForm(true)}>Add Job</Button>
      </div>

      {/* Count */}
      <p className="text-xs text-slate-500">
        {jobs.length} application{jobs.length !== 1 ? 's' : ''}
        {statusFilter ? ` · filtered by ${STATUS_CONFIG[statusFilter]?.label}` : ''}
      </p>

      {/* Content */}
      {isLoading ? (
        <PageLoader />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No applications yet"
          description="Add your first job application to start tracking."
          action={<Button icon={Plus} onClick={() => setShowForm(true)}>Add Your First Job</Button>}
        />
      ) : view === 'kanban' ? (
        <KanbanBoard jobs={jobs} onJobClick={(job) => navigate(`/jobs/${job._id}`)} />
      ) : (
        <div className="rounded-xl border border-surface-600 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-800 border-b border-surface-600">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Company / Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Applied</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Salary</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">ATS</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700">
              {jobs.map(job => (
                <tr
                  key={job._id}
                  onClick={() => navigate(`/jobs/${job._id}`)}
                  className="hover:bg-surface-700 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-white">{job.jobTitle}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{job.companyName}{job.location ? ` · ${job.location}` : ''}</p>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell text-slate-400 text-xs">{fDate(job.appliedDate)}</td>
                  <td className="px-4 py-3.5 hidden lg:table-cell text-slate-400 text-xs">{fSalaryRange(job.salaryMin, job.salaryMax, job.currency)}</td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    {job.atsScore != null ? (
                      <span className={clsx(
                        'text-xs font-bold px-2 py-0.5 rounded-lg',
                        job.atsScore >= 70 ? 'bg-green-500/15 text-green-400' :
                        job.atsScore >= 40 ? 'bg-yellow-500/15 text-yellow-400' :
                        'bg-red-500/15 text-red-400',
                      )}>
                        {job.atsScore}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
                      <button onClick={e => handleEdit(job, e)} className="p-1.5 rounded-lg hover:bg-surface-600 text-slate-500 hover:text-white transition-colors"><Edit2 size={14} /></button>
                      <button onClick={e => handleDelete(job._id, e)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                      <button onClick={() => navigate(`/jobs/${job._id}`)} className="p-1.5 rounded-lg hover:bg-surface-600 text-slate-500 hover:text-white transition-colors"><ExternalLink size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        open={showForm}
        onClose={handleCloseForm}
        title={editJob ? 'Edit Application' : 'New Job Application'}
        size="lg"
      >
        <JobForm job={editJob} onClose={handleCloseForm} />
      </Modal>
    </div>
  );
}
