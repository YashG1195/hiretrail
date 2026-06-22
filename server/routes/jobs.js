import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  createJob,
  listJobs,
  getJobById,
  updateJob,
  deleteJob,
  getJobStats,
} from '../controllers/jobsController.js';

const router = Router();

// All routes below are protected — authMiddleware applied to the entire router
router.use(authMiddleware);

// ─── Job CRUD ─────────────────────────────────────────────────────────────────
router.post('/', createJob);              // Create job application
router.get('/', listJobs);               // List with filters + cursor pagination
router.get('/stats', getJobStats);       // Dashboard stats (MUST be before /:id)
router.get('/:id', getJobById);          // Single job by ID
router.patch('/:id', updateJob);         // Partial update
router.delete('/:id', deleteJob);        // Soft delete

export default router;
