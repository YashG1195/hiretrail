// src/api/resumeApi.js
import api from './axios';

export const uploadResume  = (formData) =>
  api.post('/resumes/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export const listResumes  = ()    => api.get('/resumes');
export const getResumeById = (id) => api.get(`/resumes/${id}`);
export const deleteResume  = (id) => api.delete(`/resumes/${id}`);
