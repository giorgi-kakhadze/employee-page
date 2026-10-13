'use strict';
/* Tamper-evident audit trail: each row stores a hash of the previous row, so deleting or editing a row breaks the chain and verify() says where.
   Rows are queued and written in small batches under the same database lock as the data (one writer, correct chain even with several instances). */
const crypto = require('crypto');
module.exports = function audit(db) {
  let q = [], timer = null, busy = Promise.resolve();
  const h = (prev, r) => crypto.createHash('sha256').update([prev, r.ts, r.actor, r.action, r.detail, r.ip].join('\u0001')).digest('hex');
  async function flush() {
    if (!q.length) return; const batch = q; q = [];
    busy = busy.then(() => db.lock(async () => {
      await db.tx(async (t) => {
        let prev = ((await t.q('SELECT hash FROM audit ORDER BY id DESC LIMIT 1'))[0] || {}).hash || '';
        for (const r of batch) { const hash = h(prev, r); await t.q('INSERT INTO audit(ts,actor,action,detail,ip,prev,hash) VALUES(?,?,?,?,?,?,?)', [r.ts, r.actor, r.action, r.detail, r.ip, prev, hash]); prev = hash; }
      });
    })).catch((e) => { console.error('[audit] write failed:', e.message); q = batch.concat(q); });
    return busy;
  }
  return {
    log(actor, action, detail, ip) { q.push({ ts: Date.now(), actor: String(actor || '').slice(0, 120), action: String(action).slice(0, 60), detail: String(detail == null ? '' : detail).slice(0, 1000), ip: String(ip || '').slice(0, 60) }); if (!timer) timer = setTimeout(() => { timer = null; flush(); }, 400); },
    flush,
    async recent(n) { return db.q('SELECT id,ts,actor,action,detail,ip FROM audit ORDER BY id DESC LIMIT ?', [Math.min(+n || 100, 1000)]); },
    async verify() {
      const rows = await db.q('SELECT * FROM audit ORDER BY id ASC'); let prev = ''; 
      for (const r of rows) { const exp = h(prev, { ts: Number(r.ts), actor: r.actor || '', action: r.action, detail: r.detail || '', ip: r.ip || '' }); if (r.prev !== prev || r.hash !== exp) return { ok: false, brokenAt: Number(r.id), rows: rows.length }; prev = r.hash; }
      return { ok: true, rows: rows.length };
    },
    async prune(days) { /* the audit trail is kept; pruning is off by default and only exists for retention policies */ }
  };
};
