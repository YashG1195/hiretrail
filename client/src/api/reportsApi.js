// src/api/reportsApi.js
import api from './axios';

export const getSummary = () => api.get('/reports/summary');

export const downloadPdf = async () => {
  const response = await api.get('/reports/export/pdf', { responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
  const a   = document.createElement('a');
  a.href    = url;
  a.download = `hiretrail-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};

export const downloadCsv = async () => {
  const response = await api.get('/reports/export/csv', { responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
  const a   = document.createElement('a');
  a.href    = url;
  a.download = `hiretrail-applications-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
