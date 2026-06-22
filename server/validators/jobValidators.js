import { z } from 'zod';

// ─── Shared field definitions ─────────────────────────────────────────────────
const statusEnum = z.enum([
  'applied',
  'phone_screen',
  'technical',
  'interview',
  'offer',
  'rejected',
  'withdrawn',
]);

const sourceEnum = z.enum([
  'LinkedIn',
  'Indeed',
  'Referral',
  'Company Website',
  'Glassdoor',
  'Other',
]);

// ─── Create Job Schema ────────────────────────────────────────────────────────
export const createJobSchema = z
  .object({
    companyName: z
      .string({ required_error: 'Company name is required' })
      .trim()
      .min(1, 'Company name cannot be empty')
      .max(200, 'Company name cannot exceed 200 characters'),

    jobTitle: z
      .string({ required_error: 'Job title is required' })
      .trim()
      .min(1, 'Job title cannot be empty')
      .max(200, 'Job title cannot exceed 200 characters'),

    jobDescription: z.string().trim().optional().nullable(),

    status: statusEnum.default('applied').optional(),

    appliedDate: z.coerce.date().optional(),
    followUpDate: z.coerce.date().optional().nullable(),

    salaryMin: z.number({ invalid_type_error: 'Salary must be a number' }).min(0).optional().nullable(),
    salaryMax: z.number({ invalid_type_error: 'Salary must be a number' }).min(0).optional().nullable(),
    currency: z.string().trim().toUpperCase().max(5).optional().default('USD'),

    location: z.string().trim().optional().nullable(),
    remote: z.boolean().optional().default(false),

    notes: z.string().trim().max(5000).optional().nullable(),
    tags: z
      .array(z.string().trim().min(1).max(50))
      .max(20, 'Cannot add more than 20 tags')
      .optional()
      .default([]),
    source: sourceEnum.optional().default('Other'),
  })
  .refine(
    (data) => {
      if (data.salaryMin != null && data.salaryMax != null) {
        return data.salaryMax >= data.salaryMin;
      }
      return true;
    },
    { message: 'salaryMax must be greater than or equal to salaryMin', path: ['salaryMax'] }
  );

// ─── Update Job Schema (all fields optional) ──────────────────────────────────
export const updateJobSchema = z
  .object({
    companyName: z.string().trim().min(1).max(200).optional(),
    jobTitle: z.string().trim().min(1).max(200).optional(),
    jobDescription: z.string().trim().optional().nullable(),
    status: statusEnum.optional(),
    appliedDate: z.coerce.date().optional(),
    followUpDate: z.coerce.date().optional().nullable(),
    salaryMin: z.number().min(0).optional().nullable(),
    salaryMax: z.number().min(0).optional().nullable(),
    currency: z.string().trim().toUpperCase().max(5).optional(),
    location: z.string().trim().optional().nullable(),
    remote: z.boolean().optional(),
    notes: z.string().trim().max(5000).optional().nullable(),
    tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
    source: sourceEnum.optional(),
  })
  .refine(
    (data) => {
      if (data.salaryMin != null && data.salaryMax != null) {
        return data.salaryMax >= data.salaryMin;
      }
      return true;
    },
    { message: 'salaryMax must be greater than or equal to salaryMin', path: ['salaryMax'] }
  );

// ─── Query Schema (GET /api/jobs list filters) ────────────────────────────────
export const listJobsQuerySchema = z.object({
  status: statusEnum.optional(),
  tag: z.string().trim().optional(),
  search: z.string().trim().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  cursor: z.string().optional(), // base64-encoded cursor
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
