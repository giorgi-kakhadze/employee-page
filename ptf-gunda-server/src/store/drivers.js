'use strict';
/* Two database drivers behind one tiny async interface:  q(sql, params) -> rows,  tx(fn),  lock(fn).
   SQL is written once with "?" placeholders. SQLite (node:sqlite) is for development and tests; PostgreSQL (pg) is for production. */
const path = require('path'), fs = require('fs');

function sqliteDriver(file) {
  const { DatabaseSync } = require('node:sqlite');
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000;');
  let chain = Promise.resolve();
  const run = (sql, p) => { const st = db.prepare(sql); return /^\s*(select|with|pragma)/i.test(sql) ? st.all(...(p || [])) : (st.run(...(p || [])), []); };
  const mk = () => ({ q: async (sql, p) => run(sql, p) });
  return {
    kind: 'sqlite', file,
    async q(sql, p) { return run(sql, p); },
    async exec(sql) { db.exec(sql); },
    async tx(fn) { db.exec('BEGIN IMMEDIATE'); try { const r = await fn(mk()); db.exec('COMMIT'); return r; } catch (e) { try { db.exec('ROLLBACK'); } catch (x) {} throw e; } },
    /* cross-process lock: SQLite is one process here, so the in-process mutex is enough */
    async lock(fn) { const prev = chain; let rel; chain = new Promise(r => { rel = r; }); await prev; try { return await fn(); } finally { rel(); } },
    async close() { db.close(); },
    idCol: 'INTEGER PRIMARY KEY AUTOINCREMENT'
  };
}

function pgDriver(url, opts) {
  let pg; try { pg = require('pg'); } catch (e) { throw new Error('The "pg" package is not installed. Run: npm install'); }
  opts = opts || {};
  const pool = new pg.Pool({ connectionString: url, max: opts.max || 10, ssl: opts.ssl ? { rejectUnauthorized: true } : undefined, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 });
  pool.on('error', e => console.error('[pg pool]', e.message));
  const conv = sql => { let i = 0; return sql.replace(/\?/g, () => '$' + (++i)); };
  const rows = async (c, sql, p) => (await c.query(conv(sql), p || [])).rows;
  let chain = Promise.resolve();
  return {
    kind: 'postgres',
    async q(sql, p) { return rows(pool, sql, p); },
    async exec(sql) { await pool.query(sql); },
    async tx(fn) { const c = await pool.connect(); try { await c.query('BEGIN'); const r = await fn({ q: (sql, p) => rows(c, sql, p) }); await c.query('COMMIT'); return r; } catch (e) { try { await c.query('ROLLBACK'); } catch (x) {} throw e; } finally { c.release(); } },
    /* in-process mutex first (cheap), then a PostgreSQL advisory lock so that several app instances take turns */
    async lock(fn) { const prev = chain; let rel; chain = new Promise(r => { rel = r; }); await prev;
      let c; try { c = await pool.connect(); await c.query('SELECT pg_advisory_lock(727001)'); return await fn(); }
      finally { if (c) { try { await c.query('SELECT pg_advisory_unlock(727001)'); } catch (e) {} c.release(); } rel(); } },
    async close() { await pool.end(); },
    idCol: 'BIGSERIAL PRIMARY KEY'
  };
}

module.exports = { sqliteDriver, pgDriver };
