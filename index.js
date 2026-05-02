/* ============================================================
   TheBookkeepers — server/index.js
   Express server | Firebase Firestore | Nodemailer
   ============================================================ */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express   = require('express');
const path      = require('path');
const admin     = require('firebase-admin');
const nodemailer = require('nodemailer');
const rateLimit  = require('express-rate-limit');

/* ══════════════════════════════════════════
   Firebase Admin initialisation
══════════════════════════════════════════ */
let serviceAccount;

try {
  // Option A — JSON key file path supplied in .env
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    serviceAccount = require(path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH));
  }
  // Option B — individual env vars (useful for hosting platforms like Railway, Render, etc.)
  else {
    serviceAccount = {
      type:                        'service_account',
      project_id:                  process.env.FIREBASE_PROJECT_ID,
      private_key_id:              process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key:                 (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      client_email:                process.env.FIREBASE_CLIENT_EMAIL,
      client_id:                   process.env.FIREBASE_CLIENT_ID,
      auth_uri:                    'https://accounts.google.com/o/oauth2/auth',
      token_uri:                   'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url:        process.env.FIREBASE_CLIENT_CERT_URL,
    };
  }
} catch (err) {
  console.error('❌  Failed to load Firebase service account credentials:', err.message);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

/* ══════════════════════════════════════════
   Nodemailer transporter
══════════════════════════════════════════ */
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',   // true for port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/* ══════════════════════════════════════════
   Express app
══════════════════════════════════════════ */
const app  = express();
const PORT = process.env.PORT || 3000;

/* ── Middleware ── */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the /public folder as static files
app.use(express.static(__dirname));

/* ── Rate limiter — max 10 submissions per IP per 15 min ── */
const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  message:  { success: false, message: 'Too many requests. Please try again later.' },
});

/* ══════════════════════════════════════════
   Input validation helper
══════════════════════════════════════════ */
function validatePayload({ fullName, email, service, message }) {
  const errors = [];

  if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
    errors.push('Full name is required.');
  } else if (fullName.trim().length > 120) {
    errors.push('Full name is too long.');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email.trim())) {
    errors.push('A valid email address is required.');
  }

  const allowed = ['Bookkeeping', 'Analytics & Reporting'];
  if (!service || !allowed.includes(service)) {
    errors.push('Please select a valid service.');
  }

  if (!message || typeof message !== 'string' || !message.trim()) {
    errors.push('Message is required.');
  } else if (message.trim().length > 2000) {
    errors.push('Message is too long (max 2000 characters).');
  }

  return errors;
}

/* ══════════════════════════════════════════
   POST /submit-form
══════════════════════════════════════════ */
app.post('/submit-form', formLimiter, async (req, res) => {
  const { fullName, email, service, message } = req.body;

  /* 1. Validate */
  const errors = validatePayload({ fullName, email, service, message });
  if (errors.length) {
    return res.status(400).json({ success: false, message: errors[0] });
  }

  const lead = {
    fullName: fullName.trim(),
    email:    email.trim().toLowerCase(),
    service,
    message:  message.trim(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  try {
    /* 2. Save to Firestore */
    const docRef = await db.collection('leads').add(lead);dir
    console.log(`✅  Lead saved to Firestore — ID: ${docRef.id}`);

    /* 3. Send email notification */
    await sendNotificationEmail(lead);

    return res.status(200).json({
      success: true,
      message: 'Your message has been received. We will be in touch within 1 business day.',
    });

  } catch (err) {
    console.error('❌  Error processing form submission:', err);
    return res.status(500).json({
      success: false,
      message: 'An internal error occurred. Please try again later.',
    });
  }
});

/* ══════════════════════════════════════════
   Nodemailer — send notification email
══════════════════════════════════════════ */
async function sendNotificationEmail({ fullName, email, service, message }) {
  const managerEmail = process.env.MANAGER_EMAIL;

  if (!managerEmail) {
    console.warn('⚠️  MANAGER_EMAIL not set — skipping email notification.');
    return;
  }

  const mailOptions = {
    from:    `"TheBookkeepers Website" <${process.env.SMTP_USER}>`,
    to:      managerEmail,
    replyTo: email,
    subject: `📬 New Lead: ${service} — ${fullName}`,
    text: [
      'A new enquiry has been submitted via the TheBookkeepers website.',
      '',
      `Full Name : ${fullName}`,
      `Email     : ${email}`,
      `Service   : ${service}`,
      `Message   :`,
      message,
      '',
      '---',
      'You can reply directly to this email to respond to the client.',
    ].join('\n'),
    html: `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8f9fc;padding:0;border-radius:12px;overflow:hidden;">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#0b1a35,#1a3461);padding:32px 40px;text-align:center;">
          <div style="display:inline-flex;align-items:center;gap:10px;">
            <div style="width:42px;height:42px;background:#f97316;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:0.8rem;vertical-align:middle;">TB</div>
            <span style="color:#fff;font-weight:700;font-size:1.15rem;vertical-align:middle;">The<span style="color:#f97316;">Bookkeepers</span></span>
          </div>
          <p style="color:rgba(255,255,255,0.7);margin:12px 0 0;font-size:0.9rem;">New Website Enquiry</p>
        </div>
        <!-- Body -->
        <div style="background:#fff;padding:40px;">
          <h2 style="color:#0b1a35;font-size:1.3rem;margin:0 0 24px;">📬 New Lead Received</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:12px 16px;background:#f8f9fc;border-radius:8px;font-weight:600;color:#64748b;font-size:0.85rem;width:130px;">Full Name</td>
              <td style="padding:12px 16px;color:#1e293b;font-size:0.95rem;">${escapeHtml(fullName)}</td>
            </tr>
            <tr><td colspan="2" style="padding:4px;"></td></tr>
            <tr>
              <td style="padding:12px 16px;background:#f8f9fc;border-radius:8px;font-weight:600;color:#64748b;font-size:0.85rem;">Email</td>
              <td style="padding:12px 16px;color:#1e293b;font-size:0.95rem;"><a href="mailto:${escapeHtml(email)}" style="color:#f97316;">${escapeHtml(email)}</a></td>
            </tr>
            <tr><td colspan="2" style="padding:4px;"></td></tr>
            <tr>
              <td style="padding:12px 16px;background:#f8f9fc;border-radius:8px;font-weight:600;color:#64748b;font-size:0.85rem;">Service</td>
              <td style="padding:12px 16px;color:#1e293b;font-size:0.95rem;">
                <span style="background:#fff7ed;color:#f97316;padding:4px 12px;border-radius:20px;font-size:0.85rem;font-weight:600;">${escapeHtml(service)}</span>
              </td>
            </tr>
            <tr><td colspan="2" style="padding:4px;"></td></tr>
            <tr>
              <td style="padding:12px 16px;background:#f8f9fc;border-radius:8px;font-weight:600;color:#64748b;font-size:0.85rem;vertical-align:top;">Message</td>
              <td style="padding:12px 16px;color:#1e293b;font-size:0.95rem;line-height:1.65;">${escapeHtml(message).replace(/\n/g, '<br>')}</td>
            </tr>
          </table>
          <div style="margin-top:32px;padding:16px;background:#fff7ed;border:1px solid rgba(249,115,22,0.3);border-radius:8px;font-size:0.85rem;color:#9a3412;">
            💡 Reply directly to this email to respond to <strong>${escapeHtml(fullName)}</strong>.
          </div>
        </div>
        <!-- Footer -->
        <div style="background:#f8f9fc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="color:#94a3b8;font-size:0.78rem;margin:0;">© 2025 TheBookkeepers · hello@thebookkeepers.com</p>
        </div>
      </div>
    `,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`📧  Notification email sent — Message ID: ${info.messageId}`);
}

/* Simple HTML escape to prevent XSS in email */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Catch-all: serve index.html for any unknown route ── */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/* ══════════════════════════════════════════
   Start server
══════════════════════════════════════════ */
app.listen(PORT, () => {
  console.log(`\n🚀  TheBookkeepers server running on http://localhost:${PORT}`);
  console.log(`📁  Serving static files from /public`);
  console.log(`🔥  Firebase project: ${process.env.FIREBASE_PROJECT_ID || '(not set)'}`);
  console.log(`📧  Notifications → ${process.env.MANAGER_EMAIL || '(MANAGER_EMAIL not set)'}\n`);
});
