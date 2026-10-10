'use strict';
/* The tool's shared data, held in memory and written through to the database.
   - cur = { keys: { name: { v, t } }, del: {...}, updatedAt }  is exactly the shape the old Apps Script kept in tool-data.json,
     so the permission rules run on it unchanged.
   - Every change gets a sequence number (seqOf). A browser asks "what changed since N" and receives only those keys.
   - Writes go through mutate(): take the cross-instance lock, catch up with other instances, run the rule code, save only the
     changed keys in ONE transaction. If saving fails the memory is reloaded from the database, so memory never drifts from disk. */
const { sqliteDriver, pgDriver } = require('./drivers');
const ddl = require('./schema');

class State {
  constructor(driver) { this.d = driver; this.cur = { keys: {}, del: {}, updatedAt: 0 }; this.seqOf = {}; this.seq = 0; this.metaSeq = {}; this.listeners = []; this.ready = false; }
  static async open(cfg) {
    const d = cfg.databaseUrl ? pgDriver(cfg.databaseUrl, { ssl: cfg.databaseSsl }) : sqliteDriver(cfg.sqliteFile);
    const s = new State(d); await s.init(); return s;
  }
  async init() {
    for (const sql of ddl(this.d)) await this.d.exec(sql);
    await this.d.q(`INSERT INTO meta(k,v,seq) VALUES('schema','4',0) ON CONFLICT(k) DO NOTHING`);
    await this.reload(); this.ready = true;
  }
  async reload() {
    const keys = {}, seqOf = {}; let max = 0;
    for (const r of await this.d.q('SELECT k,v,t,seq FROM kv')) { keys[r.k] = { v: r.v, t: Number(r.t) }; seqOf[r.k] = Number(r.seq); if (Number(r.seq) > max) max = Number(r.seq); }
    const cur = { keys, del: {}, updatedAt: 0 };
    for (const r of await this.d.q(`SELECT k,v,seq FROM meta WHERE k IN ('del','updatedAt','seq')`)) {
      if (r.k === 'del') { try { cur.del = JSON.parse(r.v) || {}; } catch (e) {} this.metaSeq.del = Number(r.seq); if (Number(r.seq) > max) max = Number(r.seq); }
      if (r.k === 'updatedAt') cur.updatedAt = Number(r.v) || 0;
      if (r.k === 'seq' && Number(r.v) > max) max = Number(r.v);
    }
    this.cur = cur; this.seqOf = seqOf; this.seq = max;
  }
  /* pick up what another instance saved. Cheap when nothing changed (one indexed query). */
  async catchUp() {
    const rows = await this.d.q('SELECT k,v,t,seq FROM kv WHERE seq > ?', [this.seq]); let max = this.seq, changed = [];
    for (const r of rows) { if (Number(r.seq) <= (this.seqOf[r.k] || 0)) continue; this.cur.keys[r.k] = { v: r.v, t: Number(r.t) }; this.seqOf[r.k] = Number(r.seq); changed.push(r.k); if (Number(r.seq) > max) max = Number(r.seq); }
    for (const r of await this.d.q(`SELECT k,v,seq FROM meta WHERE k IN ('del','updatedAt') AND seq > ?`, [this.metaSeq.del || 0])) {
      if (r.k === 'del') { try { this.cur.del = JSON.parse(r.v) || {}; } catch (e) {} this.metaSeq.del = Number(r.seq); if (Number(r.seq) > max) max = Number(r.seq); }
    }
    const u = await this.d.q(`SELECT v FROM meta WHERE k='updatedAt'`); if (u[0]) this.cur.updatedAt = Number(u[0].v) || this.cur.updatedAt;
    this.seq = Math.max(this.seq, max); if (changed.length) this.emit({ keys: changed, remote: true });
    return changed;
  }
  on(fn) { this.listeners.push(fn); }
  emit(ev) { for (const f of this.listeners) { try { f(ev); } catch (e) {} } }

  /* run fn(cur) with exclusive write access. fn is the synchronous rule code and returns { result }. */
  settled() { return this._w || Promise.resolve(); }   /* readers wait for a save in progress, so nobody reads data that may still be rolled back */
  mutate(fn) { const p = this._mutate(fn); this._w = p.catch(() => {}); return p; }
  async _mutate(fn) {
    return this.d.lock(async () => {
      await this.catchUp();
      const before = Object.assign({}, this.cur.keys), delBefore = JSON.stringify(this.cur.del), updBefore = this.cur.updatedAt;
      let out;
      try { out = fn(this.cur); } catch (e) { await this.reload(); throw e; }
      const changed = Object.keys(this.cur.keys).filter(k => this.cur.keys[k] !== before[k]);
      const delChanged = JSON.stringify(this.cur.del) !== delBefore;
      if (!changed.length && !delChanged) { this.cur.updatedAt = updBefore; return out; }
      const snap = {}; changed.forEach((k) => { snap[k] = this.cur.keys[k]; });
      try {
        let seq = this.seq;
        await this.d.tx(async (t) => {
          for (const k of changed) { const e = snap[k]; seq++; await t.q(`INSERT INTO kv(k,v,t,seq) VALUES(?,?,?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v,t=excluded.t,seq=excluded.seq`, [k, e.v, e.t, seq]); this.seqOf[k] = seq; }
          if (delChanged) { seq++; await t.q(`INSERT INTO meta(k,v,seq) VALUES('del',?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v,seq=excluded.seq`, [JSON.stringify(this.cur.del), seq]); this.metaSeq.del = seq; }
          await t.q(`INSERT INTO meta(k,v,seq) VALUES('updatedAt',?,0) ON CONFLICT(k) DO UPDATE SET v=excluded.v`, [String(this.cur.updatedAt)]);
          await t.q(`INSERT INTO meta(k,v,seq) VALUES('seq',?,0) ON CONFLICT(k) DO UPDATE SET v=excluded.v`, [String(seq)]);
        });
        this.seq = seq;
      } catch (e) { await this.reload(); throw e; }
      this.emit({ keys: changed, remote: false });
      return out;
    });
  }
  /* bulk import (migration): replaces everything */
  async replaceAll(data) {
    return this.d.lock(async () => {
      let seq = (await this.d.q(`SELECT COALESCE(MAX(seq),0) AS m FROM kv`))[0].m; seq = Number(seq) + 1000;
      await this.d.tx(async (t) => {
        await t.q('DELETE FROM kv');
        for (const k of Object.keys(data.keys || {})) { const e = data.keys[k]; if (!e || typeof e.v !== 'string') continue; seq++; await t.q('INSERT INTO kv(k,v,t,seq) VALUES(?,?,?,?)', [k, e.v, +e.t || Date.now(), seq]); }
        seq++; await t.q(`INSERT INTO meta(k,v,seq) VALUES('del',?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v,seq=excluded.seq`, [JSON.stringify(data.del || {}), seq]);
        await t.q(`INSERT INTO meta(k,v,seq) VALUES('updatedAt',?,0) ON CONFLICT(k) DO UPDATE SET v=excluded.v`, [String(data.updatedAt || Date.now())]);
        await t.q(`INSERT INTO meta(k,v,seq) VALUES('seq',?,0) ON CONFLICT(k) DO UPDATE SET v=excluded.v`, [String(seq)]);
      });
      await this.reload(); this.emit({ keys: Object.keys(this.cur.keys), remote: false });
    });
  }
  async close() { await this.d.close(); }
}
module.exports = { State };
