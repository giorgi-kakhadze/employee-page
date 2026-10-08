'use strict';
/* Microsoft Entra ID sign-in, tested against a local stand-in for Entra (same endpoints, real RSA signatures). */
const http = require('http'), crypto = require('crypto');
const { ok, section, done, sample } = require('./util'); const { start } = require('./lib');
const TENANT = 'tenant-1111', CID = 'client-2222';
(async () => {
  const kp = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }), other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = Object.assign(kp.publicKey.export({ format: 'jwk' }), { kid: 'k1', use: 'sig', alg: 'RS256' });
  const codes = {}; let override = {};
  const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
  function mint(claims, key, alg, kid) { const h = b64({ alg: alg || 'RS256', typ: 'JWT', kid: kid || 'k1' }), p = b64(claims); if (alg === 'none') return h + '.' + p + '.'; return h + '.' + p + '.' + crypto.sign('RSA-SHA256', Buffer.from(h + '.' + p), key || kp.privateKey).toString('base64url'); }
  const idp = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/' + TENANT + '/discovery/v2.0/keys') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ keys: [jwk] })); }
    if (u.pathname === '/' + TENANT + '/oauth2/v2.0/token' && req.method === 'POST') {
      let d = ''; req.on('data', (c) => d += c); req.on('end', () => {
        const f = Object.fromEntries(new URLSearchParams(d)), c = codes[f.code]; delete codes[f.code]; res.setHeader('content-type', 'application/json');
        if (!c || f.client_secret !== 'shh' || f.client_id !== CID) { res.statusCode = 400; return res.end('{"error":"invalid_grant"}'); }
        if (crypto.createHash('sha256').update(f.code_verifier || '').digest('base64url') !== c.challenge) { res.statusCode = 400; return res.end('{"error":"invalid_grant","error_description":"pkce"}'); }
        const now = Math.floor(Date.now() / 1000), claims = Object.assign({ iss: 'https://login.microsoftonline.com/' + TENANT + '/v2.0', aud: CID, tid: TENANT, exp: now + 3600, nbf: now - 10, iat: now, nonce: c.nonce, email: c.email, name: c.email.split('@')[0] }, override.claims || {}, c.claims || {});
        res.end(JSON.stringify({ id_token: mint(claims, override.key, override.alg, override.kid) }));
      }); return;
    }
    res.statusCode = 404; res.end();
  });
  await new Promise((r) => idp.listen(0, '127.0.0.1', r)); const authority = 'http://127.0.0.1:' + idp.address().port;
  const S = await start({ PTF_DEV_LOGIN: '', ENTRA_TENANT_ID: TENANT, ENTRA_CLIENT_ID: CID, ENTRA_CLIENT_SECRET: 'shh', PTF_ALLOWED_DOMAINS: 'x.com', PTF_BOOTSTRAP_ADMINS: 'boot@x.com', PTF_AUTH_PER_MIN: '1000' }, { authority });
  await S.state.replaceAll({ keys: sample() });

  /* drives the whole flow like a browser: /auth/login -> (Microsoft) -> /auth/callback */
  async function signIn(email, o) {
    o = o || {}; const c = await S.client(null); const r1 = await c.get('/auth/login' + (o.to ? '?to=' + encodeURIComponent(o.to) : '')); const loc = new URL(r1.headers.get('location'));
    const q = loc.searchParams; const code = 'code-' + Math.random().toString(36).slice(2); codes[code] = { challenge: q.get('code_challenge'), nonce: q.get('nonce'), email, claims: o.claims };
    const r2 = await c.get('/auth/callback?code=' + code + '&state=' + encodeURIComponent(o.state || q.get('state')));
    const sess = await c.get('/api/session'); return { c, r1, loc, r2, sess, ok: r2.status === 302 && sess.status === 200, info: sess.status === 200 ? await sess.json() : null };
  }

  section('1. The sign-in request');
  let s = await signIn('ana@x.com');
  ok('the browser is sent to the company tenant', s.loc.origin === authority && s.loc.pathname === '/' + TENANT + '/oauth2/v2.0/authorize');
  ok('with PKCE (S256), state, nonce and the code flow', s.loc.searchParams.get('code_challenge_method') === 'S256' && s.loc.searchParams.get('state').length >= 20 && s.loc.searchParams.get('nonce').length >= 20 && s.loc.searchParams.get('response_type') === 'code' && s.loc.searchParams.get('client_id') === CID);
  ok('the state is kept in a short-lived HttpOnly cookie', /ptf_oidc=.*HttpOnly/.test(s.r1.headers.getSetCookie().join(';')) && /Max-Age=600/.test(s.r1.headers.getSetCookie().join(';')));

  section('2. A good sign-in');
  ok('a company account gets a session', s.ok && s.info.email === 'ana@x.com', s.info);
  ok('an ordinary account is not an admin', s.info.admin === false);
  ok('and is not staff unless the tool says so', s.info.staff === false);
  s = await signIn('mgr@x.com'); ok('a person the tool lists as manager is staff', s.info.staff === true && s.info.admin === false);
  s = await signIn('boss@x.com', { claims: { roles: ['PTF.Admin'] } }); ok('the Entra app role PTF.Admin makes an administrator', s.info.admin === true && s.info.staff === true);
  s = await signIn('boot@x.com'); ok('the bootstrap admin list works for the very first sign-in', s.info.admin === true);
  s = await signIn('ana@x.com', { claims: { roles: ['Something.Else'] } }); ok('other app roles give nothing', s.info.admin === false);
  s = await signIn('ana@x.com', { to: '/employee' }); ok('after sign-in the person returns where they started', s.r2.headers.get('location') === '/employee');
  s = await signIn('ana@x.com', { to: 'https://evil.example/' }); ok('an outside address in "to" is ignored (no open redirect)', s.r2.headers.get('location') === '/');
  s = await signIn('ana@x.com', { to: '//evil.example/' }); ok('so is a protocol-relative one', s.r2.headers.get('location') === '/');

  section('3. Everything that must be refused');
  s = await signIn('ana@x.com', { state: 'forged-state-value-0123456789' }); ok('a wrong state (login CSRF)', !s.ok && s.r2.status === 401);
  { const c = await S.client(null); const r = await c.get('/auth/callback?code=abc&state=def'); ok('a callback without the sign-in cookie', r.status === 401); }
  s = await signIn('ana@x.com', { claims: { aud: 'someone-else' } }); ok('a token for another application (wrong audience)', !s.ok);
  s = await signIn('ana@x.com', { claims: { iss: 'https://login.microsoftonline.com/other-tenant/v2.0' } }); ok('a token from another issuer', !s.ok);
  s = await signIn('ana@x.com', { claims: { tid: 'other-tenant' } }); ok('a token from another tenant', !s.ok);
  s = await signIn('ana@x.com', { claims: { exp: Math.floor(Date.now() / 1000) - 3600 } }); ok('an expired token', !s.ok);
  s = await signIn('ana@x.com', { claims: { nonce: 'replayed' } }); ok('a token with the wrong nonce (replay)', !s.ok);
  s = await signIn('intruder@gmail.com'); ok('an account from another domain (a personal Microsoft account)', !s.ok);
  s = await signIn('ana@x.com', { claims: { email: 'not-an-email', preferred_username: '' } }); ok('a token without an e-mail', !s.ok);
  override = { key: other.privateKey }; s = await signIn('ana@x.com'); ok('a token signed with a different key', !s.ok); override = {};
  override = { alg: 'none' }; s = await signIn('ana@x.com'); ok('a token with algorithm "none"', !s.ok); override = {};
  override = { kid: 'unknown-key' }; s = await signIn('ana@x.com'); ok('a token with an unknown key id', !s.ok); override = {};
  { const c = await S.client(null); const r1 = await c.get('/auth/login'), q = new URL(r1.headers.get('location')).searchParams; codes.once = { challenge: 'WRONG', nonce: q.get('nonce'), email: 'ana@x.com' }; const r = await c.get('/auth/callback?code=once&state=' + q.get('state')); ok('a wrong PKCE verifier', r.status === 401); }
  { const c = await S.client(null); const r = await c.get('/auth/callback?error=access_denied&error_description=nope&state=x'); ok('Microsoft reporting an error', r.status === 401); }
  { const c = await S.client(null); const r = await c.get('/auth/callback'); ok('an empty callback', r.status === 401); }
  ok('none of the failures left a session behind', (await S.state.d.q('SELECT email FROM sessions WHERE email IN (?,?)', ['intruder@gmail.com', 'not-an-email'])).length === 0);
  ok('failures are written to the audit trail', (await (async () => { await S.app.audit.flush(); return S.state.d.q(`SELECT COUNT(*) AS n FROM audit WHERE action='login.failed'`); })())[0].n >= 10);
  ok('the dev login does not exist in this configuration', (await (await S.client(null)).get('/dev/login?email=x@x.com')).status === 404);

  section('4. Rate limit on sign-in');
  const S2 = await start({ PTF_DEV_LOGIN: '', ENTRA_TENANT_ID: TENANT, ENTRA_CLIENT_ID: CID, ENTRA_CLIENT_SECRET: 'shh', PTF_ALLOWED_DOMAINS: 'x.com', PTF_AUTH_PER_MIN: '10' }, { authority });
  const rl = await S2.client(null); let tooMany = 0; for (let i = 0; i < 40; i++) { const r = await rl.get('/auth/login'); if (r.status === 429) tooMany++; }
  ok('hammering the sign-in address is slowed down', tooMany > 0, tooMany);

  idp.close(); await S2.close(); await S.close(); done('auth');
})().catch((e) => { console.error(e); process.exit(1); });
