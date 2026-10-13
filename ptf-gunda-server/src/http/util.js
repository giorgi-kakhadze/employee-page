'use strict';
const zlib = require('zlib'), crypto = require('crypto');
const { promisify } = require('util'); const gz = promisify(zlib.gzip);

function parseCookies(h) { const o = {}; String(h || '').split(/;\s*/).forEach(p => { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i)] = p.slice(i + 1); }); return o; }
function cookie(name, val, o) { o = o || {}; return name + '=' + val + '; Path=/' + (o.maxAge != null ? '; Max-Age=' + o.maxAge : '') + '; HttpOnly' + (o.secure === false ? '' : '; Secure') + '; SameSite=' + (o.sameSite || 'Lax'); }

/* small signed blobs (the sign-in state cookie): base64url(json).hmac */
function signer(secret) {
  const mac = (s) => crypto.createHmac('sha256', secret).update(s).digest('base64url');
  return {
    sign: (o) => { const b = Buffer.from(JSON.stringify(o)).toString('base64url'); return b + '.' + mac(b); },
    unsign: (s) => { const p = String(s || '').split('.'); if (p.length !== 2) return null; const a = Buffer.from(mac(p[0])), b = Buffer.from(p[1]); if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null; try { return JSON.parse(Buffer.from(p[0], 'base64url').toString()); } catch (e) { return null; } }
  };
}

/* fixed-window counters; cheap and good enough per instance (Front Door WAF does the heavy limiting in front) */
function limiter() {
  const m = new Map(); let sweep = Date.now();
  return (key, max, windowMs) => {
    const now = Date.now(); if (now - sweep > 60e3) { for (const [k, v] of m) if (v.x < now) m.delete(k); sweep = now; }
    let e = m.get(key); if (!e || e.x < now) { e = { n: 0, x: now + windowMs }; m.set(key, e); }
    e.n++; return e.n <= max;
  };
}

function readBody(req, max) {
  return new Promise((res, rej) => {
    const len = +req.headers['content-length']; if (len > max) { req.resume(); return rej(Object.assign(new Error('too large'), { status: 413 })); }
    const chunks = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > max) { req.destroy(); rej(Object.assign(new Error('too large'), { status: 413 })); } else chunks.push(c); });
    req.on('end', () => res(Buffer.concat(chunks).toString('utf8'))); req.on('error', rej);
  });
}

async function sendJson(req, res, status, obj, extra) {
  const buf = Buffer.from(JSON.stringify(obj)); return sendBuf(req, res, status, buf, 'application/json; charset=utf-8', extra);
}
async function sendBuf(req, res, status, buf, type, extra) {
  const h = Object.assign({ 'Content-Type': type, 'Vary': 'Accept-Encoding' }, extra || {});
  if (buf.length > 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) { buf = await gz(buf, { level: buf.length > 1e6 ? 1 : 6 }); h['Content-Encoding'] = 'gzip'; }
  h['Content-Length'] = buf.length; res.writeHead(status, h); res.end(buf);
}
module.exports = { parseCookies, cookie, signer, limiter, readBody, sendJson, sendBuf };
