// src/api/jobsApi.js
import api from './axios';

export const createJob    = (data)           => api.post('/jobs', data);
export const listJobs     = (params)         => api.get('/jobs', { params });
export const getJobById   = (id)             => api.get(`/jobs/${id}`);
export const updateJob    = (id, data)       => api.patch(`/jobs/${id}`, data);
export const deleteJob    = (id)             => api.delete(`/jobs/${id}`);
export const getJobStats  = ()               => api.get('/jobs/stats');

// ATS
export const analyzeJob   = (id, resumeId)   => api.post(`/jobs/${id}/analyze`, { resumeId });
export const getAtsResult = (id)             => api.get(`/jobs/${id}/ats-result`);

// Reminders
export const triggerReminder = (id, delayDays = 0) =>
  api.post(`/jobs/${id}/remind`, { delayDays });
