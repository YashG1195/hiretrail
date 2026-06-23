// src/components/jobs/JobForm.jsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { createJob, updateJob } from '../../api/jobsApi';
import Input, { Textarea, Select } from '../ui/Input';
import Button from '../ui/Button';
import { STATUS_ORDER, SOURCE_OPTIONS, CURRENCY_OPTIONS } from '../../utils/constants';
import { Save, X } from 'lucide-react';

const schema = z.object({
  companyName:  z.string().min(1, 'Company name is required').max(200),
  jobTitle:     z.string().min(1, 'Job title is required').max(200),
  status:       z.enum(['applied','phone_screen','technical','interview','offer','rejected','withdrawn']),
  jobDescription: z.string().optional(),
  appliedDate:  z.string().optional(),
  followUpDate: z.string().optional(),
  location:     z.string().optional(),
  remote:       z.boolean().optional(),
  salaryMin:    z.coerce.number().min(0).optional().or(z.literal('')),
  salaryMax:    z.coerce.number().min(0).optional().or(z.literal('')),
  currency:     z.string().optional(),
  source:       z.string().optional(),
  notes:        z.string().max(5000).optional(),
  tags:         z.string().optional(), // comma-separated, parsed before submit
});

export default function JobForm({ job, onClose }) {
  const qc = useQueryClient();
  const isEdit = Boolean(job);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: job ? {
      ...job,
      appliedDate:  job.appliedDate?.slice(0, 10) || '',
      followUpDate: job.followUpDate?.slice(0, 10) || '',
      tags:         (job.tags || []).join(', '),
    } : {
      status:      'applied',
      currency:    'USD',
      remote:      false,
      source:      'Other',
      appliedDate: new Date().toISOString().slice(0, 10),
    },
  });

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? updateJob(job._id, data) : createJob(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['job-stats'] });
      toast.success(isEdit ? 'Job updated!' : 'Job application added!');
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Something went wrong'),
  });

  const onSubmit = (raw) => {
    const data = {
      ...raw,
      tags:         raw.tags ? raw.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      salaryMin:    raw.salaryMin || undefined,
      salaryMax:    raw.salaryMax || undefined,
      followUpDate: raw.followUpDate || undefined,
    };
    mutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Company Name" placeholder="Google" error={errors.companyName?.message} {...register('companyName')} />
        <Input label="Job Title"    placeholder="Software Engineer" error={errors.jobTitle?.message} {...register('jobTitle')} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Select label="Status" error={errors.status?.message} {...register('status')}>
          {STATUS_ORDER.map(s => (
            <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
          ))}
        </Select>
        <Select label="Source" {...register('source')}>
          {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Input label="Applied Date" type="date" {...register('appliedDate')} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Input label="Salary Min" type="number" placeholder="60000" {...register('salaryMin')} />
        <Input label="Salary Max" type="number" placeholder="90000" {...register('salaryMax')} />
        <Select label="Currency" {...register('currency')}>
          {CURRENCY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Location" placeholder="San Francisco, CA" {...register('location')} />
        <Input label="Follow-up Date" type="date" {...register('followUpDate')} />
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" id="remote" {...register('remote')} className="w-4 h-4 rounded accent-primary-500" />
        <label htmlFor="remote" className="text-sm text-slate-300">Remote position</label>
      </div>

      <Input
        label="Tags"
        placeholder="frontend, react, startup (comma-separated)"
        hint="Separate tags with commas"
        {...register('tags')}
      />

      <Textarea
        label="Job Description"
        rows={4}
        placeholder="Paste the job description here for ATS analysis…"
        {...register('jobDescription')}
      />

      <Textarea label="Notes" rows={3} placeholder="Interview notes, contacts, impressions…" {...register('notes')} />

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" icon={X} onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={mutation.isPending} icon={Save}>
          {isEdit ? 'Save Changes' : 'Add Application'}
        </Button>
      </div>
    </form>
  );
}
