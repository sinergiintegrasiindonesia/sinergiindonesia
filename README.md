# sinergiindonesia.com

Company profile site for **PT Sinergi Integrasi Indonesia**.
Static HTML/CSS/JS plus one Vercel serverless function for the contact form.

## Run locally

```bash
python3 -m http.server 4321
```

Open <http://localhost:4321/>. The contact form will fail locally (no
`/api/contact` on a plain static server) and shows its fallback message —
that is expected.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The whole site — single page, anchored sections |
| `assets/css/style.css` | Design tokens, layout, components |
| `assets/js/main.js` | Mobile nav, footer year, contact-form submission |
| `assets/img/logo-mark.svg` | Logo mark **(interim vector recreation — replace)** |
| `assets/img/swoosh.svg` | Brand swoosh under the hero |
| `api/contact.js` | Serverless function: validates and emails the enquiry |
| `assets/img/jumpserver.svg` | JumpServer wordmark (from jumpserver.com) |
| `assets/img/lenovo.svg` | Lenovo wordmark |

## Content source

Most copy comes from `SII_Company_Profile.pdf` (2026): positioning, vision,
mission, core values, the four-step approach, and the six "why us" points.

The profile lists three service lines. Two more were added on the client's
instruction and are **not** in the PDF:

- **Software & Application Development** (card 02)
- **Software Licensing & Subscriptions** (card 04)

Their detail bullets were written to match the profile's house style. Review
them for accuracy before the site goes live — especially the licensing
categories, which are deliberately generic and name no vendor partnerships.

## Outstanding — three things to finish

### 1. Replace the logo

`assets/img/logo-mark.svg` is a vector approximation drawn from a screenshot,
not the real brand asset. Drop the official file in and point the three
references at it:

```bash
grep -n "logo-mark.svg" index.html
```

### 2. Turn off Vercel Authentication

The whole deployment — including `/api/contact` — currently returns a login
redirect, so **the contact form cannot work for the public** until this is off.

Vercel dashboard → project `sii-corporate` → Settings → Deployment
Protection → set Vercel Authentication to **Disabled**.

### 3. Connect the email sender

`api/contact.js` posts to Resend. Add these environment variables under
Settings → Environment Variables, then redeploy:

| Variable | Value |
| --- | --- |
| `RESEND_API_KEY` | API key from resend.com |
| `CONTACT_FROM` | verified sender, e.g. `Website <website@sinergiindonesia.com>` |

Until `RESEND_API_KEY` exists the endpoint returns HTTP 503 and the form tells
the visitor to email directly — it never silently drops a message.

Submissions are delivered to `contact@sinergiindonesia.com` with the sender's
address set as `reply_to`.

## Contact details

Every address on the site and in the API is `contact@sinergiindonesia.com`.

Two phone numbers are shown, labelled Office and Mobile:

| Label | Number | `tel:` link |
| --- | --- | --- |
| Office | 021-2940-0153 | `tel:+622129400153` |
| Mobile | +62 851-8308-8608 | `tel:+6285183088608` |

Superseded, kept here only so nobody reintroduces them:
`contact@sinergiintegration.com` (old live site) and
`info@sinergiindonesia.com` (profile PDF).

## Products section

`#products` presents **JumpServer**, the open-source Privileged Access
Management platform, with **Lenovo** named as the hardware partner. A scrolling
logo banner sits under the hero.

Product detail is summarised from jumpserver.com. Vendor statistics
(3,000+ enterprise customers, 500k+ deployments, 30k+ GitHub stars) are
attributed to JumpServer on the page, not claimed as ours.

**Before launch, confirm you are authorised to display both marks.** Lenovo in
particular has strict partner branding rules and normally supplies approved
logo assets through its partner portal; the file here came from a public
source, not from Lenovo.

## Deploy

Vercel project `sii-corporate`, team `sinergiintegrasiindonesia-6896`.

**Deploys via the Vercel MCP integration only succeed when they create a new
project** — pushing to an existing one returns 403. Connect this folder to a Git
repository and link that repo in Vercel to get normal deploy-on-push.
