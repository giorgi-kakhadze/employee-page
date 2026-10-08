'use strict';
/* The production database driver: a real PostgreSQL, two app instances on it (like two App Service instances), concurrent writers. */
const { ok, section, done, sample } = require('./util'); const { start } = require('./lib');
const pg = require('pg'); const ADMIN_URL = process.env.TEST_PG_URL || 'postgres://postgres@127.0.0.1:54329/postgres';
(async () => {
  const root = new pg.Client({ connectionString: ADMIN_URL }); await root.connect(); await root.query('DROP DATABASE IF EXISTS ptf_test'); await root.query('CREATE DATABASE ptf_test'); await root.end();
  const url = ADMIN_URL.replace(/\/[^/]*$/, '/ptf_test'), env = { DATABASE_URL: url, DATABASE_SSL: '' };
  const A = await start(env), B = await start(env, { noJobs: false });
  ok('both instances run on PostgreSQL', A.state.d.kind === 'postgres' && B.state.d.kind === 'postgres');
  await A.state.replaceAll({ keys: sample() }); await B.state.catchUp();
  section('1. Two instances see each other');
  const ca = await A.client('boss@x.com', { admin: true }), cb = await B.client('boss@x.com', { admin: true });
  const pa = await ca.rpc({ action: 'push', keys: { totTeams: { v: '[{"id":"t1"}]', t: Date.now() } } }); ok('a save on instance A is accepted', !pa.denied.length);
  await new Promise((r) => setTimeout(r, 1500)); const pb = await cb.rpc({ action: 'pull' });
  ok('instance B has it within 1.5 s (catch-up job), without a restart', !!pb.keys.totTeams && /t1/.test(pb.keys.totTeams.v));
  const ver = (await B.state.d.q('SELECT COUNT(*) AS n FROM kv'))[0].n; ok('one row per key in the database', Number(ver) >= 6);
  section('2. Concurrent writers on both instances');
  const keys = 60, jobs = []; for (let i = 0; i < keys; i++) { const c = i % 2 ? ca : cb; jobs.push(c.rpc({ action: 'push', keys: { ['load' + i]: { v: JSON.stringify({ i }), t: Date.now() } } })); }
  const rs = await Promise.all(jobs); ok('all 60 saves from two instances are accepted', rs.every((r) => r.ok && !r.denied.length), rs.filter((r) => !r.ok).slice(0, 2));
  await A.state.catchUp(); await B.state.catchUp();
  const missing = []; for (let i = 0; i < keys; i++) { for (const [n, I] of [['A', A], ['B', B]]) if (!I.state.cur.keys['load' + i]) missing.push(n + i); }
  ok('nothing was lost on either instance', missing.length === 0, missing);
  ok('both instances hold identical data', JSON.stringify(Object.keys(A.state.cur.keys).sort()) === JSON.stringify(Object.keys(B.state.cur.keys).sort()) && A.state.seq === B.state.seq, [A.state.seq, B.state.seq]);
  section('3. The same key, many writers: conflicts are detected exactly once');
  await ca.rpc({ action: 'push', keys: { counter: { v: '0', t: Date.now() } } }); await B.state.catchUp();
  async function increment(c) { for (let tries = 0; tries < 200; tries++) { const p = await c.rpc({ action: 'pull' }); const e = p.keys.counter; const r = await c.rpc({ action: 'push', keys: { counter: { v: String(Number(e.v) + 1), t: Date.now(), bt: e.t } } }); if (!(r.conflicts || []).length) return tries; } throw new Error('never succeeded'); }
  const incs = []; for (let i = 0; i < 24; i++) incs.push(increment(i % 2 ? ca : cb));
  const retries = await Promise.all(incs); await A.state.catchUp(); await B.state.catchUp();
  ok('24 simultaneous read-modify-write cycles end at exactly 24 (no lost update)', A.state.cur.keys.counter.v === '24' && B.state.cur.keys.counter.v === '24', [A.state.cur.keys.counter.v, B.state.cur.keys.counter.v]);
  ok('and the conflicts really happened and were retried', retries.some((n) => n > 0), retries.join());
  section('4. A failed database write leaves memory consistent');
  const origTx = A.state.d.tx.bind(A.state.d); let boom = true; A.state.d.tx = async (fn) => { if (boom) { boom = false; throw new Error('simulated outage'); } return origTx(fn); };
  const before = A.state.cur.keys.counter.v; const r500 = await ca.post('/api/rpc', { action: 'push', keys: { counter: { v: '999', t: Date.now() + 1 } } });
  ok('the person gets an error, not a false "saved"', r500.status === 500, r500.status);
  ok('memory was reloaded from the database (still the old value)', A.state.cur.keys.counter.v === before, A.state.cur.keys.counter.v);
  const again = await ca.rpc({ action: 'push', keys: { counter: { v: '25', t: Date.now() + 2 } } }); ok('and the next save works', again.ok === true, again);
  A.state.d.tx = origTx;
  section('5. Audit trail across instances');
  await A.app.audit.flush(); await B.app.audit.flush(); const v = await A.app.audit.verify(); ok('one valid hash chain although two instances wrote to it', v.ok && v.rows > 3, v);
  section('6. Restart');
  const seqBefore = A.state.seq; await A.close(); await B.close();
  const C = await start(env); ok('after a restart all data is there', C.state.cur.keys.counter.v === '25' && Object.keys(C.state.cur.keys).length >= 60 && C.state.seq >= seqBefore, [C.state.cur.keys.counter && C.state.cur.keys.counter.v, Object.keys(C.state.cur.keys).length]);
  await C.close(); done('postgres');
})().catch((e) => { console.error(e); process.exit(1); });
