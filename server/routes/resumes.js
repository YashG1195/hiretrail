import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { handleUpload } from '../middleware/multerConfig.js';
import {
  uploadResume,
  getResumeById,
  listResumes,
  deleteResume,
} from '../controllers/resumeController.js';

const router = Router();

// All resume routes are protected
router.use(authMiddleware);

// ─── Resume Routes ────────────────────────────────────────────────────────────
router.post('/upload', handleUpload, uploadResume);   // multipart upload → enqueue
router.get('/', listResumes);                          // list all resumes for user
router.get('/:id', getResumeById);                    // get metadata + parse status
router.delete('/:id', deleteResume);                  // soft delete (isActive: false)

export default router;
