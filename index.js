'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/"/g, '')
  : undefined;

admin.initializeApp({
  credential: admin.credential.cert({
    projectId:    process.env.FIREBASE_PROJECT_ID,
    privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
    privateKey:   privateKey,
    clientEmail:  process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const db = admin.firestore();

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const app  = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

function validatePayload({ fullName, email, service, message }) {
  const errors = [];
  if (!fullName || !fullName.trim()) errors.push('Full name is required.');
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email.trim())) errors.push('A valid email is required.');
  const allowed = ['Bookkeeping', 'Analytics & Reporting'];
  if (!service || !allowed.includes(service)) errors.push('Please select a valid service.');
  if (!message || !message.trim()) errors.push('Message is required.');
  return errors;
}

app.post('/submit-form', formLimiter, async (req, res) => {
  const { fullName, email, service, message } = req.body;
  const errors = validatePayload({ fullName, email, service, message });
  if (errors.length) return res.status(400).json({ success: false, message: errors[0] });

  const lead = {
    fullName: fullName.trim(),
    email:    email.trim().toLowerCase(),
    service,
    message:  message.trim(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  try {
    const docRef = await db.collection('leads').add(lead);
    console.log('Lead saved:', docRef.id);
    await sendNotificationEmail(lead);
    return res.status(200).json({ success: true, message: 'Message received!' });
  } catch (err) {
    console.error('Error processing form submission:', err);
    return res.status(500).json({ success: false, message: 'An internal error occurred. Please try again later.' });
  }
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendNotificationEmail({ fullName, email, service, message }) {
  const managerEmail = process.env.MANAGER_EMAIL;
  if (!managerEmail) return;
  await transporter.sendMail({
    from:    `"TheBookkeepers" <${process.env.SMTP_USER}>`,
    to:      managerEmail,
    replyTo: email,
    subject: `New Lead: ${service} — ${fullName}`,
    html: `<h2>New Lead</h2>
      <p><b>Name:</b> ${escapeHtml(fullName)}</p>
      <p><b>Email:</b> ${escapeHtml(email)}</p>
      <p><b>Service:</b> ${escapeHtml(service)}</p>
      <p><b>Message:</b> ${escapeHtml(message)}</p>`,
  });
  console.log('Email sent to', managerEmail);
}

app.get('*', (req, res) => {
  res.sendFile(path.join(__dir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`TheBookkeepers server running on http://localhost:${PORT}`);
  console.log(`Firebase project: ${process.env.FIREBASE_PROJECT_ID}`);
  console.log(`Notifications to: ${process.env.MANAGER_EMAIL}`);
});
