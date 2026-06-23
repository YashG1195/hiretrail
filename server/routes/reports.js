import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  getSummaryReport,
  exportPdf,
  exportCsv,
} from '../controllers/reportsController.js';

const router = Router();

// All report routes require authentication
router.use(authMiddleware);

// ─── Report Routes ────────────────────────────────────────────────────────────
router.get('/summary',     getSummaryReport); // JSON — aggregated stats
router.get('/export/pdf',  exportPdf);        // PDF  — streamed binary
router.get('/export/csv',  exportCsv);        // CSV  — streamed text

export default router;
