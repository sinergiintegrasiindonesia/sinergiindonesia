# Server-side files (Rumahweb / cPanel)

The website is served from Vercel at `www.sinergiindonesia.com`. These files
run on the Rumahweb hosting that the apex domain points to, and are **not**
deployed to Vercel (see `.vercelignore`).

| File | Goes to | Purpose |
| --- | --- | --- |
| `contact.php` | `public_html/contact.php` | Contact-form handler. Speaks SMTP directly — Rumahweb disables PHP `mail()`. |
| `smtp-config.sample.php` | `/home/<user>/smtp-config.php` | Credentials template. Rename, fill in, keep **above** `public_html`. |
| `apex-index.php` | `public_html/index.php` | Redirects the apex to `www`. |
| `SMTP-folder.htaccess` | only if the config sits inside `public_html` | Blocks listing and direct access. Not needed when the config is above the web root. |

## Why the apex stays on Rumahweb

The MX record is `0 sinergiindonesia.com`, so mail is delivered by resolving
the **apex A record**. It must keep pointing at Rumahweb (`202.10.43.155`).
Repointing it at Vercel would bounce all incoming email. The apex therefore
serves only a redirect, and `contact.php` is exempted from that redirect.

## Credentials

`smtp-config.php` is never committed — `.gitignore` blocks it. It currently
lives at `/home/sins2914/smtp-config.php`, outside the web root, which is the
correct place. Verify it is unreachable:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://sinergiindonesia.com/smtp-config.php   # want 404
```
