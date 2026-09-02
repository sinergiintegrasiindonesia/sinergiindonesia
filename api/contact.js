/* POST /api/contact — validates an enquiry and emails it to the inbox.
 *
 * Requires two environment variables set in the Vercel project:
 *   RESEND_API_KEY   API key from https://resend.com
 *   CONTACT_FROM     verified sender, e.g. "website@sinergiindonesia.com"
 *                    (falls back to Resend's shared onboarding@resend.dev)
 *
 * Without RESEND_API_KEY the endpoint returns 503 and the form tells the
 * visitor to email directly, rather than silently swallowing the message.
 */

const TO = 'contact@sinergiindonesia.com';
const MAX = { name: 120, email: 200, company: 160, phone: 40, subject: 120, message: 5000 };

function clean(value, limit) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
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

  const name    = clean(body.name, MAX.name);
  const email   = clean(body.email, MAX.email);
  const company = clean(body.company, MAX.company);
  const phone   = clean(body.phone, MAX.phone);
  const subject = clean(body.subject, MAX.subject) || 'General enquiry';
  const message = clean(body.message, MAX.message);

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ error: 'That email address does not look valid.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'The contact form is not connected yet. Please email ' + TO + ' directly.'
    });
  }

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

  try {
    const resend = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.CONTACT_FROM || 'Website <onboarding@resend.dev>',
        to: [TO],
        reply_to: email,
        subject: `[Website] ${subject} — ${name}`,
        html
      })
    });

    if (!resend.ok) {
      const detail = await resend.text();
      console.error('Resend rejected the message:', resend.status, detail);
      return res.status(502).json({ error: 'We could not send your message. Please email ' + TO + '.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Contact form failed:', err);
    return res.status(500).json({ error: 'Unexpected error. Please email ' + TO + '.' });
  }
}
