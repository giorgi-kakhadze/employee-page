'use strict';
/* Sign-in with Microsoft Entra ID: OpenID Connect authorization-code flow with PKCE and a confidential client (client secret held in Key Vault).
   The e-mail that identifies the person comes from the SIGNED id token only. The tool's own roles still live in the tool (Access management);
   Entra decides two things: who is a company employee at all (tenant + allowed domains) and who is a tool administrator (app role / group). */
const crypto = require('crypto'), https = require('https'), http = require('http'), { URL } = require('url');
const { Jwks, verifyIdToken } = require('./jwt');

function postForm(url, form) {
  return new Promise((res, rej) => {
    const u = new URL(url), body = new URLSearchParams(form).toString();
    const r = (u.protocol === 'http:' ? http : https).request({ method: 'POST', hostname: u.hostname, port: u.port || undefined, path: u.pathname + u.search, timeout: 10000, headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } }, (s) => {
      let d = ''; s.on('data', c => { d += c; if (d.length > 2e6) s.destroy(); }); s.on('end', () => { try { res({ status: s.statusCode, json: JSON.parse(d) }); } catch (e) { rej(new Error('bad token response')); } });
    });
    r.on('error', rej).on('timeout', () => r.destroy(new Error('timeout'))); r.end(body);
  });
}
const sha = (s) => crypto.createHash('sha256').update(s).digest('base64url');

module.exports = function oidc(cfg, sign, unsign, opts) {
  opts = opts || {}; const E = cfg.entra, authority = (opts.authority || 'https://login.microsoftonline.com').replace(/\/+$/, '');
  const jwks = new Jwks(E.tenant, opts.fetchJson, authority), redirect = cfg.publicUrl + '/auth/callback';
  return {
    /* step 1: where to send the browser; returns { url, cookie } (cookie = signed state kept for 10 minutes) */
    start(returnTo) {
      const state = crypto.randomBytes(18).toString('base64url'), nonce = crypto.randomBytes(18).toString('base64url'), ver = crypto.randomBytes(32).toString('base64url');
      const q = new URLSearchParams({ client_id: E.clientId, response_type: 'code', redirect_uri: redirect, response_mode: 'query', scope: 'openid profile email', state, nonce, code_challenge: sha(ver), code_challenge_method: 'S256', prompt: 'select_account' });
      return { url: authority + '/' + E.tenant + '/oauth2/v2.0/authorize?' + q, cookie: sign({ s: state, n: nonce, v: ver, r: /^\/[^/\\]/.test(returnTo || '') || returnTo === '/' ? returnTo : '/', x: Date.now() + 600e3 }) };
    },
    /* step 2: the browser comes back with ?code=&state= ; returns { email, name, admin, roles } or throws */
    async finish(query, cookieVal) {
      const st = unsign(cookieVal); if (!st || st.x < Date.now()) throw new Error('sign-in expired, start again');
      if (query.error) throw new Error('Microsoft: ' + String(query.error_description || query.error).slice(0, 200));
      if (!query.state || !crypto.timingSafeEqual(Buffer.from(String(query.state)), Buffer.from(st.s))) throw new Error('state mismatch');
      if (!query.code || String(query.code).length > 4000) throw new Error('no code');
      const r = await postForm(authority + '/' + E.tenant + '/oauth2/v2.0/token', { client_id: E.clientId, client_secret: E.clientSecret, grant_type: 'authorization_code', code: query.code, redirect_uri: redirect, code_verifier: st.v, scope: 'openid profile email' });
      if (r.status !== 200 || !r.json.id_token) throw new Error('token exchange failed');
      const c = await verifyIdToken(r.json.id_token, { jwks, tenant: E.tenant, clientId: E.clientId, nonce: st.n });
      const email = String(c.email || c.preferred_username || c.upn || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('no e-mail in the sign-in');
      const dom = email.split('@')[1]; if (E.allowedDomains.length && E.allowedDomains.indexOf(dom) < 0) throw new Error('this account is not from the company');
      const roles = Array.isArray(c.roles) ? c.roles.map(String) : [], groups = Array.isArray(c.groups) ? c.groups.map(String) : [];
      const admin = roles.indexOf(E.adminRole) >= 0 || (!!E.adminGroup && groups.indexOf(E.adminGroup) >= 0) || cfg.bootstrapAdmins.indexOf(email) >= 0;
      return { email, name: String(c.name || '').slice(0, 80), admin, returnTo: st.r, idToken: r.json.id_token };
    },
    logoutUrl() { return authority + '/' + E.tenant + '/oauth2/v2.0/logout?post_logout_redirect_uri=' + encodeURIComponent(cfg.publicUrl + '/signed-out'); }
  };
};
