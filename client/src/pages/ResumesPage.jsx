// src/pages/ResumesPage.jsx
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { uploadResume, listResumes, deleteResume } from '../api/resumeApi';
import { PageLoader, EmptyState } from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { fDate } from '../utils/formatters';
import { FileText, Upload, Trash2, CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';

const STATUS_UI = {
  pending:    { icon: Clock,         color: 'warning', label: 'Pending'    },
  processing: { icon: Clock,         color: 'primary', label: 'Parsing…'   },
  done:       { icon: CheckCircle2,  color: 'success', label: 'Parsed'     },
  failed:     { icon: XCircle,       color: 'danger',  label: 'Failed'     },
};

function ResumeCard({ resume, onDelete }) {
  const ui    = STATUS_UI[resume.parseStatus] || STATUS_UI.pending;
  const Icon  = ui.icon;

  return (
    <div className="flex items-center gap-4 rounded-xl border border-surface-600 bg-surface-800 px-5 py-4 hover:border-surface-500 transition-colors">
      <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center shrink-0">
        <FileText size={18} className="text-primary-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{resume.fileName}</p>
        <p className="text-xs text-slate-500 mt-0.5">Uploaded {fDate(resume.uploadedAt)}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Badge variant={ui.color}>
          <Icon size={11} className="mr-1" />{ui.label}
        </Badge>
        <button
          onClick={() => onDelete(resume._id)}
          className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export default function ResumesPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['resumes'],
    queryFn: () => listResumes().then(r => r.data.resumes),
    refetchInterval: (data) => {
      // Poll every 3s if any resume is still processing
      const hasPending = data?.some(r => ['pending','processing'].includes(r.parseStatus));
      return hasPending ? 3000 : false;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file) => {
      const fd = new FormData();
      fd.append('resume', file);
      return uploadResume(fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resumes'] });
      toast.success('Resume uploaded — parsing in progress…');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Upload failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteResume,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resumes'] });
      toast.success('Resume deleted');
    },
    onError: () => toast.error('Failed to delete'),
  });

  const onDrop = useCallback((accepted, rejected) => {
    if (rejected.length > 0) {
      toast.error('Only PDF files up to 5MB are accepted');
      return;
    }
    if (accepted.length > 0) {
      uploadMutation.mutate(accepted[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 5 * 1024 * 1024,
    multiple: false,
  });

  const resumes = data || [];

  return (
    <div className="max-w-3xl space-y-6">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={clsx(
          'rounded-2xl border-2 border-dashed px-8 py-12 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-primary-500 bg-primary-500/5'
            : 'border-surface-600 hover:border-primary-500/50 hover:bg-surface-800',
        )}
      >
        <input {...getInputProps()} />
        <div className={clsx(
          'w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4',
          isDragActive ? 'bg-primary-500/15' : 'bg-surface-700',
        )}>
          <Upload size={24} className={isDragActive ? 'text-primary-400' : 'text-slate-500'} />
        </div>
        <p className="text-sm font-medium text-slate-200 mb-1">
          {isDragActive ? 'Drop your resume here!' : 'Drag & drop your resume'}
        </p>
        <p className="text-xs text-slate-500 mb-4">PDF files only · Max 5MB</p>
        <Button size="sm" variant="secondary" loading={uploadMutation.isPending} icon={Upload}>
          Browse File
        </Button>
      </div>

      {/* Tip */}
      <div className="flex items-start gap-3 rounded-xl bg-primary-500/5 border border-primary-500/15 px-4 py-3">
        <AlertCircle size={16} className="text-primary-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-400 leading-relaxed">
          After uploading, your resume text will be extracted automatically. Go to a job detail page and click <strong className="text-white">Analyze Resume</strong> to get your ATS match score.
        </p>
      </div>

      {/* Resume list */}
      {isLoading ? (
        <PageLoader />
      ) : resumes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No resumes uploaded yet"
          description="Upload your resume to get ATS scores for your applications."
        />
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">{resumes.length} resume{resumes.length !== 1 ? 's' : ''}</p>
          {resumes.map(r => (
            <ResumeCard key={r._id} resume={r} onDelete={id => deleteMutation.mutate(id)} />
          ))}
        </div>
      )}
    </div>
  );
}
