import User from '../models/User.js';
import { getUserReport } from '../services/reportService.js';
import { generatePdfReport } from '../services/pdfReport.js';
import { generateCsv } from '../services/csvExport.js';

// ─── GET /api/reports/summary ─────────────────────────────────────────────────
/**
 * Returns JSON report data from all aggregation pipelines.
 */
export const getSummaryReport = async (req, res, next) => {
  try {
    const report = await getUserReport(req.user.id);
    return res.status(200).json({ success: true, report });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/reports/export/pdf ─────────────────────────────────────────────
/**
 * Streams a PDF report as an attachment.
 * Content-Type: application/pdf
 */
export const exportPdf = async (req, res, next) => {
  try {
    // Fetch report data + user name in parallel
    const [report, user] = await Promise.all([
      getUserReport(req.user.id),
      User.findById(req.user.id).select('name').lean(),
    ]);

    const userName = user?.name || 'User';
    const pdfBuffer = await generatePdfReport(report, userName);

    const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const filename = `hiretrail-report-${dateStr}.pdf`;

    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      pdfBuffer.length,
      'Cache-Control':       'no-cache',
    });

    return res.end(pdfBuffer);
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/reports/export/csv ─────────────────────────────────────────────
/**
 * Streams a CSV export of all job applications.
 * Content-Type: text/csv
 */
export const exportCsv = async (req, res, next) => {
  try {
    const csvString = await generateCsv(req.user.id);

    const dateStr  = new Date().toISOString().slice(0, 10);
    const filename = `hiretrail-applications-${dateStr}.csv`;

    res.set({
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control':       'no-cache',
    });

    return res.send(csvString);
  } catch (err) {
    next(err);
  }
};
