// src/utils/formatters.js
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';

export const fDate = (date) => date ? format(new Date(date), 'MMM d, yyyy') : '—';
export const fDateShort = (date) => date ? format(new Date(date), 'MM/dd/yy') : '—';
export const fTimeAgo = (date) => date ? formatDistanceToNow(new Date(date), { addSuffix: true }) : '—';
export const fDaysSince = (date) => date ? differenceInDays(new Date(), new Date(date)) : null;

export const fCurrency = (amount, currency = 'USD') => {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, notation: 'compact' }).format(amount);
};

export const fSalaryRange = (min, max, currency = 'USD') => {
  if (!min && !max) return '—';
  if (min && max) return `${fCurrency(min, currency)} – ${fCurrency(max, currency)}`;
  return fCurrency(min || max, currency);
};

export const fStatus = (status) =>
  status?.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || status;
