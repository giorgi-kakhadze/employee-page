/**
 * Tool Data service v2.4 (detailed access).1 - Google Apps Script (script.google.com > your project > paste this > Deploy as Web app)
 * 1) KEEP your own ADMIN_SECRET and SERVER_SALT below (do NOT change SERVER_SALT: it would lock everyone out).
 * 2) Deploy > Manage deployments > edit (pencil) > Version: New version > Deploy. The web app URL stays the same.
 * 3) After deploying, open the tool as admin once and press the sync badge. Accounts, roles and sites are then enforced HERE, not only in the browser.
 *
 * What the server now enforces (it used to trust every signed-in browser):
 *  - Sites: a person only receives and can only write the sites the admin ticked for them (Admin > Sites and access > People).
 *  - Only the admin key can write the accounts/roles list and the site list.
 *  - Pay settings (inside the schedule) are only sent to PAY_ROLES. Recruitment data only to the roles in RESTRICT.
 *  - Two devices saving at the same moment: the second one is told "conflict" and re-merges instead of overwriting.
 *  - Wrong-password guessing is slowed down (8 tries, then 15 minutes pause for that email).
 *  - A dated backup copy of tool-data.json is made once a day (last 14 kept) in the same folder.
 * v2.3: action 'me' lets an employee who signs in with Google see only their own shared evaluation results and their own next 28 days of schedule (set GOOGLE_CLIENT_ID).
 * v3.16 employee board: action 'me' now also returns the employee's own profile, schedule and rotation (reads the format the tool writes now: sx/rx with a release time), and their requests. New actions 'reqNew' and 'reqCancel' let a signed-in employee file or cancel ONE of four request types (swap, giveaway, annual, sick). The employee is always identified from the verified Google token, never from what the browser says.
 * v3.22: action 'me' also returns the employee's own game counts (last 12 months, matched by work ID) and the manager name when the employee record has one.
 * v3.23: tickets, cases, comments and announcements are sent per person (own department, own tickets, tickets they sent or are assigned; managers,
 *   seniors and Management see all; HR sees every case). Saves are merged ticket by ticket, so a device that only sees part of the list never removes
 *   the rest, and deleted tickets stay deleted. The audit log is sent to non-admins with only their own entries; their new entries are added, never replaced.
 * v3.24: the access list sent to a non-admin also holds a colleague directory for "Assign to…" (name and position only): their own department,
 *   or everyone for managers, seniors and Management. Their own entry is unchanged.
 * v3.25: spaces reach non-admins. The access list sent to a non-admin holds the spaces they are a member of (members cut to their own entry),
 *   the spaces whose profile tab everyone may view (no members, no screens), and the "Strict" switch. It used to drop all of them.
 * Data lives in your Google Drive folder "Tool Data": tool-data.json (shared data) and access.json (who may use the tool).
 */
const ADMIN_SECRET = 'CHANGE-ME-ADMIN-KEY';
const SERVER_SALT = 'CHANGE-ME-SALT';
const FOLDER = 'Tool Data', DATA = 'tool-data.json', ACCESS = 'access.json';
/* Who may see the pay settings stored inside the schedule (admin always may). */
const PAY_ROLES = ['manager'];   /* v2.1: matches the tool, where only the Manager sees the Pay tab (was also senior and scheduling_coordinator) */
/* Data only these roles may read or write (admin always may). Key name without the site prefix. */
const RESTRICT = { totRecruitment: ['manager', 'senior', 'training_coordinator', 'hr_recruiter'], totWorkbooks: ['manager', 'senior', 'training_coordinator', 'hr_recruiter'], totEmpRequests: ['manager', 'senior', 'scheduling_coordinator', 'hr_recruiter'], totGameCounts: ['manager', 'senior', 'performance_coach', 'training_coordinator', 'hr_recruiter'], totImportHistory: ['manager', 'senior', 'performance_coach', 'training_coordinator', 'hr_recruiter'], totLifecycle: ['manager', 'senior', 'hr_recruiter'], totMySchedules: ['manager', 'senior', 'scheduling_coordinator', 'shift_lead'] };   /* v2.3: per-person 28-day schedules, written only by schedule editors */
/* v2.2 employee self-service: paste your Web client ID from Google Cloud (APIs & Services > Credentials > OAuth client ID > Web application). Leave as is to keep the feature off. */
const GOOGLE_CLIENT_ID = '121975980339-fu9nd124kov2g6j94qiofOrkjkhbkee6.apps.googleusercontent.com';
const ADMIN_ONLY_WRITE = ['totAccessPolicy', 'totSites', 'wsCustomConfig', 'totEvalKinds', 'totEvalCfgBackups', 'totProcessTpl', 'totIntegrations', 'totDeptCfg', 'totAccessGrants'];   /* v3.19: evaluation setup, kinds, backups, process templates and integration settings can only be written with the admin key */
const MAX_TRIES = 8, LOCK_SECONDS = 900, KEEP_BACKUPS = 14;

function folder_() { var it = DriveApp.getFoldersByName(FOLDER); return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER); }
function file_(name, init) { var f = folder_(), it = f.getFilesByName(name); return it.hasNext() ? it.next() : f.createFile(name, init, 'application/json'); }
function readJ_(f, def) { try { return JSON.parse(f.getBlob().getDataAsString() || '') || def; } catch (e) { return def; } }
function sh_(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, SERVER_SALT + s).map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join(''); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function jp_(s, d) { try { var v = JSON.parse(s); return v == null ? d : v; } catch (e) { return d; } }

/* Checks a Google sign-in token with Google and returns the verified email, or null. */
function verifyGoogle_(tok) {
  if (!tok || tok.length > 4000) return null;
  var ck = CacheService.getScriptCache(), h = sh_(tok), c = ck.get('g:' + h);
  if (c) return jp_(c, null);
  try {
    var r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(tok), { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) return null;
    var t = jp_(r.getContentText(), null);
    if (!t || t.aud !== GOOGLE_CLIENT_ID || String(t.email_verified) !== 'true' || (+t.exp || 0) * 1000 < Date.now()) return null;
    var o = { email: String(t.email || '').trim().toLowerCase(), name: String(t.name || '') };
    if (!o.email) return null;
    ck.put('g:' + h, JSON.stringify(o), 600); return o;
  } catch (e) { return null; }
}

/* What ONE employee may see: only results that staff ticked "Share", the scores, the two lowest criteria and the written feedback. Per-criterion trainer notes, other people and pay data are never returned. */
function me_(tok) {
  if (GOOGLE_CLIENT_ID.indexOf('CHANGE-ME') === 0) return { error: 'not configured' };
  var g = verifyGoogle_(tok); if (!g) return { error: 'sign-in invalid' };
  var K = (readJ_(file_(DATA, '{"keys":{}}'), { keys: {} }).keys) || {}, out = { email: g.email, name: '', evaluations: [] }, found = 0, mypre = null, myWid = '';
  Object.keys(K).forEach(function (k) {
    var tail = 'employeeDataSource'; if (k.slice(-tail.length) !== tail || !parseKey_(k) || parseKey_(k).name !== tail) return;
    var pre = k.slice(0, k.length - tail.length);
    var hit = jp_(K[k] && K[k].v, []).filter(function (e) { return e && String(e.email || (e.ext && e.ext.email) || '').trim().toLowerCase() === g.email; });
    if (hit.length !== 1) return;
    var e = hit[0], wid = String(e.workId || '').trim().toLowerCase(); found++; out.name = e.fullName || e.nickname || out.name; mypre = pre; myWid = wid;
    var x0 = e.ext || {}; out.profile = { name: String(e.fullName || '').slice(0, 80), nickname: String(e.nickname || '').slice(0, 40), workId: String(e.workId || '').slice(0, 30), status: String(e.status || '').slice(0, 30), position: String(x0.position || '').slice(0, 60), team: String(x0.team || '').slice(0, 40), shift: String(x0.shift || '').slice(0, 30), startDate: String(x0.startDate || '').slice(0, 20), phone: String(x0.phone || '').slice(0, 30), manager: String(x0.manager || x0.lineManager || '').slice(0, 80), email: g.email, games: String(x0.games || '').split(/[,;\/]+/).map(function (t) { return t.trim().slice(0, 40); }).filter(Boolean).slice(0, 30) };
    var share = jp_(K[pre + 'evalShare'] && K[pre + 'evalShare'].v, {}), res = jp_(K[pre + 'evalResults'] && K[pre + 'evalResults'].v, []);
    /* v3.11: the employee's own retraining rows (date, reason, status only; trainer names, comments and signatures are never sent) */
    var nm = String(e.fullName || e.nickname || '').trim().toLowerCase(), rt = jp_(K[pre + 'totRetrain'] && K[pre + 'totRetrain'].v, {});
    (rt.sessions || []).forEach(function (se) { (se.rows || []).forEach(function (row) {
      if (!row || !((wid && String(row.wid || '').trim().toLowerCase() === wid) || (nm && String(row.name || '').trim().toLowerCase() === nm))) return;
      var at = String(row.attend || '').toLowerCase();
      (out.retraining = out.retraining || []).push({ date: String(row.date || '').slice(0, 20), reason: String(row.reason || '').slice(0, 200), status: at === 'yes' ? 'Completed' : at === 'no' ? 'Missed' : 'Scheduled' });
    }); });
    res.forEach(function (r) {
      var s = r && share[String(r.uid || r.id)]; if (!s || !s.on) return;
      if (!((wid && String(s.wid || '').trim().toLowerCase() === wid) || String(s.email || '').trim().toLowerCase() === g.email)) return;
      var sc = r.scores || {}, crit = (r.criteria || []).map(function (c) { return { name: c.name, group: c.group || '', score: typeof sc[c.id] === 'number' ? sc[c.id] : null }; });
      var low = crit.filter(function (c) { return c.score !== null; }).sort(function (a, b) { return a.score - b.score; }).slice(0, 2).map(function (c) { return c.name; });
      out.evaluations.push({ game: r.typeLabel || '', date: r.date || '', ts: +r.ts || 0, total: r.total == null ? null : r.total, criteria: crit, improve: low, feedback: String(s.fb || '').slice(0, 1000), edited: +r.editedTs || 0, kind: String(r.kind || '').slice(0, 30) });
    });
  });
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  Object.keys(K).forEach(function (k) {
    if (k.slice(-14) !== 'totMySchedules' || !parseKey_(k) || parseKey_(k).name !== 'totMySchedules') return;
    var blob = jp_(K[k] && K[k].v, {}), sent = blob.sent || {}, m = (blob.byEmail || {})[g.email]; if (!m) return;
    /* v3.16: the tool now writes m.sx (schedule days) and m.rx (rotation rows), each with "at" = the time it is released to the employee (0 = already). The old m.days / m.rot with a "sent" flag is still understood. */
    var nowMs = Date.now(), rel = function (d) { return d && /^\d{4}-\d{2}-\d{2}$/.test(String(d.d || '')) && d.d >= today && (!(+d.at > 0) || +d.at <= nowMs); };
    var sx = Array.isArray(m.sx) ? m.sx : (sent.sch ? m.days : null), rx = Array.isArray(m.rx) ? m.rx : (sent.rot ? m.rot : null);
    if (sx) out.schedule = { group: String(m.group || ''), team: String(m.team || ''), shift: String(m.shift || ''), days: sx.filter(rel).slice(0, 28).map(function (d) { return { d: d.d, s: String(d.s || ''), f: d.f == null ? null : +d.f, t: d.t == null ? null : +d.t }; }) };
    if (rx) out.rotation = { group: String(m.group || ''), shift: String(m.shift || ''), days: rx.filter(rel).slice(0, 28).map(function (d) { return { d: d.d, s: String(d.s || ''), f: d.f == null ? null : +d.f, c: (Array.isArray(d.c) ? d.c : []).slice(0, 48).map(function (c) { return String(c || '').slice(0, 40); }) }; }) };
  });
  if (!found) return { error: 'no employee found for this email' };
  /* v3.22: this employee's own game counts (imported from Grafana/CSV in the tool), last 12 months only; matched by work ID, or by exact full name when the row has no ID */
  var gcE = K[mypre + 'totGameCounts'], gcAll = jp_(gcE && gcE.v, []), cut = Utilities.formatDate(new Date(Date.now() - 366 * 86400000), Session.getScriptTimeZone(), 'yyyy-MM'), myNm = String(out.name || '').trim().toLowerCase();
  if (Array.isArray(gcAll)) out.gameCounts = gcAll.filter(function (r) { if (!r || String(r.period || '').slice(0, 7) < cut) return false; var rid = String(r.empId || '').trim().toLowerCase(); return myWid ? rid === myWid : (!rid && myNm && String(r.name || '').trim().toLowerCase() === myNm); })
    .map(function (r) { return { game: String(r.game || '').slice(0, 60), period: String(r.period || '').slice(0, 10), count: +r.count || 0 }; }).sort(function (a, b) { return b.period.localeCompare(a.period); }).slice(0, 300);
  /* v3.16: this employee's own requests (never anyone else's) */
  out.requests = reqList_(K[mypre + 'totEmpRequests'], g.email).slice(0, 40);
  out.evaluations.sort(function (a, b) { return b.ts - a.ts; });
  if (out.retraining) out.retraining = out.retraining.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).slice(0, 30);
  return out;
}

/* ===== v3.16 employee requests ===== */
const REQ_TYPES = { swap: 'Swap a shift', giveaway: 'Give away a shift', annual: 'Annual leave', sick: 'Sick leave' };
function reqList_(entry, email) {
  var a = jp_(entry && entry.v, []); if (!Array.isArray(a)) return [];
  return a.filter(function (r) { return r && String(r.email || '').toLowerCase() === email; }).sort(function (x, y) { return (+y.created || 0) - (+x.created || 0); }).map(function (r) {
    return { id: String(r.id), type: String(r.type), from: String(r.from || ''), to: String(r.to || ''), withName: String(r.with || ''), shift: String(r.shift || ''), note: String(r.note || ''), status: String(r.status || 'pending'), created: +r.created || 0, decisionNote: String(r.decisionNote || '').slice(0, 300), decidedAt: +r.decidedAt || 0 }; });
}
/* finds the ONE employee whose e-mail matches the verified Google e-mail; returns { e, pre } or null */
function empOf_(K, email) {
  var found = null, n = 0, tail = 'employeeDataSource';
  Object.keys(K).forEach(function (k) {
    if (k.slice(-tail.length) !== tail || !parseKey_(k) || parseKey_(k).name !== tail) return;
    var hit = jp_(K[k] && K[k].v, []).filter(function (e) { return e && String(e.email || (e.ext && e.ext.email) || '').trim().toLowerCase() === email; });
    if (hit.length === 1) { found = { e: hit[0], pre: k.slice(0, k.length - tail.length) }; n++; }
  });
  return n === 1 ? found : null;
}
function isoOk_(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !isNaN(new Date(v + 'T12:00:00Z').getTime()); }
function dayDiff_(a, b) { return Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000); }
function reqNew_(b) {
  var g = verifyGoogle_(String(b.idToken || '')); if (!g) return { error: 'sign-in invalid' };
  var df = file_(DATA, '{"keys":{}}'), cur = readJ_(df, { keys: {} }); cur.keys = cur.keys || {};
  var ep = empOf_(cur.keys, g.email); if (!ep) return { error: 'no employee found for this email' };
  var type = String(b.type || ''); if (!REQ_TYPES[type]) return { error: 'bad type' };
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'), from = String(b.from || ''), to = String(b.to || from);
  if (!isoOk_(from) || !isoOk_(to)) return { error: 'Enter valid dates.' };
  if (dayDiff_(from, to) < 0) return { error: 'The end date is before the start date.' };
  if (dayDiff_(from, to) > 60) return { error: 'A request can cover at most 60 days.' };
  if (dayDiff_(today, from) < (type === 'sick' ? -14 : 0) || dayDiff_(today, from) > 400) return { error: type === 'sick' ? 'Sick leave can be reported up to 14 days back.' : 'Choose a date from today onward (within the next 13 months).' };
  var shift = String(b.shift || '').replace(/[^\w \-:]/g, '').slice(0, 30), withName = type === 'swap' ? String(b.withName || '').replace(/[<>]/g, '').slice(0, 80) : '';
  if (type === 'swap' || type === 'giveaway') {
    to = from;   /* one shift = one day */
    var mine = false;
    Object.keys(cur.keys).forEach(function (k) {
      if (k.slice(-14) !== 'totMySchedules' || !parseKey_(k) || parseKey_(k).name !== 'totMySchedules') return;
      var m = (jp_(cur.keys[k] && cur.keys[k].v, {}).byEmail || {})[g.email]; if (!m) return;
      (Array.isArray(m.sx) ? m.sx : (m.days || [])).forEach(function (d) { if (d && d.d === from && ['morning', 'afternoon', 'night'].indexOf(String(d.s)) >= 0) mine = true; });
    });
    if (!mine) return { error: 'That date is not a working day in the schedule that was sent to you.' };
  }
  var note = String(b.note || '').replace(/[<>]/g, '').slice(0, 500), key = ep.pre + 'totEmpRequests', old = cur.keys[key], arr = jp_(old && old.v, []); if (!Array.isArray(arr)) arr = [];
  var mineOpen = arr.filter(function (r) { return r && String(r.email || '').toLowerCase() === g.email && r.status === 'pending'; });
  if (mineOpen.length >= 10) return { error: 'You already have 10 open requests. Wait for a decision or cancel one.' };
  if (mineOpen.some(function (r) { return r.type === type && r.from === from && r.to === to; })) return { error: 'You already sent this request.' };
  var now = Date.now(), nm = String(ep.e.fullName || ep.e.nickname || '').slice(0, 80);
  arr.push({ id: 'er' + now.toString(36) + Math.random().toString(36).slice(2, 6), workId: String(ep.e.workId || '').slice(0, 30), name: nm, email: g.email, type: type, from: from, to: to, with: withName, shift: shift, note: note, status: 'pending', created: now, u: now, src: 'employee', hist: [{ ts: now, who: nm, act: 'submitted' }] });
  if (arr.length > 3000) { arr = arr.filter(function (r) { return r.status === 'pending'; }).concat(arr.filter(function (r) { return r.status !== 'pending'; }).slice(-2000)); }
  cur.keys[key] = { v: JSON.stringify(arr), t: Math.max(now, (+(old && old.t) || 0) + 1) }; cur.updatedAt = now; df.setContent(JSON.stringify(cur));
  return { ok: true, requests: reqList_(cur.keys[key], g.email).slice(0, 40) };
}
function reqCancel_(b) {
  var g = verifyGoogle_(String(b.idToken || '')); if (!g) return { error: 'sign-in invalid' };
  var df = file_(DATA, '{"keys":{}}'), cur = readJ_(df, { keys: {} }); cur.keys = cur.keys || {};
  var ep = empOf_(cur.keys, g.email); if (!ep) return { error: 'no employee found for this email' };
  var key = ep.pre + 'totEmpRequests', old = cur.keys[key], arr = jp_(old && old.v, []), id = String(b.id || ''), r = Array.isArray(arr) ? arr.filter(function (x) { return x && x.id === id && String(x.email || '').toLowerCase() === g.email; })[0] : null;
  if (!r) return { error: 'request not found' }; if (r.status !== 'pending') return { error: 'Only a pending request can be cancelled.' };
  var now = Date.now(); r.status = 'cancelled'; r.u = now; r.hist = (r.hist || []).concat([{ ts: now, who: String(r.name || ''), act: 'cancelled by employee' }]);
  cur.keys[key] = { v: JSON.stringify(arr), t: Math.max(now, (+(old && old.t) || 0) + 1) }; cur.updatedAt = now; df.setContent(JSON.stringify(cur));
  return { ok: true, requests: reqList_(cur.keys[key], g.email).slice(0, 40) };
}

function doGet() { return out_({ ok: true, info: 'Tool Data service v2' }); }

/* ---- slow down password guessing ---- */
function tries_(em) { try { return +(CacheService.getScriptCache().get('f:' + em.slice(0, 100)) || 0); } catch (e) { return 0; } }
function failed_(em) { try { CacheService.getScriptCache().put('f:' + em.slice(0, 100), String(tries_(em) + 1), LOCK_SECONDS); } catch (e) {} }
function cleared_(em) { try { CacheService.getScriptCache().remove('f:' + em.slice(0, 100)); } catch (e) {} }

/* ---- keys: "s~<site>~<name>" belongs to <site>, anything else belongs to the main site ---- */
function parseKey_(k) {
  k = String(k || ''); if (k.length > 90) return null;
  var m = /^s~([a-z0-9-]{1,30})~([A-Za-z0-9_.:-]{1,60})$/.exec(k);
  if (m) return { site: m[1], name: m[2] };
  return /^[A-Za-z0-9_.:-]{1,60}$/.test(k) ? { site: 'main', name: k } : null;
}
function policy_(cur) { try { var e = cur.keys.totAccessPolicy; var p = e && JSON.parse(e.v); return p && typeof p === 'object' ? p : { users: {}, roles: {} }; } catch (x) { return { users: {}, roles: {} }; } }
function whoIs_(cur, em) { var p = policy_(cur), u = (p.users || {})[em]; if (!u || !u.role) return { role: '', sites: [] };   /* v2.1: an approved account with no role yet receives no site data */
  return { role: String(u.role), sites: Array.isArray(u.sites) ? u.sites.map(String) : ['main'] }; }
/* v3.21 ADMIN-ONLY MODE: every screen except Home is locked for non-admins until the admin grants it (tool: Permissions page, key totAccessGrants).
   Switch: totAccessGrants.on === false turns it off; otherwise it is on. Keys not listed here (audit log, employee list, policy, ...) are not gated. */
const GATE_VIEW = { evalResults: 'exam', traineeNotes: 'exam', coachingActions: 'exam', evalShare: 'exam', evalVideos: 'exam', totWorkshopFiles: 'exam', totRetrain: 'exam', wsCustomConfig: 'exam', totEvalKinds: 'exam',
  totOnboardingHier: 'onboarding', totOnboardingV2: 'onboarding', totOnboardingFiles: 'onboarding', totSchedule: 'schedule', totMySchedules: 'schedule', totAppearance: 'appearance', totAppearanceDept: 'appearance',
  totTasks: 'tasks', totCases: 'tasks', totComments: 'tasks', totAnnouncements: 'tasks', totRecruitment: 'recruiting', totWorkbooks: 'recruiting', totEmpRequests: 'requests',
  totGameCounts: 'dept', totImportHistory: 'dept', totLifecycle: 'dept', totDeptDocs: 'dept', totDeptCfg: 'dept', idPrintHistory: 'id', logbookDescriptions: 'logbooks', logbookCustomGames: 'logbooks', logbookSettings: 'logbooks' };
function grants_(cur) { try { var e = cur.keys.totAccessGrants, g = e && JSON.parse(e.v); return g && typeof g === 'object' ? g : {}; } catch (x) { return {}; } }
function gateOk_(cur, em, name) { var v = GATE_VIEW[name]; if (!v) return true; var g = grants_(cur); if (g.on === false) return true; var u = g.byEmail && g.byEmail[em], x = u && u.views && u.views[v]; return !!(x && (!x.until || +x.until > Date.now())); }
function redactGrants_(e, em) { try { var g = JSON.parse(e.v), o = {}; if (g.byEmail && g.byEmail[em]) o[em] = g.byEmail[em]; return { v: JSON.stringify({ v: g.v || 1, on: g.on, u: g.u || 0, byEmail: o }), t: e.t }; } catch (x) { return { v: JSON.stringify({ byEmail: {} }), t: e.t }; } }
function mineAsks_(e, em) { try { var a = JSON.parse(e.v); return { v: JSON.stringify((Array.isArray(a) ? a : []).filter(function (r) { return r && r.email === em; })), t: e.t }; } catch (x) { return { v: '[]', t: e.t }; } }
function mergeAsks_(newV, oldV, em) { var n = [], o = []; try { n = JSON.parse(newV); } catch (x) {} try { o = oldV ? JSON.parse(oldV) : []; } catch (x) {} n = (Array.isArray(n) ? n : []).filter(function (r) { return r && r.email === em; }).slice(-200); o = (Array.isArray(o) ? o : []).filter(function (r) { return r && r.email !== em; }); return JSON.stringify(o.concat(n)); }
function roleOk_(name, role) { var r = RESTRICT[name]; return !r || r.indexOf(role) >= 0; }
/* v2.4: detailed access. The admin ticks parts per position in the tool (Admin > Detailed access); the policy keeps policy.roles[role].caps.
   If a position has no ticks yet, its old "spaces" list decides (same defaults as the tool). */
const CAP_VIEW = { onboarding: 'onboarding', ws_register: 'exam', ws_checklist: 'exam', exam_check: 'exam', results_view: 'exam', results_edit: 'exam', results_send: 'exam', videos_upload: 'exam', id: 'id', logbooks: 'logbooks', fmd_view: 'schedule', appearance_view: 'appearance', appearance_issue: 'appearance', appearance_manage: 'appearance' };
const DEFAULT_VIEWS = { shift_lead: ['exam', 'id', 'schedule'], performance_coach: ['exam', 'schedule'], scheduling_coordinator: ['schedule'] };
/* data keys that need a part of the tool: who may read them and who may write them */
const KEY_CAPS = { totWorkshopFiles: { read: ['ws_register'], write: ['ws_register'] }, totOnboardingFiles: { read: ['onboarding'], write: ['onboarding'] },
  evalResults: { read: ['results_view', 'exam_check', 'ws_checklist'], write: ['exam_check', 'ws_checklist', 'results_edit'] }, evalShare: { read: ['results_send', 'results_view'], write: ['results_send'] },
  evalVideos: { read: ['videos_view', 'videos_upload'], write: ['videos_upload'] },
  totAppearanceDept: { read: ['appearance_view', 'appearance_issue', 'appearance_manage'], write: ['appearance_issue', 'appearance_manage'] } };   /* v2.5: uniforms inventory and transactions */
function capsFor_(cur, role) { var p = policy_(cur), r = (p.roles || {})[role], c = r && r.caps; if (c && typeof c === 'object') return c;
  var views = r && Array.isArray(r.views) ? r.views : (DEFAULT_VIEWS[role] || ['onboarding', 'exam', 'id', 'logbooks', 'schedule', 'appearance']), o = {}; Object.keys(CAP_VIEW).forEach(function (k) { o[k] = views.indexOf(CAP_VIEW[k]) >= 0; }); o.videos_view = role === 'manager'; return o; }
function capOk_(name, me, mode) { var r = KEY_CAPS[name]; if (!r) return true; return r[mode].some(function (k) { return !!(me.caps && me.caps[k]); }); }
/* v3.24: a non-admin receives their own full entry plus a directory of colleagues for "Assign to…", with only { name, role } each:
   everyone in their own department, or everyone for managers, seniors and Management (c is ctx_, so the department rules match the ticket rules) */
function redactPolicy_(e, em, c) { try { var p = JSON.parse(e.v), all = p.users || {}, u = {};
  Object.keys(all).forEach(function (k) { var x = all[k]; if (!x || typeof x !== 'object') return; if (k === em) { u[k] = x; return; }
    if (c && (c.all || (c.dept && c.dOf(x.role) === c.dept))) u[k] = { name: String(x.name || ''), role: String(x.role || '') }; });
  var o = { roles: p.roles || {}, depts: p.depts || {}, users: u, upd: p.upd || 0 };
  if (Array.isArray(p.spaces)) { var sp = redactSpaces_(p.spaces, em); o.spaces = sp.list; if (sp.on) o.spacesOn = true; }
  if ('spacesStrict' in p) o.spacesStrict = !!p.spacesStrict;
  return { v: JSON.stringify(o), t: e.t }; } catch (x) { return { v: JSON.stringify({ roles: {}, users: {}, upd: 0 }), t: e.t }; } }
/* v3.25: spaces (Admin > Manage spaces). A non-admin receives the spaces they are a member of, with only their own entry in members, and the
   spaces whose profile tab everyone may view (s.open), with no members and no screens. spacesOn tells the device the organisation has spaces,
   so "Strict" still applies to a person who is in none of them. */
function redactSpaces_(all, em) { var list = [], on = false;
  all.forEach(function (s) { if (!s || typeof s !== 'object' || !s.id || !s.name) return; on = true;
    var m = s.members && typeof s.members === 'object' ? s.members : {}, r = '';
    Object.keys(m).forEach(function (k) { if (low_(k) === em && m[k]) r = String(m[k]); });
    if (r) { var x = {}; Object.keys(s).forEach(function (k) { x[k] = s[k]; }); x.members = {}; x.members[em] = r; list.push(x); }
    else if (s.open) list.push({ id: s.id, name: s.name, icon: s.icon || '', open: true, fields: Array.isArray(s.fields) ? s.fields : [], members: {} }); });
  return { list: list, on: on }; }
function stripPay_(e) { try { var o = JSON.parse(e.v); if (o && typeof o === 'object' && !Array.isArray(o) && 'pay' in o) { delete o.pay; return { v: JSON.stringify(o), t: e.t }; } } catch (x) {} return e; }
function keepPay_(newV, oldV) { try { var n = JSON.parse(newV); if (!n || typeof n !== 'object' || Array.isArray(n)) return newV; var o = oldV ? JSON.parse(oldV) : null; if (o && o.pay !== undefined) n.pay = o.pay; else delete n.pay; return JSON.stringify(n); } catch (x) { return newV; } }

/* ===== v3.23 record-level privacy: tickets (totTasks), cases (totCases), comments (totComments), announcements (totAnnouncements), audit log ===== */
/* Same department list and default position -> department mapping as the tool (Admin can change the mapping; it is stored in policy.depts). */
const DEPT_IDS = ['academy', 'performance', 'fmd', 'appearance', 'hr', 'access', 'it', 'management'];
const DEPT_DEF = { training_coordinator: 'academy', performance_coach: 'performance', shift_lead: 'performance', scheduling_coordinator: 'fmd', senior: 'management', manager: 'management', hr_recruiter: 'hr' };
const SCOPED = ['totTasks', 'totCases', 'totAnnouncements', 'totComments'];   /* comments last: their visibility depends on the tickets and announcements */
const DEL_KEEP_DAYS = 180, AUDIT_MAX = 20000;
function low_(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
/* who is asking: the admin key sees everything; everybody else is described by their position and department */
function ctx_(cur, em, admin) {
  var cache = {}, c = { all: !!admin, em: em, name: '', dept: '', cache: cache };
  c.idx = function (pre, name) { var k = pre + name; if (!cache[k]) { var o = {}, a = jp_(cur.keys[k] && cur.keys[k].v, []); (Array.isArray(a) ? a : []).forEach(function (x) { if (x && x.id != null) o[String(x.id)] = x; }); cache[k] = o; } return cache[k]; };
  if (admin) return c;
  var p = policy_(cur), u = (p.users || {})[em] || {}, depts = p.depts || {}, role = String(u.role || '');
  c.dOf = function (x) { x = String(x || ''); return DEPT_IDS.indexOf(x) >= 0 ? x : (depts[x] || DEPT_DEF[x] || x); };
  c.name = low_(u.name); c.dept = c.dOf(role);
  c.all = role === 'manager' || role === 'senior' || c.dept === 'management';   /* same people the tool lets open "All tasks" and every department */
  return c;
}
/* a ticket is visible to: its sender, its assignee, the department it is addressed to, the department that sent it, and (for case tickets) HR */
function taskVis_(t, c) {
  if (c.all) return true; if (!t) return false;
  var fe = low_(t.fromEmail), te = low_(t.toEmail);
  if (fe ? fe === c.em : (c.name && low_(t.fromName) === c.name)) return true;
  if (te ? te === c.em : (c.name && !!t.toName && low_(t.toName) === c.name)) return true;
  if (c.dept && (c.dOf(t.toRole) === c.dept || c.dOf(t.fromRole) === c.dept)) return true;
  return !!t.caseId && c.dept === 'hr';
}
function caseVis_(x, c) { return c.all || c.dept === 'hr' || (!!x && low_(x.byEmail) === c.em); }
function annVis_(a, c) { if (c.all) return true; if (!a) return false; if (low_(a.fromEmail) === c.em) return true; var to = Array.isArray(a.toRoles) ? a.toRoles : []; return !to.length || to.some(function (x) { return c.dOf(x) === c.dept; }); }
function cmVis_(x, c, pre) {
  if (c.all) return true; if (!x) return false; if (low_(x.email) === c.em) return true;
  if (x.kind === 'task') return taskVis_(c.idx(pre, 'totTasks')[String(x.ref)], c);
  if (x.kind === 'ann' || x.kind === 'ack') return annVis_(c.idx(pre, 'totAnnouncements')[String(x.ref)], c);
  return false;   /* unknown kinds stay private to their author */
}
function recVis_(name, x, c, pre) { return name === 'totTasks' ? taskVis_(x, c) : name === 'totCases' ? caseVis_(x, c) : name === 'totAnnouncements' ? annVis_(x, c) : cmVis_(x, c, pre); }
/* who may delete a record: the person who created it, or someone who sees everything (same rule as the tool's delete buttons) */
function recOwner_(name, x, c) { if (c.all) return true; var e = name === 'totComments' ? x.email : name === 'totCases' ? x.byEmail : x.fromEmail, n = name === 'totComments' ? x.who : name === 'totCases' ? x.by : x.fromName;
  return e ? low_(e) === c.em : (!!c.name && low_(n) === c.name); }   /* records saved before e-mails were stored: the name from the access list */
function scopedPull_(name, v, c, pre) { var a = jp_(v, null); if (!Array.isArray(a)) return c.all ? v : '[]'; return c.all ? v : JSON.stringify(a.filter(function (x) { return x && recVis_(name, x, c, pre); })); }
/* merge a save record by record: records this person cannot see are kept untouched; a visible record missing from the save counts as deleted only if
   this person may delete it; new records are accepted only if this person can see them; deleted ids are remembered so they never come back */
function scopedPush_(name, newV, oldV, c, pre, del) {
  var n = jp_(newV, null), o = jp_(oldV, []), now = Date.now(); if (!Array.isArray(n)) return null; if (!Array.isArray(o)) o = [];
  var inN = {}, seen = {}, out = [];
  n.forEach(function (x) { if (x && x.id != null) inN[String(x.id)] = x; });
  o.forEach(function (x) { var id = x && x.id != null ? String(x.id) : null; if (id == null) { out.push(x); return; } seen[id] = 1;
    if (!recVis_(name, x, c, pre)) { out.push(x); return; }
    if (inN[id] !== undefined) { out.push(inN[id]); return; }
    if (recOwner_(name, x, c)) { del[id] = now; return; }
    out.push(x); });
  n.forEach(function (x) { var id = x && x.id != null ? String(x.id) : null; if (id == null || seen[id] || del[id]) return; seen[id] = 1; if (recVis_(name, x, c, pre)) out.push(x); });
  return JSON.stringify(out);
}
function delMap_(cur, k) { cur.del = cur.del || {}; var m = cur.del[k] = cur.del[k] || {}, cut = Date.now() - DEL_KEEP_DAYS * 86400000; Object.keys(m).forEach(function (i) { if (m[i] < cut) delete m[i]; }); return m; }
/* audit log for non-admins: they receive their own entries; what they send is added (never replaces), and only entries in their own name are accepted */
function auditMine_(x, c) { var e = low_(x && x.email); return e ? e === c.em : (!!c.name && low_(x && x.who) === c.name); }
function auditId_(x) { return x && x.id != null ? String(x.id) : x && typeof x === 'object' ? String(x.ts) + '|' + x.who + '|' + x.act : JSON.stringify(x); }
function auditPull_(v, c) { var a = jp_(v, null); return Array.isArray(a) ? JSON.stringify(a.filter(function (x) { return auditMine_(x, c); })) : '[]'; }
function auditPush_(newV, oldV, c) {
  var n = jp_(newV, null), o = jp_(oldV, []); if (!Array.isArray(n)) return null; if (!Array.isArray(o)) o = [];
  var seen = {}; o.forEach(function (x) { seen[auditId_(x)] = 1; });
  n.forEach(function (x) { if (!x || typeof x !== 'object' || seen[auditId_(x)]) return; var e = low_(x.email); if (e && e !== c.em) return; if (!e) x.email = c.em; seen[auditId_(x)] = 1; o.push(x); });
  if (o.length > AUDIT_MAX) { o.sort(function (a, b) { return (+(a && a.ts) || 0) - (+(b && b.ts) || 0); }); o = o.slice(-AUDIT_MAX); }
  return JSON.stringify(o);
}

function backup_(df) {
  try {
    var P = PropertiesService.getScriptProperties(), day = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    if (P.getProperty('LAST_BK') === day) return; P.setProperty('LAST_BK', day);
    var f = folder_(); f.createFile('tool-data-backup-' + day + '.json', df.getBlob().getDataAsString(), 'application/json');
    var all = [], it = f.getFiles(); while (it.hasNext()) { var x = it.next(); if (/^tool-data-backup-\d{4}-\d{2}-\d{2}\.json$/.test(x.getName())) all.push(x); }
    all.sort(function (a, b) { return a.getName() < b.getName() ? 1 : -1; }); all.slice(KEEP_BACKUPS).forEach(function (x) { x.setTrashed(true); });
  } catch (e) {}
}

function doPost(e) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var b = JSON.parse(e.postData.contents), act = b.action, admin = b.admin === ADMIN_SECRET;
    var af = file_(ACCESS, '{"users":{}}'), acc = readJ_(af, { users: {} }); acc.users = acc.users || {};
    var em = String(b.email || '').trim().toLowerCase();
    function saveAcc() { af.setContent(JSON.stringify(acc)); }

    if (act === 'request') {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em) || !b.pwHash) return out_({ error: 'invalid' });
      if (acc.users[em]) { if (acc.users[em].ph !== sh_(b.pwHash)) { failed_(em); return out_({ status: 'bad', exists: true }); }   /* v2.1: only the owner of the password learns the status */
        return out_({ status: acc.users[em].status, exists: true }); }
      if (Object.keys(acc.users).length >= 500) return out_({ error: 'full' });
      acc.users[em] = { name: String(b.name || '').slice(0, 80), ph: sh_(b.pwHash), status: 'pending', at: Date.now() }; saveAcc();
      try { MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'Tool access request: ' + em, (b.name || '') + ' (' + em + ') asked for access.\nOpen the tool > admin space > Access requests to approve or deny.'); } catch (x) {}
      return out_({ status: 'pending' });
    }
    if (act === 'me') return out_(me_(String(b.idToken || '')));
    if (act === 'reqNew') return out_(reqNew_(b));
    if (act === 'reqCancel') return out_(reqCancel_(b));
    if (act === 'login') {
      if (tries_(em) >= MAX_TRIES) return out_({ status: 'locked' });
      var u = acc.users[em], good = !!u && u.ph === sh_(b.pwHash);
      if (good) cleared_(em); else failed_(em);
      return out_({ status: !good ? 'bad' : u.status });
    }

    if (admin && act === 'list') return out_({ users: Object.keys(acc.users).map(function (k) { return { email: k, name: acc.users[k].name, status: acc.users[k].status, at: acc.users[k].at }; }) });
    if (admin && act === 'setStatus') { if (acc.users[em]) { acc.users[em].status = b.status === 'approved' ? 'approved' : 'denied'; saveAcc(); } return out_({ ok: true }); }
    if (admin && act === 'remove') { delete acc.users[em]; saveAcc(); return out_({ ok: true }); }

    var allowed = admin;
    if (!allowed) {
      if (tries_(em) >= MAX_TRIES) return out_({ error: 'locked' });
      var v = acc.users[em]; allowed = !!v && v.status === 'approved' && v.ph === sh_(b.pwHash);
      if (allowed) cleared_(em); else if (em) failed_(em);
    }
    if (!allowed) return out_({ error: 'not allowed' });

    if (act === 'video') {   /* v2.88: resumable upload to Drive in 256 KB-multiple pieces; private to the owner */
      var up = String(b.up || '').replace(/[^\w]/g, '').slice(0, 40), i = +b.i, n = +b.n, size = +b.size, CH = 1572864, cache = CacheService.getScriptCache();
      if (!up || !(size > 0) || size > 41943040 || !(n >= 1) || !(i >= 0) || i >= n) return out_({ error: 'bad upload' });
      var mime = /^video\//.test(String(b.mime || '')) ? String(b.mime) : 'video/mp4', loc = cache.get('u:' + up);
      if (!loc) {
        if (i !== 0) return out_({ error: 'upload session lost, start again' });
        if (!admin) { var dfv = file_(DATA, '{"keys":{}}'), curv = readJ_(dfv, { keys: {} }); curv.keys = curv.keys || {}; var mv = whoIs_(curv, em); if (!capsFor_(curv, mv.role).videos_upload) return out_({ error: 'not allowed' }); }   /* v2.4 */
        var ir = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id', { method: 'post', contentType: 'application/json; charset=UTF-8', headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(size) }, payload: JSON.stringify({ name: String(b.name || 'video').slice(0, 100), parents: [folder_().getId()] }), muteHttpExceptions: true });
        loc = ir.getHeaders().Location || ir.getHeaders().location; if (!loc) return out_({ error: 'drive refused the upload' });
        cache.put('u:' + up, loc, 21000);
      }
      var bytes = Utilities.base64Decode(String(b.data || '')), s0 = i * CH, e0 = s0 + bytes.length - 1;
      var pr = UrlFetchApp.fetch(loc, { method: 'put', contentType: mime, headers: { 'Content-Range': 'bytes ' + s0 + '-' + e0 + '/' + size }, payload: bytes, muteHttpExceptions: true }), code = pr.getResponseCode();
      if (code === 308) return out_({ ok: true });
      if (code === 200 || code === 201) {
        var fid = JSON.parse(pr.getContentText()).id;
        cleanVideos_();   /* videos stay private to the owner; managers watch them through the tool */
        cache.remove('u:' + up); return out_({ ok: true, fileId: fid });
      }
      return out_({ error: 'drive error ' + code });
    }
    var df = file_(DATA, '{"keys":{}}'), cur = readJ_(df, { keys: {} }); cur.keys = cur.keys || {};
    var me = admin ? null : whoIs_(cur, em); if (me) me.caps = capsFor_(cur, me.role);

    if (act === 'videoGet') {   /* v2.91: managers only; the file must live in the tool folder */
      if (!(admin || (me && me.caps && me.caps.videos_view))) return out_({ error: 'not allowed' });   /* v2.4: was managers only; now the "Watch evaluation videos" tick */
      var vid = String(b.id || ''), vi = Math.max(0, +b.i || 0), VCH = 1572864; if (!/^[\w-]+$/.test(vid)) return out_({ error: 'bad id' });
      var vf; try { vf = DriveApp.getFileById(vid); } catch (x) { return out_({ error: 'gone' }); } if (vf.isTrashed()) return out_({ error: 'gone' });
      var inF = false, ps = vf.getParents(), fid0 = folder_().getId(); while (ps.hasNext()) { if (ps.next().getId() === fid0) inF = true; } if (!inF) return out_({ error: 'not allowed' });
      var vsize = vf.getSize(), vs0 = vi * VCH; if (vs0 >= vsize) return out_({ error: 'bad range' });
      var rr = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + vid + '?alt=media', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), Range: 'bytes=' + vs0 + '-' + (Math.min(vsize, vs0 + VCH) - 1) }, muteHttpExceptions: true });
      if (rr.getResponseCode() >= 300) return out_({ error: 'drive error ' + rr.getResponseCode() });
      return out_({ ok: true, n: Math.ceil(vsize / VCH), mime: vf.getMimeType(), data: Utilities.base64Encode(rr.getContent()) });
    }
    var cx = ctx_(cur, em, admin);   /* v3.23 who is asking, for record-level filtering */
    if (act === 'pull') {
      if (admin) return out_({ keys: cur.keys, updatedAt: cur.updatedAt || 0 });
      var res = { keys: {}, updatedAt: cur.updatedAt || 0 };
      Object.keys(cur.keys).forEach(function (k) {
        var p = parseKey_(k), en = cur.keys[k]; if (!p || !en) return;
        if (k === 'totAccessPolicy') { res.keys[k] = redactPolicy_(en, em, cx); return; }
        if (k === 'totSites') { res.keys[k] = en; return; }
        if (p.name === 'totAccessGrants') { res.keys[k] = redactGrants_(en, em); return; }
        if (p.name === 'totAccessAsks') { res.keys[k] = mineAsks_(en, em); return; }
        if (me.sites.indexOf(p.site) < 0 || !roleOk_(p.name, me.role) || !capOk_(p.name, me, 'read') || !gateOk_(cur, em, p.name)) return;
        var pre = k.slice(0, k.length - p.name.length);
        if (SCOPED.indexOf(p.name) >= 0) { res.keys[k] = { v: scopedPull_(p.name, en.v, cx, pre), t: en.t }; return; }   /* v3.23 */
        if (p.name === 'auditLog') { res.keys[k] = { v: auditPull_(en.v, cx), t: en.t }; return; }
        res.keys[k] = (p.name === 'totSchedule' && PAY_ROLES.indexOf(me.role) < 0) ? stripPay_(en) : en;
      });
      return out_(res);
    }
    if (act === 'push') {
      var conflicts = [], denied = [], now = Date.now(), changed = false;
      var order = function (k) { var q = parseKey_(k), i = q ? SCOPED.indexOf(q.name) : -1; return i < 0 ? 0 : i + 1; };   /* tickets and announcements before comments */
      Object.keys(b.keys || {}).sort(function (x, y) { return order(x) - order(y); }).forEach(function (k) {
        var n = b.keys[k], p = parseKey_(k);
        if (!p || !n || typeof n.v !== 'string' || n.v.length > 4500000) { denied.push(k); return; }
        if (!admin && (ADMIN_ONLY_WRITE.indexOf(k) >= 0 || ADMIN_ONLY_WRITE.indexOf(p.name) >= 0 || me.sites.indexOf(p.site) < 0 || !roleOk_(p.name, me.role) || !capOk_(p.name, me, 'write') || !gateOk_(cur, em, p.name))) { denied.push(k); return; }
        var o = cur.keys[k], t = Math.min(+n.t || now, now + 60000), pre = k.slice(0, k.length - p.name.length);
        if (!admin && p.name === 'auditLog') { var av = auditPush_(n.v, o && o.v, cx); if (av == null) { denied.push(k); return; } cur.keys[k] = { v: av, t: Math.max(now, (+(o && o.t) || 0) + 1) }; changed = true; return; }   /* v3.23 add-only, never a conflict */
        if (o && n.bt != null && (+o.t || 0) > (+n.bt || 0)) { conflicts.push(k); return; }   /* somebody saved after this device last read it */
        if (o && n.bt == null && t < (+o.t || 0)) return;                                    /* old clients: newest time wins */
        var val = n.v;
        if (!admin && p.name === 'totSchedule' && PAY_ROLES.indexOf(me.role) < 0) val = keepPay_(val, o && o.v);
        if (!admin && p.name === 'totAccessAsks') val = mergeAsks_(val, o && o.v, em);   /* a person may only write their own requests; other people's are kept */
        if (SCOPED.indexOf(p.name) >= 0) { val = scopedPush_(p.name, val, o && o.v, cx, pre, delMap_(cur, k)); if (val == null) { denied.push(k); return; } delete cx.cache[k]; }   /* v3.23 */
        if (o) t = Math.max(t, (+o.t || 0) + 1);                                              /* versions only go up, so a missed save is always noticed */
        cur.keys[k] = { v: val, t: t }; changed = true;
      });
      if (changed) { backup_(df); cur.updatedAt = now; df.setContent(JSON.stringify(cur)); }
      return out_({ ok: true, conflicts: conflicts, denied: denied });
    }
    return out_({ error: 'unknown' });
  } finally { lock.releaseLock(); }
}


/* v2.91: evaluation videos are deleted after 62 days. Run installVideoCleanup() ONCE from the Apps Script editor to check daily. */
function cleanVideos_() { var cut = Date.now() - 62 * 86400000, it = folder_().getFiles(); while (it.hasNext()) { var f = it.next(); if (/^video\//.test(f.getMimeType()) && f.getDateCreated().getTime() < cut) f.setTrashed(true); } }
function installVideoCleanup() { ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'cleanVideos_') ScriptApp.deleteTrigger(t); }); ScriptApp.newTrigger('cleanVideos_').timeBased().everyDays(1).create(); }
