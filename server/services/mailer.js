/**
 * services/mailer.js
 *
 * Nodemailer transporter + sendEmail helper + HTML email templates.
 * Configured via SMTP env vars. Gracefully skips sending in test/dev
 * if credentials are not set (logs a warning instead of throwing).
 */

import nodemailer from 'nodemailer';

// ─── Transporter ──────────────────────────────────────────────────────────────
let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn(
      '⚠️  [Mailer] SMTP credentials not configured. Emails will be logged but not sent.'
    );
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true = port 465, false = STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  });

  return transporter;
};

// ─── HTML Templates ───────────────────────────────────────────────────────────

/**
 * Status badge colors for the email template.
 */
const STATUS_COLORS = {
  applied:      { bg: '#e0f2fe', text: '#0369a1', label: 'Applied'       },
  phone_screen: { bg: '#fef9c3', text: '#854d0e', label: 'Phone Screen'  },
  technical:    { bg: '#fde8d8', text: '#9a3412', label: 'Technical'     },
  interview:    { bg: '#dbeafe', text: '#1d4ed8', label: 'Interview'     },
  offer:        { bg: '#dcfce7', text: '#15803d', label: 'Offer'         },
  rejected:     { bg: '#fee2e2', text: '#b91c1c', label: 'Rejected'      },
  withdrawn:    { bg: '#f3f4f6', text: '#374151', label: 'Withdrawn'     },
};

/**
 * Generate an HTML follow-up reminder email.
 *
 * @param {{
 *   userName:      string,
 *   companyName:   string,
 *   jobTitle:      string,
 *   status:        string,
 *   daysSinceApplied: number,
 *   ctaUrl:        string,
 * }} data
 * @returns {string} HTML email string
 */
export const followUpReminderTemplate = ({
  userName,
  companyName,
  jobTitle,
  status,
  daysSinceApplied,
  ctaUrl,
}) => {
  const statusStyle = STATUS_COLORS[status] || STATUS_COLORS.applied;
  const currentYear = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Follow-Up Reminder — HireTrail</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#f1f5f9;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">
                🎯 HireTrail
              </h1>
              <p style="margin:6px 0 0;color:#c4b5fd;font-size:13px;letter-spacing:0.5px;text-transform:uppercase;">
                Job Application Tracker
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">

              <p style="margin:0 0 8px;color:#64748b;font-size:14px;">Hey ${userName || 'there'},</p>
              <h2 style="margin:0 0 24px;color:#1e293b;font-size:20px;font-weight:600;line-height:1.3;">
                Time to follow up on your application 📬
              </h2>

              <!-- Application Card -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:28px;">
                <tr>
                  <td style="padding:24px 28px;">

                    <!-- Company + Title -->
                    <p style="margin:0 0 4px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">
                      Company
                    </p>
                    <p style="margin:0 0 16px;color:#1e293b;font-size:18px;font-weight:700;">
                      ${companyName}
                    </p>

                    <p style="margin:0 0 4px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">
                      Role
                    </p>
                    <p style="margin:0 0 16px;color:#334155;font-size:15px;font-weight:500;">
                      ${jobTitle}
                    </p>

                    <!-- Status + Days row -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:50%;vertical-align:top;">
                          <p style="margin:0 0 6px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">
                            Current Status
                          </p>
                          <span style="display:inline-block;padding:5px 14px;border-radius:20px;font-size:13px;font-weight:600;background:${statusStyle.bg};color:${statusStyle.text};">
                            ${statusStyle.label}
                          </span>
                        </td>
                        <td style="width:50%;vertical-align:top;text-align:right;">
                          <p style="margin:0 0 6px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">
                            Days Since Applied
                          </p>
                          <span style="display:inline-block;padding:5px 14px;border-radius:20px;font-size:13px;font-weight:700;background:#fef3c7;color:#92400e;">
                            ${daysSinceApplied} day${daysSinceApplied === 1 ? '' : 's'}
                          </span>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

              <!-- Tip -->
              <p style="margin:0 0 28px;color:#475569;font-size:14px;line-height:1.7;">
                A polite follow-up email after <strong>7–10 days</strong> of no response can significantly
                increase your chances of getting a reply. Keep it brief and express continued interest.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${ctaUrl}"
                      style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.3px;box-shadow:0 4px 15px rgba(99,102,241,0.35);">
                      View Application →
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;line-height:1.6;">
                You received this email because you have a job application tracked in HireTrail.<br/>
                To manage your reminder preferences, visit your
                <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/settings"
                  style="color:#6366f1;text-decoration:none;">account settings</a>.
              </p>
              <p style="margin:0;color:#cbd5e1;font-size:11px;">
                © ${currentYear} HireTrail. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
};

// ─── sendEmail helper ─────────────────────────────────────────────────────────

/**
 * Send an email via the configured SMTP transporter.
 * If SMTP is not configured, logs the email content and returns without sending.
 *
 * @param {string} to      Recipient email address
 * @param {string} subject Email subject line
 * @param {string} html    HTML body content
 * @returns {Promise<{messageId?: string, skipped?: boolean}>}
 */
export const sendEmail = async (to, subject, html) => {
  const transport = getTransporter();

  if (!transport) {
    // Development fallback — log email instead of sending
    console.log('\n📧 [Mailer] SMTP not configured — email would have been sent:');
    console.log(`   To:      ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log('   Body:    [HTML template]\n');
    return { skipped: true };
  }

  try {
    const info = await transport.sendMail({
      from: process.env.EMAIL_FROM || `"HireTrail" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });

    console.log(`✅ [Mailer] Email sent to ${to} | messageId: ${info.messageId}`);
    return { messageId: info.messageId };
  } catch (err) {
    console.error(`❌ [Mailer] Failed to send email to ${to}: ${err.message}`);
    throw err; // re-throw so BullMQ worker can retry
  }
};

export default { sendEmail, followUpReminderTemplate };
