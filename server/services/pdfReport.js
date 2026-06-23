/**
 * services/pdfReport.js
 *
 * Generates a multi-section A4 PDF report using PDFKit.
 * Returns a Buffer — ready to pipe to an HTTP response.
 *
 * Sections:
 *  1. Header banner — user name + generated date
 *  2. Summary stats cards — total, avg ATS, days-to-offer, active
 *  3. Status breakdown table — all 7 pipeline stages
 *  4. Applications by month — bar-chart approximation (PDFKit rectangles)
 *  5. Top 5 companies table — with share bar
 *  6. Footer
 */

import PDFDocument from 'pdfkit';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  primary:    '#6366f1',
  purple:     '#8b5cf6',
  dark:       '#1e293b',
  gray:       '#64748b',
  lightGray:  '#f1f5f9',
  border:     '#e2e8f0',
  white:      '#ffffff',
  green:      '#16a34a',
  amber:      '#d97706',
};

const STATUS_META = {
  applied:      { label: 'Applied',       color: '#0369a1' },
  phone_screen: { label: 'Phone Screen',  color: '#854d0e' },
  technical:    { label: 'Technical',     color: '#9a3412' },
  interview:    { label: 'Interview',     color: '#1d4ed8' },
  offer:        { label: 'Offer',         color: '#15803d' },
  rejected:     { label: 'Rejected',      color: '#b91c1c' },
  withdrawn:    { label: 'Withdrawn',     color: '#374151' },
};

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Draw a horizontal rule */
const hr = (doc, y, ml, mr) => {
  doc.moveTo(ml, y).lineTo(mr, y).strokeColor(C.border).lineWidth(0.5).stroke();
};

/** Draw a filled rectangle (convenience) */
const rect = (doc, x, y, w, h, color) =>
  doc.rect(x, y, w, h).fill(color);

/** Section heading */
const sectionHeading = (doc, text, x, y) => {
  doc.fillColor(C.dark).font('Helvetica-Bold').fontSize(12).text(text, x, y);
  return y + 18;
};

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * @param {object} data      Output of getUserReport()
 * @param {string} userName  Authenticated user's full name
 * @returns {Promise<Buffer>}
 */
export const generatePdfReport = (data, userName) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 40, bottom: 50, left: 40, right: 40 },
      info: {
        Title:   'HireTrail — Job Application Report',
        Author:  userName,
        Creator: 'HireTrail Platform',
        Subject: 'Job Application Analytics Report',
      },
    });

    const chunks = [];
    doc.on('data',  (chunk) => chunks.push(chunk));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const PW  = doc.page.width;           // 595
    const PH  = doc.page.height;          // 841
    const M   = 40;                       // margin
    const CW  = PW - M * 2;              // content width = 515

    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    // ── SECTION 1: Header Banner ──────────────────────────────────────────────
    rect(doc, 0, 0, PW, 90, C.primary);

    doc.fillColor(C.white).font('Helvetica-Bold').fontSize(20)
       .text('HireTrail', M, 18, { continued: false });

    doc.font('Helvetica-Bold').fontSize(11)
       .text('Job Application Report', M, 44);

    doc.fillColor('#c4b5fd').font('Helvetica').fontSize(9)
       .text(`${userName}  |  ${date}`, M, 65);

    let y = 110;

    // ── SECTION 2: Summary Stats Cards ───────────────────────────────────────
    y = sectionHeading(doc, 'Summary', M, y);

    const cards = [
      { label: 'Total Applications', value: data.totalApplications,                          color: C.primary },
      { label: 'Avg ATS Score',      value: data.avgAtsScore != null ? `${data.avgAtsScore}/100` : 'N/A', color: C.purple  },
      { label: 'Avg Days to Offer',  value: data.avgDaysToOffer != null ? `${data.avgDaysToOffer}d` : 'N/A', color: C.green   },
      { label: 'Still Applied',      value: data.byStatus?.applied ?? 0,                     color: C.amber   },
    ];

    const cardW = (CW - 9) / 4;
    cards.forEach((card, i) => {
      const cx = M + i * (cardW + 3);
      rect(doc, cx,     y,  cardW, 52, C.lightGray);
      rect(doc, cx,     y,  4,     52, card.color);  // left accent
      doc.fillColor(C.dark).font('Helvetica-Bold').fontSize(17)
         .text(String(card.value), cx + 8, y + 7, { width: cardW - 12 });
      doc.fillColor(C.gray).font('Helvetica').fontSize(7.5)
         .text(card.label,         cx + 8, y + 31, { width: cardW - 12 });
    });
    y += 68;

    // ── SECTION 3: Status Breakdown Table ────────────────────────────────────
    y = sectionHeading(doc, 'Status Breakdown', M, y);

    const STATUS_ORDER = ['applied','phone_screen','technical','interview','offer','rejected','withdrawn'];
    const SC = [CW - 140, 70, 70];  // col widths: name | count | %

    // Table header
    rect(doc, M, y, CW, 20, C.primary);
    doc.fillColor(C.white).font('Helvetica-Bold').fontSize(8.5);
    doc.text('Status',      M + 6,        y + 5, { width: SC[0] });
    doc.text('Count',       M + SC[0],    y + 5, { width: SC[1], align: 'right' });
    doc.text('% of Total',  M + SC[0] + SC[1], y + 5, { width: SC[2], align: 'right' });
    y += 20;

    STATUS_ORDER.forEach((status, i) => {
      const count = data.byStatus?.[status] ?? 0;
      const pct   = data.totalApplications > 0
        ? ((count / data.totalApplications) * 100).toFixed(1)
        : '0.0';
      const meta  = STATUS_META[status] || { label: status, color: C.gray };

      rect(doc, M, y, CW, 19, i % 2 === 0 ? C.white : C.lightGray);
      rect(doc, M, y, 4,  19, meta.color);  // status color accent

      doc.fillColor(C.dark).font('Helvetica').fontSize(8.5);
      doc.text(meta.label,       M + 8,             y + 4, { width: SC[0] - 8 });
      doc.text(count.toString(), M + SC[0],          y + 4, { width: SC[1], align: 'right' });
      doc.text(`${pct}%`,        M + SC[0] + SC[1],  y + 4, { width: SC[2], align: 'right' });
      y += 19;
    });

    // Table outer border
    doc.rect(M, y - 19 * STATUS_ORDER.length - 20, CW, 20 + 19 * STATUS_ORDER.length)
       .strokeColor(C.border).lineWidth(0.5).stroke();
    y += 16;

    // ── SECTION 4: Applications by Month (Bar Chart) ──────────────────────────
    const CHART_H    = 90;
    const CHART_AREA = y + CHART_H + 40;
    if (CHART_AREA > PH - M) { doc.addPage(); y = M; }

    y = sectionHeading(doc, 'Applications by Month', M, y);

    const months = data.applicationsByMonth || [];
    if (months.length > 0) {
      const maxCount   = Math.max(...months.map((m) => m.count), 1);
      const chartX     = M + 28;          // space for y-axis labels
      const chartW     = CW - 28;
      const barSlot    = chartW / months.length;
      const barW       = Math.min(30, barSlot - 4);

      // Axes
      doc.moveTo(chartX, y).lineTo(chartX, y + CHART_H).strokeColor(C.border).lineWidth(0.5).stroke();
      doc.moveTo(chartX, y + CHART_H).lineTo(M + CW, y + CHART_H).strokeColor(C.border).lineWidth(0.5).stroke();

      // Y-axis labels + grid lines
      [0, 0.5, 1].forEach((frac) => {
        const val  = Math.round(maxCount * frac);
        const lineY = y + CHART_H - frac * CHART_H;
        doc.fillColor(C.gray).font('Helvetica').fontSize(7)
           .text(val.toString(), M, lineY - 4, { width: 24, align: 'right' });
        if (frac > 0) {
          doc.moveTo(chartX, lineY).lineTo(M + CW, lineY)
             .dash(3, { space: 4 }).strokeColor(C.border).lineWidth(0.4).stroke().undash();
        }
      });

      // Bars + labels
      months.forEach((m, i) => {
        const barH  = Math.max(2, (m.count / maxCount) * (CHART_H - 2));
        const bx    = chartX + i * barSlot + (barSlot - barW) / 2;
        const barY  = y + CHART_H - barH;

        rect(doc, bx, barY, barW, barH, C.primary);

        // Count on top of bar
        if (barH > 13) {
          doc.fillColor(C.white).font('Helvetica-Bold').fontSize(7)
             .text(m.count.toString(), bx, barY + 3, { width: barW, align: 'center' });
        }

        // Month label on x-axis
        const [, mo] = m.month.split('-');
        const moLabel = MONTH_NAMES[(parseInt(mo, 10) - 1)] || mo;
        doc.fillColor(C.gray).font('Helvetica').fontSize(6.5)
           .text(moLabel, bx - 3, y + CHART_H + 4, { width: barW + 6, align: 'center' });
      });

      y += CHART_H + 24;
    } else {
      doc.fillColor(C.gray).font('Helvetica').fontSize(9)
         .text('No monthly data available.', M, y);
      y += 20;
    }

    // ── SECTION 5: Top Companies Table ────────────────────────────────────────
    if (y + 160 > PH - M) { doc.addPage(); y = M; }

    y = sectionHeading(doc, 'Top Companies', M, y);

    const companies = data.topCompanies || [];
    const CC = [CW - 170, 60, 110]; // col widths: company | apps | share bar

    // Table header
    rect(doc, M, y, CW, 20, C.primary);
    doc.fillColor(C.white).font('Helvetica-Bold').fontSize(8.5);
    doc.text('Company',      M + 6,                 y + 5, { width: CC[0] });
    doc.text('Applications', M + CC[0],              y + 5, { width: CC[1], align: 'right' });
    doc.text('Share',        M + CC[0] + CC[1] + 6,  y + 5, { width: CC[2] - 6 });
    y += 20;

    if (companies.length > 0) {
      const maxCo = companies[0]?.count || 1;
      companies.forEach((co, i) => {
        const pct   = data.totalApplications > 0
          ? ((co.count / data.totalApplications) * 100).toFixed(1) : '0.0';
        const barFill = Math.round((co.count / maxCo) * (CC[2] - 20));

        rect(doc, M, y, CW, 20, i % 2 === 0 ? C.white : C.lightGray);

        doc.fillColor(C.dark).font('Helvetica').fontSize(8.5);
        doc.text(co.name,          M + 6,        y + 5, { width: CC[0] - 6 });
        doc.text(co.count.toString(), M + CC[0], y + 5, { width: CC[1], align: 'right' });

        // Share bar
        const shareX = M + CC[0] + CC[1] + 6;
        rect(doc, shareX, y + 7, CC[2] - 20, 6, C.lightGray);
        if (barFill > 0) rect(doc, shareX, y + 7, barFill, 6, C.primary);

        doc.fillColor(C.gray).font('Helvetica').fontSize(7.5)
           .text(`${pct}%`, shareX + CC[2] - 16, y + 5, { width: 14, align: 'right' });
        y += 20;
      });
      doc.rect(M, y - 20 * companies.length - 20, CW, 20 + 20 * companies.length)
         .strokeColor(C.border).lineWidth(0.5).stroke();
    } else {
      doc.fillColor(C.gray).font('Helvetica').fontSize(9)
         .text('No company data available.', M, y);
    }

    // ── FOOTER ────────────────────────────────────────────────────────────────
    const footerY = PH - 32;
    rect(doc, 0, footerY - 4, PW, 36, C.lightGray);
    hr(doc, footerY - 4, 0, PW);
    doc.fillColor(C.gray).font('Helvetica').fontSize(7.5)
       .text(
         `HireTrail — Placement Tracker & ATS Platform  |  Generated: ${date}`,
         M, footerY + 4,
         { width: CW, align: 'center' }
       );

    doc.end();
  });

export default generatePdfReport;
