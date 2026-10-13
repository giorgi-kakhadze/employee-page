'use strict';
/* Security headers sent on every response. */
module.exports = function headers(cfg) {
  const csp = [
    "default-src 'none'",
    "script-src 'self' 'unsafe-inline'",          // the tool uses inline handlers; see docs/SECURITY.md "known limits"
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:", "media-src 'self' data: blob:", "font-src 'self' data:",
    "connect-src 'self'",                            // nothing can be sent to any other site
    "frame-src 'self' blob: data:", "worker-src 'self' blob:", "manifest-src 'self'",
    "object-src 'none'", "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'",
    cfg.prod ? 'upgrade-insecure-requests' : ''
  ].filter(Boolean).join('; ');
  const base = {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), clipboard-write=(self)',
    'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Resource-Policy': 'same-origin', 'X-Robots-Tag': 'noindex, nofollow',
    'X-DNS-Prefetch-Control': 'off'
  };
  if (cfg.prod) base['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  return base;
};
