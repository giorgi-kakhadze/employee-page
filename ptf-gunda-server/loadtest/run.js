#!/usr/bin/env node
'use strict';
/* Load test: the server as a separate process on PostgreSQL, filled with about 5,000 people on 4 locations, and hundreds of simulated people using it at once.
   Staff behave like the real tool: open the page (full data), keep a live channel, pull what changed after every notice (spread over a few seconds),
   and save edits. Employees open their own page and refresh it.
     node loadtest/run.js [--staff 500] [--employees 300] [--ramp 60] [--duration 180] [--write-every 45] [--instances 1] [--out report.json]            */
const { spawn, execFileSync } = require('child_process'), http = require('http'), zlib = require('zlib'), fs = require('fs'), path = require('path'), os = require('os');
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const STAFF = +opt('staff', 500), EMPL = +opt('employees', 300), RAMP = +opt('ramp', 60), DUR = +opt('duration', 180), WRITE_EVERY = +opt('write-every', 45), INST = +opt('instances', 1), OUT = opt('out', '');
const PGURL = process.env.TEST_PG_URL || 'postgres://postgres@127.0.0.1:54329/postgres', root = path.join(__dirname, '..');
const WORKERS = +opt('workers', 2);
const agent = new http.Agent({ keepAlive: true, maxSockets: 2000 });
const rnd = (a, b) => a + Math.random() * (b - a), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lat = {}, errs = {}, bytes = {}; const rec = (k, ms, b) => { (lat[k] = lat[k] || []).push(ms); if (b) bytes[k] = (bytes[k] || 0) + b; }; const err = (k) => { errs[k] = (errs[k] || 0) + 1; };
const pct = (a, p) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))]; };

function req(base, method, p, opts) {
  opts = opts || {}; return new Promise((resolve) => {
    const u = new URL(base + p), t0 = process.hrtime.bigint(), body = opts.body == null ? null : Buffer.from(typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body));
    const r = http.request({ agent, method, hostname: u.hostname, port: u.port, path: u.pathname + u.search, headers: Object.assign({ 'accept-encoding': 'gzip' }, opts.headers || {}, body ? { 'content-type': 'application/json', 'content-length': body.length } : {}) }, (res) => {
      const ch = []; res.on('data', (c) => ch.push(c)); res.on('end', () => { let buf = Buffer.concat(ch); const wire = buf.length; try { if (res.headers['content-encoding'] === 'gzip') buf = zlib.gunzipSync(buf); } catch (e) {} resolve({ status: res.statusCode, headers: res.headers, buf, wire, ms: Number(process.hrtime.bigint() - t0) / 1e6 }); });
    }); r.on('error', (e) => resolve({ status: 0, error: e.message, ms: Number(process.hrtime.bigint() - t0) / 1e6, buf: Buffer.alloc(0), wire: 0, headers: {} })); r.setTimeout(60000, () => r.destroy(new Error('timeout'))); if (body) r.write(body); r.end();
  });
}
function cookiesOf(res) { return (res.headers['set-cookie'] || []).map((x) => x.split(';')[0]).join('; '); }

async function main() {
  const port0 = 18080, ports = Array.from({ length: INST }, (_, i) => port0 + i);
  /* database and data */
  const pg = require('pg'); const c = new pg.Client({ connectionString: PGURL }); await c.connect(); await c.query('DROP DATABASE IF EXISTS ptf_load'); await c.query('CREATE DATABASE ptf_load'); await c.end();
  const dbUrl = PGURL.replace(/\/[^/]*$/, '/ptf_load'); const dataFile = path.join(root, 'data', 'scaled-demo.json');
  if (!fs.existsSync(dataFile)) execFileSync('node', [path.join(root, 'scripts', 'scale-demo.js'), dataFile], { stdio: 'inherit' });
  const j = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  /* staff accounts for the test: 8% managers (all locations), the rest spread over positions and locations */
  const pol = JSON.parse(j.keys.totAccessPolicy.v), sites = ['main', 'site2', 'site3', 'site4'], roles = ['shift_lead', 'shift_lead', 'performance_coach', 'scheduling_coordinator', 'scheduling_coordinator', 'training_coordinator', 'hr_recruiter', 'service_manager'], staff = [];
  for (let i = 0; i < STAFF; i++) { const email = 'staff' + i + '@load.test', mgr = i % 12 === 0, role = mgr ? 'manager' : roles[i % roles.length], st = mgr ? sites : [i % 10 < 4 ? 'main' : sites[1 + (i % 3)]]; pol.users[email] = { role, name: 'Staff ' + i, sites: st }; staff.push({ email, role, sites: st }); }
  j.keys.totAccessPolicy = { v: JSON.stringify(pol), t: Date.now() - 60000 }; const tmp = path.join(os.tmpdir(), 'ptf-load-import.json'); fs.writeFileSync(tmp, JSON.stringify(j));
  const env = Object.assign({}, process.env, { PTF_ENV: 'dev', PTF_DEV_LOGIN: '1', DATABASE_URL: dbUrl, DATABASE_SSL: '', PTF_RPC_PER_MIN: '100000', PTF_AUTH_PER_MIN: '100000', PTF_DATA_DIR: path.join(os.tmpdir(), 'ptf-load-data'), PTF_METRICS: 'fast', PTF_TZ: 'UTC' });
  execFileSync('node', [path.join(root, 'scripts', 'import-backup.js'), tmp], { env, stdio: 'inherit' });
  /* employees for the self-service page: people from the data set */
  const emps = JSON.parse(j.keys.employeeDataSource.v).filter((e) => e.status === 'Employed' && e.ext && e.ext.email).map((e) => e.ext.email); const employees = emps.slice(0, EMPL);
  /* start the server(s) */
  const kids = ports.map((p) => { const k = spawn('node', ['--max-old-space-size=2048'].concat(args.includes('--prof') ? ['--cpu-prof', '--cpu-prof-dir=/tmp/ptf-prof'] : [], [path.join(root, 'src', 'server.js')]), { env: Object.assign({}, env, { PORT: String(p), PTF_PUBLIC_URL: 'http://127.0.0.1:' + p }), stdio: ['ignore', 'pipe', 'pipe'] }); k.metrics = []; k.out = ''; k.stdout.on('data', (d) => { const s = String(d); s.split('\n').forEach((l) => { if (l.startsWith('{"m":"metrics"')) { try { k.metrics.push(JSON.parse(l)); } catch (e) {} } }); }); k.stderr.on('data', (d) => { k.out += d; }); return k; });
  for (const p of ports) { for (let i = 0; i < 100; i++) { const r = await req('http://127.0.0.1:' + p, 'GET', '/healthz'); if (r.status === 200) break; await sleep(200); } }
  const bases = ports.map((p) => 'http://127.0.0.1:' + p);
  const cpu = (pid) => { try { const s = fs.readFileSync('/proc/' + pid + '/stat', 'utf8').split(' '); return (+s[13] + +s[14]) / 100; } catch (e) { return 0; } };
  const cpuSamples = []; const cpuT = setInterval(() => cpuSamples.push({ t: Date.now(), c: kids.map((k) => cpu(k.pid)) }), 2000);
  const pgPid = (() => { try { return +fs.readFileSync('/var/tmp/ptfpg/data/postmaster.pid', 'utf8').split('\n')[0]; } catch (e) { return 0; } })();
  console.log('server(s) up on ' + bases.join(', ') + '; ' + Object.keys(j.keys).length + ' keys; ' + STAFF + ' staff + ' + EMPL + ' employees, ramp ' + RAMP + ' s, steady ' + DUR + ' s');

  const T0 = Date.now(), END = T0 + (RAMP + DUR) * 1000; let peak = 0, live = 0, active = 0;
  const cfgW = { bases, staff, employees, STAFF, EMPL, RAMP, DUR, WRITE_EVERY, T0, END };
  const workers = Array.from({ length: WORKERS }, (_, w) => { const c = require('child_process').fork(__filename, [], { env: Object.assign({}, process.env, { LT_WORKER: String(w) }) }); c.send(Object.assign({ w, W: WORKERS }, cfgW)); return new Promise((res) => { c.on('message', (m) => { if (m.live != null) live = m.live + 0; if (m.done) res(m.done); }); c.on('exit', () => res(null)); }); });
  const prog = setInterval(() => { const m = kids[0].metrics.slice(-1)[0] || {}; console.log(((Date.now() - T0) / 1000 | 0) + 's  elapsed ' + '    server rss ' + (m.rssMB || '?') + ' MB  event-loop lag p99 ' + (m.lagP99 || '?') + ' ms'); }, 15000);
  const done = (await Promise.all(workers)).filter(Boolean); clearInterval(prog); clearInterval(cpuT);
  done.forEach((d) => { Object.keys(d.lat).forEach((k) => { (lat[k] = lat[k] || []).push(...d.lat[k]); }); Object.keys(d.errs).forEach((k) => { errs[k] = (errs[k] || 0) + d.errs[k]; }); Object.keys(d.bytes).forEach((k) => { bytes[k] = (bytes[k] || 0) + d.bytes[k]; }); peak += d.peak; });
  /* ---------- report ---------- */
  const secs = (END - T0) / 1000, cpuUsed = kids.map((k, i) => cpu(k.pid)), rows = Object.keys(lat).sort().map((k) => ({ action: k, n: lat[k].length, p50: +pct(lat[k], 50).toFixed(1), p95: +pct(lat[k], 95).toFixed(1), p99: +pct(lat[k], 99).toFixed(1), max: +Math.max(...lat[k]).toFixed(1), MBsent: bytes[k] ? +(bytes[k] / 1048576).toFixed(1) : '' }));
  const agg = (sel) => { const out = {}; kids.forEach((k) => k.metrics.forEach((x) => { const s = (x.stats || {})[sel] || {}; Object.keys(s).forEach((a) => { const o = out[a] = out[a] || { n: 0, p50: [], p95: [], p99: [], max: 0 }; o.n += s[a].n; o.p50.push(s[a].p50); o.p95.push(s[a].p95); o.p99.push(s[a].p99); o.max = Math.max(o.max, s[a].max); }); })); const avg = (v) => +(v.reduce((s, x) => s + x, 0) / v.length).toFixed(1); Object.keys(out).forEach((a) => { const o = out[a]; out[a] = { n: o.n, p50: avg(o.p50), p95: avg(o.p95), p99: avg(o.p99), max: o.max }; }); return out; };
  const ruleMs = agg('rules'), serverHttpMs = agg('http');
  const m = [].concat(...kids.map((k) => k.metrics)), steady = m.filter((x) => x.t > T0 + RAMP * 1000);
  const report = { when: new Date().toISOString(), machine: os.cpus().length + ' cores, ' + Math.round(os.totalmem() / 1073741824) + ' GB (load generator, server and PostgreSQL on the same machine)', staff: STAFF, employees: EMPL, instances: INST, people: 5365, rampSeconds: RAMP, steadySeconds: DUR, peakStaffOnline: peak, serverCpuSecondsPerInstance: cpuUsed.map((x) => +x.toFixed(1)), avgServerCpuPercentOfOneCore: cpuUsed.map((x) => +(x / secs * 100).toFixed(0)), serverRssMBmax: Math.max(...m.map((x) => x.rssMB), 0), eventLoopLagP99msMax: Math.max(...steady.map((x) => x.lagP99), 0), eventLoopLagMaxMs: Math.max(...m.map((x) => x.lagMax), 0), errors: errs, serverRuleMs: ruleMs, serverHttpMs, latencyMs: rows };
  console.log('\n' + JSON.stringify(report, null, 1)); if (OUT) fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
  kids.forEach((k) => k.kill('SIGTERM')); await sleep(500); const bad = Object.keys(errs).filter((k) => !/^\(info\)/.test(k)).length; process.exit(bad ? 1 : 0);
}
async function worker(msg) {
  const { w, W, bases, staff, employees, STAFF, EMPL, RAMP, DUR, WRITE_EVERY, T0, END } = msg; let peak = 0, live = 0, active = 0;
  /* ---------- a staff member ---------- */
  async function staffVU(i) {
    const me = staff[i], base = bases[i % bases.length]; await sleep((i / STAFF) * RAMP * 1000);
    let r = await req(base, 'GET', '/dev/login?email=' + encodeURIComponent(me.email)); if (r.status !== 302) { err('login'); return; } const ck = cookiesOf(r); rec('login', r.ms);
    r = await req(base, 'GET', '/api/session', { headers: { cookie: ck } }); const csrf = JSON.parse(r.buf.toString()).csrf; const H = { cookie: ck, 'x-ptf-csrf': csrf };
    r = await req(base, 'GET', '/api/boot.js', { headers: { cookie: ck } }); if (r.status !== 200) { err('boot'); return; } rec('boot (full data for this person)', r.ms, r.wire); rec('boot size KB (uncompressed)', r.buf.length / 1024);
    const boot = JSON.parse(r.buf.toString().slice('window.__PTF_BOOT='.length, -1)); let since = boot.seq; const vals = boot.keys; active++; peak = Math.max(peak, active);
    const rpc = async (label, body) => { const x = await req(base, 'POST', '/api/rpc', { headers: H, body }); if (x.status !== 200) { err(label + ' HTTP ' + x.status); return null; } rec(label, x.ms, x.wire); try { return JSON.parse(x.buf.toString()); } catch (e) { err(label + ' bad json'); return null; } };
    const pull = async (label) => { const x = await rpc(label, { action: 'pull', since }); if (x && x.keys) { Object.assign(vals, x.keys); if (x.seq) since = x.seq; rec('delta size KB', Object.values(x.keys).reduce((s, e) => s + (e.v ? e.v.length : 0), 0) / 1024); } };
    /* live channel */
    let pending = null, lastRun = 0; const sse = http.get(base + '/api/events', { agent: new http.Agent({ keepAlive: true }), headers: { cookie: ck } }, (res) => { live++; res.setEncoding('utf8'); res.on('data', (d) => { const m = /"seq":(\d+)/.exec(d); if (!m || +m[1] <= since || pending) return; const wait = Math.max(Math.random() * 1500, lastRun + 4000 - Date.now()); pending = setTimeout(async () => { pending = null; lastRun = Date.now(); await pull('pull after a live notice'); }, wait); }); }); sse.on('error', () => {});
    const site = me.sites[0], pre = site === 'main' ? '' : 's~' + site + '~', coordinator = me.role === 'scheduling_coordinator' || me.role === 'manager';
    const wr = async () => {
      const x = Math.random(), name = x < 0.35 ? 'totMessages' : x < 0.6 ? 'totRemarks' : x < 0.9 ? 'totTasks' : coordinator ? 'totSchedule' : 'totTasks', key = pre + name; let e = vals[key]; if (!e) { await pull('pull (before write)'); e = vals[key]; if (!e) return; }
      let v = JSON.parse(e.v); const now = Date.now();
      if (name === 'totMessages') { v.push({ id: 'm' + now + Math.random().toString(36).slice(2, 6), ch: 'ch1', kind: 'msg', email: me.email, by: 'Staff', ts: now, text: 'hello ' + now }); }
      else if (name === 'totRemarks') { v.push({ id: 'r' + now + Math.random().toString(36).slice(2, 5), key: 'x', name: 'Test Person', workId: 'W' + i, date: new Date().toISOString().slice(0, 10), kind: 'note', title: 't', text: 'x', by: 'Staff', share: false }); }
      else if (name === 'totSchedule') { v.cfg = Object.assign({}, v.cfg, { touched: now }); }
      else { v.push({ id: 'tk' + now + Math.random().toString(36).slice(2, 5), num: 'TK-' + now, title: 'Load test ticket', details: 'x', toRole: 'manager', fromEmail: me.email, fromName: 'Staff', fromRole: me.role, created: now, u: now, status: 'open' }); }
      const res = await rpc('save (' + name + ')', { action: 'push', keys: { [key]: { v: JSON.stringify(v), t: now, bt: e.t } } });
      if (res && (res.conflicts || []).length) { err('(info) save conflict, merged and retried'); await pull('pull (after conflict)'); } else if (res && (res.denied || []).length) err('save denied ' + name); else if (res) { vals[key] = { v: JSON.stringify(v), t: now }; }
    };
    let nextW = Date.now() + rnd(0.2, 1.8) * WRITE_EVERY * 1000, nextFull = Date.now() + rnd(60, 120) * 1000;
    while (Date.now() < END) { await sleep(rnd(800, 1200)); if (Date.now() >= END) break; if (Date.now() >= nextFull) { nextFull = Date.now() + 120000; await pull('pull (2-minute safety poll)'); } if (Date.now() >= nextW) { nextW = Date.now() + rnd(0.5, 1.5) * WRITE_EVERY * 1000; await wr(); } }
    sse.destroy(); active--;
  }
  /* ---------- an employee on their own page ---------- */
  async function employeeVU(i) {
    const email = employees[i % employees.length], base = bases[i % bases.length]; await sleep(rnd(0, RAMP * 1000));
    let r = await req(base, 'GET', '/dev/login?email=' + encodeURIComponent(email)); if (r.status !== 302) { err('employee login'); return; } const ck = cookiesOf(r); rec('login', r.ms);
    r = await req(base, 'GET', '/employee', { headers: { cookie: ck } }); rec('employee page (html)', r.ms, r.wire); if (r.status !== 200) err('employee page ' + r.status);
    r = await req(base, 'GET', '/api/session', { headers: { cookie: ck } }); const csrf = JSON.parse(r.buf.toString()).csrf;
    while (Date.now() < END) { const x = await req(base, 'POST', '/api/employee', { headers: { cookie: ck, 'x-ptf-csrf': csrf }, body: { action: 'me' } }); if (x.status !== 200) err('employee me ' + x.status); else { rec('employee page data (me)', x.ms, x.wire); let j; try { j = JSON.parse(x.buf.toString()); } catch (e) {} if (!j || j.error) err('employee me: ' + (j && j.error)); } await sleep(Math.min(rnd(40, 80) * 1000, Math.max(0, END - Date.now()))); }
  }
  const all = []; for (let i = w; i < STAFF; i += W) all.push(staffVU(i)); for (let i = w; i < EMPL; i += W) all.push(employeeVU(i));
  await Promise.all(all); process.send({ done: { lat, errs, bytes, peak } }); process.exit(0);
}
if (process.env.LT_WORKER != null) { process.once('message', (m) => worker(m)); } else main().catch((e) => { console.error(e); process.exit(2); });
