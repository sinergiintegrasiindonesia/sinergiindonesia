<?php
/**
 * Fallback for hosts where .htaccess rewrites are disabled.
 * Replaces Rumahweb's "under construction" placeholder.
 *
 * Only this file needs to change — the apex A record stays on Rumahweb
 * so that the MX record (0 sinergiindonesia.com) keeps resolving to the
 * mail server. Repointing the apex would bounce all incoming email.
 */
$path = $_SERVER['REQUEST_URI'] ?? '/';
header('Location: https://www.sinergiindonesia.com' . $path, true, 301);
exit;
