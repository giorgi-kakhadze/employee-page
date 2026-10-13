'use strict';
/* Server-side sessions. The browser holds only an opaque random token in a __Host- cookie (HttpOnly, Secure, SameSite=Lax, no Domain, Path=/).
   The database holds an HMAC of that token, never the token itself, so a database leak cannot be replayed as logins.
   Every session has an absolute lifetime and an idle timeout, and a CSRF token that the page must echo in a header on every write. */
const crypto = require('crypto');
module.exports = function sessions(db, cfg) {
  const cache = new Map();   // sid hash -> { row, at }   (30 s: a revoked session stops working within 30 s on every instance)
  const mac = (raw) => crypto.createHmac('sha256', cfg.sessionSecret).update(raw).digest('hex');
  const rnd = (n) => crypto.randomBytes(n).toString('base64url');
  return {
    cookieName: cfg.prod ? '__Host-ptf_sid' : 'ptf_sid',
    async create(u, req) {
      const raw = rnd(32), id = mac(raw), now = Date.now(), csrf = rnd(24);
      await db.q('INSERT INTO sessions(id,email,name,admin,csrf,created,last,expires,ip,ua) VALUES(?,?,?,?,?,?,?,?,?,?)', [id, u.email, u.name || '', u.admin ? 1 : 0, csrf, now, now, now + cfg.sessionHours * 3600e3, String(req.ip || '').slice(0, 60), String(req.ua || '').slice(0, 200)]);
      return { raw, csrf, maxAge: cfg.sessionHours * 3600 };
    },
    async get(raw, o) {
      if (!raw || raw.length > 100) return null; const id = mac(raw), now = Date.now(), c = cache.get(id);
      let row = c && now - c.at < 30e3 ? c.row : null;
      if (!row) { row = (await db.q('SELECT * FROM sessions WHERE id=?', [id]))[0]; if (!row) { cache.delete(id); return null; } row = { id: row.id, email: row.email, name: row.name, admin: !!Number(row.admin), csrf: row.csrf, created: Number(row.created), last: Number(row.last), expires: Number(row.expires) }; cache.set(id, { row, at: now }); if (cache.size > 20000) cache.clear(); }
      if (row.expires < now || row.last + cfg.sessionIdleMinutes * 60e3 < now) { await this.destroyId(id); return null; }
      if (!(o && o.peek) && now - row.last > 60e3) { row.last = now; db.q('UPDATE sessions SET last=? WHERE id=?', [now, id]).catch(() => {}); }
      return row;
    },
    async destroy(raw) { if (raw) await this.destroyId(mac(raw)); },
    async destroyId(id) { cache.delete(id); await db.q('DELETE FROM sessions WHERE id=?', [id]); },
    async destroyAllFor(email) { for (const [k, v] of cache) if (v.row.email === email) cache.delete(k); await db.q('DELETE FROM sessions WHERE email=?', [email]); },
    async sweep() { await db.q('DELETE FROM sessions WHERE expires < ? OR last < ?', [Date.now(), Date.now() - cfg.sessionIdleMinutes * 60e3 * 2]); },
    count: async () => Number((await db.q('SELECT COUNT(*) AS n FROM sessions'))[0].n)
  };
};
