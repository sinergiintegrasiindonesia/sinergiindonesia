/* POST /api/contact — validates an enquiry and emails it to the inbox.
 *
 * Two delivery transports are supported. The first one configured wins:
 *
 *   1. SMTP  — set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 *              (port 465 = implicit TLS, 587 = STARTTLS)
 *   2. Resend — set RESEND_API_KEY
 *
 * With neither configured the endpoint returns 503 and the form tells the
 * visitor to email directly, rather than silently swallowing the message.
 */

const TO = process.env.CONTACT_TO || 'contact@sinergiindonesia.com';
const MAX = { name: 120, email: 200, company: 160, phone: 40, subject: 120, message: 5000 };

function clean(value, limit) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function buildBody({ name, email, company, phone, subject, message }) {
  const rows = [
    ['Name', name], ['Email', email], ['Company', company || '—'],
    ['Phone', phone || '—'], ['Interested in', subject]
  ].map(([k, v]) =>
    `<tr><td style="padding:6px 14px 6px 0;color:#6b7888;font:600 13px system-ui">${k}</td>` +
    `<td style="padding:6px 0;color:#131a22;font:14px system-ui">${escapeHtml(v)}</td></tr>`
  ).join('');

  const html =
    `<div style="font:14px/1.6 system-ui,sans-serif;color:#131a22">` +
    `<h2 style="margin:0 0 4px;font-size:17px">New enquiry from sinergiindonesia.com</h2>` +
    `<p style="margin:0 0 18px;color:#6b7888;font-size:13px">Submitted via the website contact form.</p>` +
    `<table style="border-collapse:collapse;margin-bottom:18px">${rows}</table>` +
    `<div style="border-top:1px solid #e6eaee;padding-top:14px">` +
    `<div style="color:#6b7888;font:600 13px system-ui;margin-bottom:6px">Message</div>` +
    `<div style="white-space:pre-wrap">${escapeHtml(message)}</div></div></div>`;

  const text =
    `New enquiry from sinergiindonesia.com\n\n` +
    `Name: ${name}\nEmail: ${email}\nCompany: ${company || '-'}\n` +
    `Phone: ${phone || '-'}\nInterested in: ${subject}\n\n${message}\n`;

  return { html, text };
}

async function sendViaSmtp(fields) {
  const { default: nodemailer } = await import('nodemailer');
  const port = Number(process.env.SMTP_PORT || 587);

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,          // 465 is implicit TLS; 587 upgrades via STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000
  });

  const { html, text } = buildBody(fields);
  await transport.sendMail({
    // The envelope sender must be a mailbox on your own domain, or the message
    // will fail SPF and be rejected. Never put the visitor's address here.
    from: process.env.CONTACT_FROM || `Website <${process.env.SMTP_USER}>`,
    to: TO,
    replyTo: `${fields.name} <${fields.email}>`,
    subject: `[Website] ${fields.subject} — ${fields.name}`,
    text,
    html
  });
}

async function sendViaResend(fields) {
  const { html, text } = buildBody(fields);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM || 'Website <onboarding@resend.dev>',
      to: [TO],
      reply_to: fields.email,
      subject: `[Website] ${fields.subject} — ${fields.name}`,
      html,
      text
    })
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Missing body' });

  // Honeypot: a real person never fills this in.
  if (clean(body.website, 100)) return res.status(200).json({ ok: true });

  const fields = {
    name:    clean(body.name, MAX.name),
    email:   clean(body.email, MAX.email),
    company: clean(body.company, MAX.company),
    phone:   clean(body.phone, MAX.phone),
    subject: clean(body.subject, MAX.subject) || 'General enquiry',
    message: clean(body.message, MAX.message)
  };

  if (!fields.name || !fields.email || !fields.message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fields.email)) {
    return res.status(400).json({ error: 'That email address does not look valid.' });
  }

  const transport = process.env.SMTP_HOST ? 'smtp'
                  : process.env.RESEND_API_KEY ? 'resend'
                  : null;

  if (!transport) {
    return res.status(503).json({
      error: 'The contact form is not connected yet. Please email ' + TO + ' directly.'
    });
  }

  try {
    if (transport === 'smtp') await sendViaSmtp(fields);
    else await sendViaResend(fields);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(`Contact form failed via ${transport}:`, err);
    return res.status(502).json({
      error: 'We could not send your message. Please email ' + TO + '.'
    });
  }
}
