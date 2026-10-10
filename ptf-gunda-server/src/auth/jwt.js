'use strict';
/* Verifies Microsoft Entra ID tokens with Node's own crypto (RS256 against the tenant's published keys). No third-party JWT library:
   fewer dependencies in the one place where a bug would be a security hole. */
const crypto = require('crypto'), https = require('https'), http = require('http');
const b64u = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

function getJson(url) { return new Promise((res, rej) => { (/^http:/.test(url) ? http : https).get(url, { timeout: 8000 }, (r) => { let d = ''; r.on('data', c => { d += c; if (d.length > 1e6) r.destroy(); }); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej).on('timeout', function () { this.destroy(new Error('timeout')); }); }); }

class Jwks {
  constructor(tenant, fetcher, authority) { this.authority = authority || 'https://login.microsoftonline.com'; this.tenant = tenant; this.fetcher = fetcher || getJson; this.keys = {}; this.at = 0; }
  async key(kid) {
    if (!this.keys[kid] || Date.now() - this.at > 6 * 3600e3) {
      if (Date.now() - this.at > 60e3 || !this.keys[kid]) {   // refetch at most once a minute
        const doc = await this.fetcher(this.authority + '/' + this.tenant + '/discovery/v2.0/keys'); this.at = Date.now();
        this.keys = {}; (doc.keys || []).forEach(k => { if (k.kid && k.kty === 'RSA') this.keys[k.kid] = crypto.createPublicKey({ key: k, format: 'jwk' }); });
      }
    }
    return this.keys[kid] || null;
  }
}

/* returns the verified claims or throws. opts: { jwks, tenant, clientId, nonce } */
async function verifyIdToken(token, opts) {
  const p = String(token || '').split('.'); if (p.length !== 3 || token.length > 8000) throw new Error('malformed token');
  let h, c; try { h = JSON.parse(b64u(p[0]).toString()); c = JSON.parse(b64u(p[1]).toString()); } catch (e) { throw new Error('malformed token'); }
  if (h.alg !== 'RS256') throw new Error('unexpected algorithm');   // never accept "none" or HMAC
  const key = await opts.jwks.key(h.kid); if (!key) throw new Error('unknown signing key');
  if (!crypto.verify('RSA-SHA256', Buffer.from(p[0] + '.' + p[1]), key, b64u(p[2]))) throw new Error('bad signature');
  const now = Math.floor(Date.now() / 1000);
  if (c.aud !== opts.clientId) throw new Error('wrong audience');
  if (c.iss !== 'https://login.microsoftonline.com/' + opts.tenant + '/v2.0') throw new Error('wrong issuer');
  if (c.tid !== opts.tenant) throw new Error('wrong tenant');
  if (!(c.exp > now - 60) || (c.nbf && c.nbf > now + 60) || (c.iat && c.iat > now + 300)) throw new Error('token expired');
  if (opts.nonce && c.nonce !== opts.nonce) throw new Error('nonce mismatch');
  return c;
}
module.exports = { Jwks, verifyIdToken, b64u };
