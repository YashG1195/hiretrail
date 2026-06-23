// src/utils/constants.js

export const STATUS_CONFIG = {
  applied: {
    label: 'Applied',
    color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    dot: 'bg-blue-400',
    hex: '#60a5fa',
  },
  phone_screen: {
    label: 'Phone Screen',
    color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    dot: 'bg-yellow-400',
    hex: '#facc15',
  },
  technical: {
    label: 'Technical',
    color: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    dot: 'bg-orange-400',
    hex: '#fb923c',
  },
  interview: {
    label: 'Interview',
    color: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    dot: 'bg-violet-400',
    hex: '#a78bfa',
  },
  offer: {
    label: 'Offer 🎉',
    color: 'bg-green-500/15 text-green-400 border-green-500/30',
    dot: 'bg-green-400',
    hex: '#4ade80',
  },
  rejected: {
    label: 'Rejected',
    color: 'bg-red-500/15 text-red-400 border-red-500/30',
    dot: 'bg-red-400',
    hex: '#f87171',
  },
  withdrawn: {
    label: 'Withdrawn',
    color: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    dot: 'bg-slate-400',
    hex: '#94a3b8',
  },
};

export const STATUS_ORDER = [
  'applied', 'phone_screen', 'technical', 'interview', 'offer', 'rejected', 'withdrawn',
];

export const SOURCE_OPTIONS = [
  'LinkedIn', 'Indeed', 'Referral', 'Company Website', 'Glassdoor', 'Other',
];

export const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD'];
