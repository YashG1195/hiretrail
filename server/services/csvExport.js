/**
 * services/csvExport.js
 *
 * Converts all job documents for a user to a CSV string
 * using @json2csv/plainjs.
 *
 * Columns: company, title, status, appliedDate, atsScore,
 *          location, remote, source, tags
 */

import { Parser } from '@json2csv/plainjs';
import Job from '../models/Job.js';

// ─── Field definitions ────────────────────────────────────────────────────────
const CSV_FIELDS = [
  {
    label: 'Company',
    value: 'companyName',
  },
  {
    label: 'Job Title',
    value: 'jobTitle',
  },
  {
    label: 'Status',
    value: (row) => row.status?.replace('_', ' ') ?? '',
  },
  {
    label: 'Applied Date',
    value: (row) =>
      row.appliedDate
        ? new Date(row.appliedDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          })
        : '',
  },
  {
    label: 'ATS Score',
    value: (row) => (row.atsScore != null ? row.atsScore : 'N/A'),
  },
  {
    label: 'Location',
    value: (row) => row.location ?? '',
  },
  {
    label: 'Remote',
    value: (row) => (row.remote ? 'Yes' : 'No'),
  },
  {
    label: 'Source',
    value: 'source',
  },
  {
    label: 'Tags',
    value: (row) => (Array.isArray(row.tags) ? row.tags.join('; ') : ''),
  },
  {
    label: 'Salary Min',
    value: (row) => (row.salaryMin != null ? row.salaryMin : ''),
  },
  {
    label: 'Salary Max',
    value: (row) => (row.salaryMax != null ? row.salaryMax : ''),
  },
  {
    label: 'Currency',
    value: 'currency',
  },
  {
    label: 'Notes',
    value: (row) => (row.notes ?? '').replace(/\n/g, ' '),
  },
];

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Fetch all non-deleted job applications for a user and serialise to CSV.
 *
 * @param {string} userId - MongoDB User _id
 * @returns {Promise<string>} CSV string (with BOM for Excel compatibility)
 */
export const generateCsv = async (userId) => {
  const jobs = await Job.find({ userId, deletedAt: null })
    .sort({ appliedDate: -1 })
    .select('-extractedText -__v -deletedAt')   // exclude heavy / internal fields
    .lean();

  if (jobs.length === 0) {
    // Return CSV with headers only if no data
    const parser = new Parser({ fields: CSV_FIELDS });
    return parser.parse([]);
  }

  const parser = new Parser({ fields: CSV_FIELDS });
  // Prepend UTF-8 BOM (\uFEFF) so Excel opens it correctly with special characters
  return '\uFEFF' + parser.parse(jobs);
};

export default generateCsv;
