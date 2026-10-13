#!/usr/bin/env node
'use strict';
/* Builds a realistic big data set for load tests from the 1,073-person demo backup (demo/PTF-demo-backup.json).
   Layout like the company described: one large location (about 2,000 people) and three more of about 1,000 each, i.e. about 5,000 people,
   each location is its own "site" of the tool (its own keys, s~<site>~name), exactly as the tool stores locations.
     node scripts/scale-demo.js [out.json] [--main 2100] [--sites 3] [--site-size 1000]
   Output: { keys: { name: { v, t } } } in the format scripts/import-backup.js reads. Everything is fictional. */
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2), outFile = args.find((a) => !a.startsWith('--')) || path.join(__dirname, '..', 'data', 'scaled-demo.json');
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? +args[i + 1] : d; };
const MAIN = opt('main', 2100), SITES = opt('sites', 3), SIZE = opt('site-size', 1000);
const demo = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'demo', 'PTF-demo-backup.json'), 'utf8')).data;
const J = (k) => JSON.parse(demo[k]);
const emps0 = J('employeeDataSource'), BASE = emps0.length;
const low = (s) => String(s || '').trim().toLowerCase();

/* one clone of the whole person-related data, with every name, work id and e-mail replaced by new ones */
function makeClone(k, tag) {
  const nameMap = {}, widMap = {}, mailMap = {}, lowMap = {};
  emps0.forEach((e, i) => {
    const nn = e.fullName + ' ' + tag, wid = 'E' + tag + String(e.workId).replace(/^\D+/, ''), mail = String(e.ext && e.ext.email || '').replace('@', '.' + tag + '@');
    nameMap[e.fullName] = nn; nameMap[e.nickname] = nameMap[e.nickname] || e.nickname; widMap[e.workId] = wid; if (e.ext && e.ext.email) mailMap[e.ext.email] = mail; lowMap[low(e.fullName)] = low(nn);
  });
  const mapStr = (s) => { if (s in nameMap && s.indexOf(' ') > 0) return nameMap[s]; if (s in widMap) return widMap[s]; if (s in mailMap) return mailMap[s]; if (s in lowMap) return lowMap[s]; return s; };
  const walk = (v, key) => {
    if (typeof v === 'string') return (key === 'id' || key === 'uid' || key === 'k') ? mapStr(v) + '~' + tag : mapStr(v);
    if (Array.isArray(v)) return v.map((x) => walk(x, key));
    if (v && typeof v === 'object') { const o = {}; Object.keys(v).forEach((kk) => { o[kk in lowMap ? lowMap[kk] : (kk in widMap ? widMap[kk] : kk)] = walk(v[kk], kk); }); return o; }
    return v;
  };
  return walk;
}

/* data of one site made of `copies` people-sets of the demo (the first is the demo itself) */
function buildSite(copies, tagBase) {
  const keys = {}, put = (name, val) => { keys[name] = JSON.stringify(val); };
  const personArrays = ['employeeDataSource', 'evalResults', 'traineeNotes', 'coachingActions', 'totGameCounts', 'totRemarks', 'totIncidents', 'totLifecycle', 'totBonusReviews', 'totEmpRequests', 'employeeHistory', 'totTasks', 'totCases', 'totComments', 'auditLog'];
  const other = Object.keys(demo).filter((k) => k !== 'totTrainerDisplayName' && !personArrays.includes(k) && !['totSchedule', 'evalShare', 'totRetrain'].includes(k));
  other.forEach((k) => { keys[k] = demo[k]; });
  const tag = (c) => (tagBase || '') + 'c' + c, c0 = tagBase ? 0 : 1;   /* a new location has no original: every copy is renamed */
  personArrays.forEach((k) => { let all = tagBase ? [] : J(k); for (let c = c0; c < copies; c++) { const w = makeClone(k, tag(c)); all = all.concat(J(k).map((x) => w(x))); } put(k, all); });
  const sch = J('totSchedule'), share = J('evalShare'), ret = J('totRetrain');
  const orig = { sched: {}, hrs: {}, prof: Object.keys(sch.profiles || {}), share: Object.keys(share) };
  Object.keys(sch.sched).forEach((m) => { orig.sched[m] = Object.keys(sch.sched[m]); }); Object.keys(sch.hrs || {}).forEach((m) => { orig.hrs[m] = Object.keys(sch.hrs[m]); });
  const origRows = {}; Object.keys(sch.days || {}).forEach((d) => { const sh = sch.days[d].shifts || {}; Object.keys(sh).forEach((s) => { origRows[d + '|' + s] = sh[s].rows || []; if (tagBase) sh[s].rows = []; }); });
  const origSess = (ret.sessions || []).map((s) => s.rows || []); if (tagBase) (ret.sessions || []).forEach((s) => { s.rows = []; });
  for (let c = c0; c < copies; c++) {
    const w = makeClone('s', tag(c));
    Object.keys(sch.sched).forEach((m) => { const add = {}; orig.sched[m].forEach((p) => { add[w(p)] = w(sch.sched[m][p]); }); Object.assign(sch.sched[m], add); });
    Object.keys(sch.hrs || {}).forEach((m) => { const add = {}; orig.hrs[m].forEach((p) => { add[w(p)] = sch.hrs[m][p]; }); Object.assign(sch.hrs[m], add); });
    const pr = {}; orig.prof.forEach((p) => { pr[w(p)] = w(sch.profiles[p]); }); Object.assign(sch.profiles, pr);
    Object.keys(sch.days || {}).forEach((d) => { const sh = sch.days[d].shifts || {}; Object.keys(sh).forEach((s) => { sh[s].rows = (sh[s].rows || []).concat(origRows[d + '|' + s].slice(0, 200).map((r) => w(r))); }); });
    orig.share.forEach((u) => { share[w(u) + '~' + tag(c)] = w(share[u]); });
    (ret.sessions || []).forEach((s, si) => { s.rows = (s.rows || []).concat(origSess[si].map((r) => w(r))); });
  }
  if (tagBase) { Object.keys(orig.sched).forEach((m) => orig.sched[m].forEach((p) => delete sch.sched[m][p])); Object.keys(orig.hrs).forEach((m) => orig.hrs[m].forEach((p) => delete sch.hrs[m][p])); orig.prof.forEach((p) => delete sch.profiles[p]); orig.share.forEach((u) => delete share[u]); }
  put('totSchedule', sch); put('evalShare', share); put('totRetrain', ret);
  /* the schedules each coordinator has sent to people: 28 days each */
  const emps = JSON.parse(keys.employeeDataSource), by = {}, today = new Date(); today.setHours(12, 0, 0, 0);
  emps.forEach((e, i) => { const mail = e.ext && e.ext.email; if (!mail || e.status !== 'Employed') return; const sx = []; for (let d = 0; d < 28; d++) { const dt = new Date(today.getTime() + d * 864e5); if ((d + i) % 7 > 4) continue; const s = ['morning', 'afternoon', 'night'][i % 3]; sx.push({ d: dt.toISOString().slice(0, 10), s, f: s === 'morning' ? 8 : s === 'afternoon' ? 14 : 22, t: s === 'morning' ? 16 : s === 'afternoon' ? 22 : 6 }); } by[low(mail)] = { sx, group: 'A', shift: 'morning' }; });
  put('totMySchedules', { byEmail: by, sent: {} });
  return keys;
}

const now = Date.now(), out = { keys: {} };
const mainCopies = Math.max(1, Math.round(MAIN / BASE)), siteCopies = Math.max(1, Math.round(SIZE / BASE));
const siteIds = ['main'].concat(Array.from({ length: SITES }, (_, i) => 'site' + (i + 2)));
siteIds.forEach((id, i) => { const ks = buildSite(i === 0 ? mainCopies : siteCopies, i === 0 ? '' : 's' + i), pre = id === 'main' ? '' : 's~' + id + '~'; Object.keys(ks).forEach((k) => { if (id !== 'main' && ['totAccessPolicy', 'totSites'].includes(k)) return; out.keys[pre + k] = { v: ks[k], t: now - 60000 }; }); });
/* accounts: the demo's staff; managers get every site; plus the access-rules and site list */
const pol = JSON.parse(out.keys.totAccessPolicy.v); Object.keys(pol.users).forEach((e) => { pol.users[e].sites = pol.users[e].role === 'manager' ? siteIds : ['main']; }); out.keys.totAccessPolicy = { v: JSON.stringify(pol), t: now - 60000 };
out.keys.totSites = { v: JSON.stringify(siteIds.map((id) => ({ id, name: id === 'main' ? 'Main site' : 'Location ' + id.slice(4) }))), t: now - 60000 };
out.keys.totAccessGrants = { v: JSON.stringify({ v: 1, on: false, byEmail: {} }), t: now - 60000 };
let people = 0; siteIds.forEach((id) => { people += JSON.parse(out.keys[(id === 'main' ? '' : 's~' + id + '~') + 'employeeDataSource'].v).length; });
fs.mkdirSync(path.dirname(outFile), { recursive: true }); fs.writeFileSync(outFile, JSON.stringify(out));
const sizes = Object.keys(out.keys).map((k) => [k, out.keys[k].v.length]).sort((a, b) => b[1] - a[1]);
console.log('wrote ' + outFile + ': ' + people + ' people on ' + siteIds.length + ' sites, ' + Object.keys(out.keys).length + ' keys, ' + Math.round(sizes.reduce((s, x) => s + x[1], 0) / 1048576) + ' MB; biggest key ' + sizes[0][0] + ' ' + Math.round(sizes[0][1] / 1024) + ' KB (limit 4,500 KB)');
if (sizes[0][1] > 4500000) { console.error('WARNING: a key is over the 4.5 MB limit; the tool would refuse to save it'); process.exitCode = 3; }
