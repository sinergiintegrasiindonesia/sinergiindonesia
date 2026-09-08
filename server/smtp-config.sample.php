<?php
/**
 * SMTP credentials for the contact form.
 *
 * SETUP
 *   1. Rename this file to  smtp-config.php
 *   2. Put your real password in SMTP_PASS below
 *   3. Upload it ONE LEVEL ABOVE public_html if you can — e.g. /home/<user>/
 *      so it is never web-readable. contact.php looks there first.
 *      If you must keep it beside contact.php, the supplied .htaccess
 *      blocks direct access to it.
 *
 * Never commit this file to git.
 */

return [
    'host' => 'mail.sinergiindonesia.com',  // Rumahweb: mail.<yourdomain>
    'port' => 465,                          // 465 = SSL, 587 = STARTTLS
    'user' => 'admin@sinergiindonesia.com',
    'pass' => 'PUT-YOUR-PASSWORD-HERE',

    'from'      => 'admin@sinergiindonesia.com',   // should match 'user'
    'from_name' => 'Website Sinergi Integrasi Indonesia',
    'to'        => 'contact@sinergiindonesia.com',
];
