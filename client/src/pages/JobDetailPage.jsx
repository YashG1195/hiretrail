// src/pages/JobDetailPage.jsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  getJobById, updateJob, deleteJob,
  analyzeJob, getAtsResult, triggerReminder,
} from '../api/jobsApi';
import { listResumes } from '../api/resumeApi';
import { StatusBadge } from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { PageLoader } from '../components/ui/Spinner';
import JobForm from '../components/jobs/JobForm';
import AtsScoreRing from '../components/ats/AtsScoreRing';
import { fDate, fSalaryRange, fDaysSince } from '../utils/formatters';
import { Select } from '../components/ui/Input';
import Input from '../components/ui/Input';
import {
  ArrowLeft, Edit2, Trash2, MapPin, Building2, Banknote,
  Calendar, Tag, Globe, Bell, Zap, RefreshCw, CheckCircle2, XCircle,
} from 'lucide-react';
import { clsx } from 'clsx';

function KeywordChips({ keywords = [], variant = 'matched' }) {
  if (!keywords.length) return <p className="text-xs text-slate-600 italic">None</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {keywords.map(kw => (
        <span
          key={kw}
          className={clsx(
            'text-xs px-2.5 py-1 rounded-lg font-medium border',
            variant === 'matched'
              ? 'bg-green-500/10 text-green-400 border-green-500/25'
              : 'bg-red-500/10 text-red-400 border-red-500/25'
          )}
        >
          {variant === 'matched' ? '✓' : '✗'} {kw}
        </span>
      ))}
    </div>
  );
}

export default function JobDetailPage() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const qc        = useQueryClient();

  const [showEdit, setShowEdit]           = useState(false);
  const [selectedResume, setSelectedResume] = useState('');
  const [reminderDays, setReminderDays]   = useState('0');

  // Fetch job
  const { data: jobData, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: () => getJobById(id).then(r => r.data.job),
  });

  // Fetch resumes for ATS
  const { data: resumesData } = useQuery({
    queryKey: ['resumes'],
    queryFn: () => listResumes().then(r => r.data.resumes),
  });

  const job     = jobData;
  const resumes = resumesData || [];

  // ATS analyze
  const analyzeMutation = useMutation({
    mutationFn: () => analyzeJob(id, selectedResume),
    onSuccess: () => {
      toast.success('Analysis queued — score will appear shortly');
      setTimeout(() => qc.invalidateQueries({ queryKey: ['job', id] }), 5000);
    },
    onError: err => toast.error(err.response?.data?.message || 'Analysis failed'),
  });

  // Reminder
  const reminderMutation = useMutation({
    mutationFn: () => triggerReminder(id, Number(reminderDays)),
    onSuccess: () => toast.success(`Reminder scheduled${reminderDays > 0 ? ` in ${reminderDays} days` : ' immediately'}`),
    onError: () => toast.error('Failed to schedule reminder'),
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: () => deleteJob(id),
    onSuccess: () => { navigate('/jobs'); toast.success('Application deleted'); },
  });

  if (isLoading) return <PageLoader />;
  if (!job) return <div className="text-slate-400 text-center py-20">Job not found</div>;

  const days = fDaysSince(job.appliedDate);

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate('/jobs')} className="p-2 rounded-xl hover:bg-surface-700 text-slate-400 hover:text-white transition-colors mt-0.5">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-white">{job.jobTitle}</h2>
          <p className="text-slate-400 text-sm mt-0.5">{job.companyName}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={job.status} />
          <button onClick={() => setShowEdit(true)} className="p-2 rounded-xl hover:bg-surface-700 text-slate-400 hover:text-white transition-colors">
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => window.confirm('Delete this application?') && deleteMutation.mutate()}
            className="p-2 rounded-xl hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — details */}
        <div className="lg:col-span-2 space-y-5">
          {/* Meta info */}
          <div className="rounded-xl border border-surface-600 bg-surface-800 p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { icon: Calendar,  label: 'Applied',   value: fDate(job.appliedDate) },
                { icon: MapPin,    label: 'Location',  value: job.location || '—' },
                { icon: Globe,     label: 'Remote',    value: job.remote ? 'Yes' : 'No' },
                { icon: Banknote,  label: 'Salary',    value: fSalaryRange(job.salaryMin, job.salaryMax, job.currency) },
                { icon: Building2, label: 'Source',    value: job.source || '—' },
                { icon: Calendar,  label: 'Days Since',value: `${days ?? '?'} days` },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Icon size={12} /> {label}
                  </div>
                  <p className="text-sm font-medium text-slate-200">{value}</p>
                </div>
              ))}
            </div>

            {/* Tags */}
            {job.tags?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-surface-600">
                <div className="flex items-center gap-2 mb-2">
                  <Tag size={12} className="text-slate-500" />
                  <span className="text-xs text-slate-500">Tags</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {job.tags.map(t => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded-md bg-surface-700 text-slate-400 border border-surface-500">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Job description */}
          {job.jobDescription && (
            <div className="rounded-xl border border-surface-600 bg-surface-800 p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Job Description</h3>
              <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line line-clamp-10">{job.jobDescription}</p>
            </div>
          )}

          {/* Notes */}
          {job.notes && (
            <div className="rounded-xl border border-surface-600 bg-surface-800 p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Notes</h3>
              <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">{job.notes}</p>
            </div>
          )}
        </div>

        {/* Right — ATS + Reminder */}
        <div className="space-y-5">
          {/* ATS Panel */}
          <div className="rounded-xl border border-surface-600 bg-surface-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap size={15} className="text-primary-400" />
              <h3 className="text-sm font-semibold text-slate-300">ATS Analysis</h3>
            </div>

            <div className="flex justify-center mb-5">
              <AtsScoreRing score={job.atsScore} />
            </div>

            {/* Resume selector */}
            <Select
              label="Select Resume"
              value={selectedResume}
              onChange={e => setSelectedResume(e.target.value)}
              containerClassName="mb-3"
            >
              <option value="">Choose a resume…</option>
              {resumes.filter(r => r.parseStatus === 'done').map(r => (
                <option key={r._id} value={r._id}>{r.fileName}</option>
              ))}
            </Select>

            <Button
              size="sm"
              className="w-full justify-center"
              icon={job.atsScore != null ? RefreshCw : Zap}
              disabled={!selectedResume || !job.jobDescription}
              loading={analyzeMutation.isPending}
              onClick={() => analyzeMutation.mutate()}
            >
              {job.atsScore != null ? 'Re-analyze' : 'Analyze Resume'}
            </Button>

            {!job.jobDescription && (
              <p className="text-xs text-amber-400/80 mt-2 text-center">Add a job description to enable ATS analysis</p>
            )}

            {/* Keywords */}
            {job.atsScore != null && (
              <div className="mt-5 space-y-3 border-t border-surface-600 pt-4">
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <CheckCircle2 size={12} className="text-green-400" />
                    <span className="text-xs font-medium text-slate-400">Matched Keywords</span>
                  </div>
                  <KeywordChips keywords={job.atsKeywordsMatched} variant="matched" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <XCircle size={12} className="text-red-400" />
                    <span className="text-xs font-medium text-slate-400">Keyword Gaps</span>
                  </div>
                  <KeywordChips keywords={job.atsKeywordGaps} variant="gap" />
                </div>
              </div>
            )}
          </div>

          {/* Reminder Panel */}
          <div className="rounded-xl border border-surface-600 bg-surface-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Bell size={15} className="text-violet-400" />
              <h3 className="text-sm font-semibold text-slate-300">Follow-up Reminder</h3>
            </div>
            <Input
              label="Delay (days)"
              type="number"
              min={0}
              max={365}
              value={reminderDays}
              onChange={e => setReminderDays(e.target.value)}
              hint="0 = send immediately"
              containerClassName="mb-3"
            />
            <Button
              size="sm"
              variant="secondary"
              className="w-full justify-center"
              icon={Bell}
              loading={reminderMutation.isPending}
              onClick={() => reminderMutation.mutate()}
            >
              Schedule Reminder
            </Button>
            {job.lastReminderSentAt && (
              <p className="text-xs text-slate-500 mt-2 text-center">
                Last sent: {fDate(job.lastReminderSentAt)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Edit modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Application" size="lg">
        <JobForm job={job} onClose={() => { setShowEdit(false); qc.invalidateQueries({ queryKey: ['job', id] }); }} />
      </Modal>
    </div>
  );
}
