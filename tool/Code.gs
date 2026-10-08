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
 * v3.25: Management is a position, not a department: 'management' left the department list and managers/seniors are no longer mapped to a department
 *   (they still see everything; a position the admin mapped to the old Management department keeps that too). Uniforms, Building access and IT
 *   can read (not edit or delete) the case record of every case that created a ticket for them. FMD (scheduling coordinators) receives game counts and their import history.
 * v3.28: change journal 'totJournal' (add-only like the audit log, max 8000 entries): a person receives their own entries, their department's, and the
 *   entries about data they may read themselves. Photos attached to evaluations ('evalPhotos') follow the evaluation rights.
 * v3.29: Service Management department ('service', position 'service_manager'). Incidents ('totIncidents', import history 'totIncImports', settings
 *   'totIncCfg') go to service managers, managers, seniors, performance coaches (read only) and positions mapped to the department.
 * v3.30: 'totUniqRules' (one nickname / one full name per person) can only be written with the admin key.
 * v3.31: bonus programs (totBonusCfg: managers write, seniors read), month reviews (totBonusReviews: managers and seniors), remarks and cases (totRemarks),
 *   pay statements (totMyPay: managers only). Action 'me' adds the employee's own pay statements, shown remarks, own incidents and evaluation comments.
 * v3.32: projects ('totProjects', items 'totProjItems', visual board 'totProjBoard') are sent and saved per project: owner and managers manage,
 *   assigned teams / departments / people work on it, viewers read, sub-projects follow their parent. Daily e-mail digest to the people involved
 *   (installProjectDigest() for a fixed morning time) and action 'projNotify' to send an update on demand.
 * v3.33: teams ('totTeams': managers and seniors write; a member counts for the team and its department in project access), restricted / shared
 *   project items, board rights per project, approvals (each approver writes only their own decision; the status is computed here; a workflow stage
 *   that needs approval is entered only after it is approved), comments on items, project files in Drive (actions 'pjFileUp' / 'pjFileGet').
 * v3.36: access to spaces and pages (totAccessPolicy.access, admin-only): per position and per person, each page, space or all can be Hidden, View only
 *   or Edit. Pages' data (KEY_PAGES) is sent only when a page using it is open, saved only from a page set to Edit; parts (ACC_CAPS) and department
 *   boards (tickets: dw.<dept>.board) follow the same levels. Each person receives only their own personal settings.
 * v3.38: Community ('totChannels', 'totMessages'): only managers and the admin key create, change or delete channels; a direct / group chat is read only by
 *   its members (managers included only as members); messages are written only under one's own e-mail, in channels and chats one reads, not archived; in an
 *   announcement channel only managers start posts; managers remove messages in channels; each channel keeps its newest 1500 messages. Each person also gets
 *   a staff directory (name and position) to start chats.
 * v3.39: hardening from the mass test: employee page matches records by work ID (a shared name matches nobody) and refuses terminated / retired employees; request
 *   validation; authorship of tickets, cases, announcements and comments is kept and cannot be forged; key names that are Object.prototype members are refused; a bad body
 *   always gets a JSON answer; project mail goes only to people in the access list; totIntegrations is admin-only to read; Community: server dates, replies need a post in
 *   the same channel, archived channels are read only, 60 messages per save; access requests throttled (30 / 10 min); at most MAX_KEYS keys.
 * Data lives in your Google Drive folder "Tool Data": tool-data.json (shared data) and access.json (who may use the tool).
 */
const ADMIN_SECRET = 'CHANGE-ME-ADMIN-KEY';
const SERVER_SALT = 'CHANGE-ME-SALT';
const FOLDER = 'Tool Data', DATA = 'tool-data.json', ACCESS = 'access.json';
/* Who may see the pay settings stored inside the schedule (admin always may). */
const PAY_ROLES = ['manager'];   /* v2.1: matches the tool, where only the Manager sees the Pay tab (was also senior and scheduling_coordinator) */
/* Data only these roles may read or write (admin always may). Key name without the site prefix. */
const RESTRICT = { totBonusCfg: ['manager', 'senior'], totBonusReviews: ['manager', 'senior'], totMyPay: ['manager'], totRemarks: ['manager', 'senior', 'hr_recruiter', 'shift_lead', 'performance_coach', 'service_manager', 'scheduling_coordinator'], totIncidents: ['manager', 'senior', 'service_manager', 'performance_coach'], totIncImports: ['manager', 'senior', 'service_manager', 'performance_coach'], totIncCfg: ['manager', 'senior', 'service_manager', 'performance_coach'], totRecruitment: ['manager', 'senior', 'training_coordinator', 'hr_recruiter'], totWorkbooks: ['manager', 'senior', 'training_coordinator', 'hr_recruiter'], totEmpRequests: ['manager', 'senior', 'scheduling_coordinator', 'hr_recruiter'], totGameCounts: ['manager', 'senior', 'performance_coach', 'training_coordinator', 'hr_recruiter', 'scheduling_coordinator'], totImportHistory: ['manager', 'senior', 'performance_coach', 'training_coordinator', 'hr_recruiter', 'scheduling_coordinator'], totLifecycle: ['manager', 'senior', 'hr_recruiter'], totMySchedules: ['manager', 'senior', 'scheduling_coordinator', 'shift_lead'], totTvScreens: ['manager', 'senior', 'scheduling_coordinator', 'shift_lead'] };   /* v3.40: the lobby-screen links (secret tokens) are seen only by people who edit the schedule */   /* v2.3: per-person 28-day schedules, written only by schedule editors */
/* v2.2 employee self-service: paste your Web client ID from Google Cloud (APIs & Services > Credentials > OAuth client ID > Web application). Leave as is to keep the feature off. */
const GOOGLE_CLIENT_ID = '121975980339-fu9nd124kov2g6j94qiofOrkjkhbkee6.apps.googleusercontent.com';
const ADMIN_ONLY_WRITE = ['totUniqRules', 'totAccessPolicy', 'totSites', 'wsCustomConfig', 'totEvalKinds', 'totEvalCfgBackups', 'totProcessTpl', 'totIntegrations', 'totDeptCfg', 'totAccessGrants'];   /* v3.19: evaluation setup, kinds, backups, process templates and integration settings can only be written with the admin key */
const MAX_KEYS = 1200, MAX_TRIES = 8, LOCK_SECONDS = 900, KEEP_BACKUPS = 14;

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
  var K = (readJ_(file_(DATA, '{"keys":{}}'), { keys: {} }).keys) || {}, out = { email: g.email, name: '', evaluations: [] }, found = 0, mypre = null, myWid = '', myUniq = false, inactive = false;
  Object.keys(K).forEach(function (k) {
    var tail = 'employeeDataSource'; if (k.slice(-tail.length) !== tail || !parseKey_(k) || parseKey_(k).name !== tail) return;
    var pre = k.slice(0, k.length - tail.length);
    var hit = jp_(K[k] && K[k].v, []).filter(function (e) { return e && String(e.email || (e.ext && e.ext.email) || '').trim().toLowerCase() === g.email; });
    if (hit.length !== 1) return;
    var e = hit[0], wid = String(e.workId || '').trim().toLowerCase(); found++; out.name = e.fullName || e.nickname || out.name; mypre = pre; myWid = wid;
    var nmL = String(e.fullName || e.nickname || '').trim().toLowerCase(), all0 = jp_(K[k] && K[k].v, []);
    myUniq = !!nmL && all0.filter(function (x) { return x && String(x.fullName || x.nickname || '').trim().toLowerCase() === nmL; }).length === 1;   /* v3.39: a name only identifies someone when nobody else has it */
    inactive = /^(terminated|retired)$/i.test(String(e.status || '').trim());   /* v3.39 */
    var x0 = e.ext || {}; out.profile = { name: String(e.fullName || '').slice(0, 80), nickname: String(e.nickname || '').slice(0, 40), workId: String(e.workId || '').slice(0, 30), status: String(e.status || '').slice(0, 30), position: String(x0.position || '').slice(0, 60), team: String(x0.team || '').slice(0, 40), shift: String(x0.shift || '').slice(0, 30), startDate: String(x0.startDate || '').slice(0, 20), phone: String(x0.phone || '').slice(0, 30), manager: String(x0.manager || x0.lineManager || '').slice(0, 80), email: g.email, games: String(x0.games || '').split(/[,;\/]+/).map(function (t) { return t.trim().slice(0, 40); }).filter(Boolean).slice(0, 30) };
    var share = jp_(K[pre + 'evalShare'] && K[pre + 'evalShare'].v, {}), res = jp_(K[pre + 'evalResults'] && K[pre + 'evalResults'].v, []);
    /* v3.11: the employee's own retraining rows (date, reason, status only; trainer names, comments and signatures are never sent) */
    var nm = String(e.fullName || e.nickname || '').trim().toLowerCase(), rt = jp_(K[pre + 'totRetrain'] && K[pre + 'totRetrain'].v, {});
    (rt.sessions || []).forEach(function (se) { (se.rows || []).forEach(function (row) {
      var rw = String(row.wid || '').trim().toLowerCase(); if (!row || !(rw ? (wid && rw === wid) : (myUniq && nm && String(row.name || '').trim().toLowerCase() === nm))) return;   /* v3.39: a row with a work ID belongs to that ID only */
      var at = String(row.attend || '').toLowerCase();
      (out.retraining = out.retraining || []).push({ date: String(row.date || '').slice(0, 20), reason: String(row.reason || '').slice(0, 200), status: at === 'yes' ? 'Completed' : at === 'no' ? 'Missed' : 'Scheduled' });
    }); });
    res.forEach(function (r) {
      var s = r && share[String(r.uid || r.id)]; if (!s || !s.on) return;
      if (!((wid && String(s.wid || '').trim().toLowerCase() === wid) || String(s.email || '').trim().toLowerCase() === g.email)) return;
      var sc = r.scores || {}, nt = r.notes || {}, crit = (r.criteria || []).map(function (c) { return { name: c.name, group: c.group || '', score: typeof sc[c.id] === 'number' ? sc[c.id] : null, note: String(nt[c.id] || '').slice(0, 300) }; });   /* v3.31: the evaluator's comment per criterion is shown on shared evaluations */
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
    if (rx) out.rotation = { group: String(m.group || ''), shift: String(m.shift || ''), days: rx.filter(rel).slice(0, 28).map(function (d) { return { d: d.d, s: String(d.s || ''), f: d.f == null ? null : +d.f, c: (Array.isArray(d.c) ? d.c : []).slice(0, 48).map(function (c) { return String(c || '').slice(0, 160); }) }; }) };
  });
  if (!found) return { error: 'no employee found for this email' };
  if (found > 1) return { error: 'This e-mail is on more than one employee list. Ask your manager.' };   /* v3.39: same rule as sending a request */
  if (inactive) return { error: 'This account is no longer active. Ask your manager.' };   /* v3.39: terminated and retired employees no longer see pay, evaluations or requests */
  /* v3.22: this employee's own game counts (imported from Grafana/CSV in the tool), last 12 months only; matched by work ID, or by exact full name when the row has no ID */
  var gcE = K[mypre + 'totGameCounts'], gcAll = jp_(gcE && gcE.v, []), cut = Utilities.formatDate(new Date(Date.now() - 366 * 86400000), Session.getScriptTimeZone(), 'yyyy-MM'), myNm = String(out.name || '').trim().toLowerCase();
  if (Array.isArray(gcAll)) out.gameCounts = gcAll.filter(function (r) { if (!r || String(r.period || '').slice(0, 7) < cut) return false; var rid = String(r.empId || '').trim().toLowerCase(); return rid ? (!!myWid && rid === myWid) : (myUniq && !!myNm && String(r.name || '').trim().toLowerCase() === myNm); })
    .map(function (r) { return { game: String(r.game || '').slice(0, 60), period: String(r.period || '').slice(0, 10), count: +r.count || 0 }; }).sort(function (a, b) { return b.period.localeCompare(a.period); }).slice(0, 300);
  /* v3.16: this employee's own requests (never anyone else's) */
  out.requests = reqList_(K[mypre + 'totEmpRequests'], g.email).slice(0, 40);
  /* v3.31: own pay statements (written by a manager's device; the bonus appears once the month review is final), own remarks / violations / disciplinary
     cases / positive feedback that staff chose to show, and own service incidents */
  var py = jp_(K[mypre + 'totMyPay'] && K[mypre + 'totMyPay'].v, {}), pm = (py.byEmail || {})[g.email];
  if (pm && pm.months) out.pay = Object.keys(pm.months).sort().reverse().slice(0, 6).map(function (k) { return pm.months[k]; });
  var mineRec = function (x) { var w = String(x.workId || x.empId || '').trim().toLowerCase(), n = String(x.name || '').trim().toLowerCase(); return w ? (!!myWid && w === myWid) : (myUniq && !!myNm && n === myNm); };   /* v3.39: never by name when the record has an ID, or when the name is shared */
  out.remarks = jp_(K[mypre + 'totRemarks'] && K[mypre + 'totRemarks'].v, []).filter(function (x) { return x && x.share !== false && mineRec(x); })
    .map(function (x) { return { date: String(x.date || '').slice(0, 10), kind: String(x.kind || 'note').slice(0, 20), title: String(x.title || '').slice(0, 120), text: String(x.text || '').slice(0, 2000), by: String(x.by || '').slice(0, 60) }; })
    .sort(function (a, b) { return b.date.localeCompare(a.date); }).slice(0, 60);
  out.incidents = jp_(K[mypre + 'totIncidents'] && K[mypre + 'totIncidents'].v, []).filter(function (x) { return x && mineRec(x); })
    .map(function (x) { return { date: String(x.date || '').slice(0, 10), type: String(x.type || '').slice(0, 60), game: String(x.game || '').slice(0, 40), table: String(x.table || '').slice(0, 20), severity: String(x.severity || '').slice(0, 20), summary: String(x.summary || '').slice(0, 300), action: String(x.action || '').slice(0, 300) }; })
    .sort(function (a, b) { return b.date.localeCompare(a.date); }).slice(0, 60);
  out.evaluations.sort(function (a, b) { return b.ts - a.ts; });
  if (out.retraining) out.retraining = out.retraining.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).slice(0, 30);
  return out;
}


/* ===== v3.40 lobby screens ("📺 Screens" in FMD → Schedule). A TV in the lobby has no sign-in: it opens a link that holds a long secret token.
   tv_ answers with ONLY the rotation of that screen's scope (names, tables / zones, times): no e-mail, no pay, nothing else. ===== */
function tvName_(n, mode) { n = String(n || '').trim().replace(/\s+/g, ' '); if (mode === 'full' || !n) return n; var p = n.split(' '); if (mode === 'first') return p[0]; return p.length > 1 ? p[0] + ' ' + p[p.length - 1].charAt(0) + '.' : n; }
function tvFind_(K, token) {
  token = String(token || ''); if (!/^[A-Za-z0-9_-]{24,80}$/.test(token)) return null; var tail = 'totTvScreens', hit = null;
  Object.keys(K).forEach(function (k) {
    if (hit || k.slice(-tail.length) !== tail) return; var q = parseKey_(k); if (!q || q.name !== tail) return;
    var a = jp_(K[k] && K[k].v, []); if (!Array.isArray(a)) return;
    a.forEach(function (s) { if (!hit && s && s.on !== false && typeof s.token === 'string' && s.token.length === token.length && s.token === token) hit = { s: s, pre: k.slice(0, k.length - tail.length), site: q.site }; });
  }); return hit;
}
function tvDay_(ds, off) { var d = new Date(ds + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + off); return d.toISOString().slice(0, 10); }
function tv_(b) {
  var K = (readJ_(file_(DATA, '{"keys":{}}'), { keys: {} }).keys) || {}, hit = tvFind_(K, b && b.token); if (!hit) return { error: 'not found' };
  var s = hit.s, ds = /^\d{4}-\d{2}-\d{2}$/.test(String(b.d || '')) ? String(b.d) : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'), hr = isFinite(+b.h) && +b.h >= 0 && +b.h < 24 ? +b.h : (+Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH') + +Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'mm') / 60);
  var S = jp_(K[hit.pre + 'totSchedule'] && K[hit.pre + 'totSchedule'].v, {}), days = (S && S.days) || {}, cfg = (S && S.cfg) || {}, DEF = { morning: 8, afternoon: 16, night: 0 }, order = ['morning', 'afternoon', 'night'];
  var win = function (sh, sk) { var rows = (sh && sh.rows) || [], L = 0; rows.forEach(function (r) { L = Math.max(L, +r.len || 0); }); L = L || (+((cfg.lens || {})[sk]) > 0 ? +cfg.lens[sk] : (+cfg.len > 0 ? +cfg.len : 8)); var st = sh && sh.start != null ? +sh.start : (cfg.starts && cfg.starts[sk] != null ? +cfg.starts[sk] : DEF[sk]); return { s: st, L: L }; };
  var pick = null, want = String(s.shift || 'auto');
  if (order.indexOf(want) >= 0) { var d0 = days[ds] && days[ds].shifts && days[ds].shifts[want]; if (d0) pick = { d: ds, k: want, sh: d0 }; }
  else {
    var cands = [[ds, hr], [tvDay_(ds, -1), hr + 24]];
    cands.forEach(function (c) { if (pick) return; var dd = days[c[0]]; if (!dd || !dd.shifts) return; order.forEach(function (k) { if (pick || !dd.shifts[k]) return; var w = win(dd.shifts[k], k), el = c[1] - w.s; if (el >= 0 && el < w.L) pick = { d: c[0], k: k, sh: dd.shifts[k] }; }); });
    if (!pick) { var best = null; order.forEach(function (k) { var dd = days[ds], sh = dd && dd.shifts && dd.shifts[k]; if (!sh) return; var w = win(sh, k); if (w.s > hr && (!best || w.s < best.w.s)) best = { d: ds, k: k, sh: sh, w: w }; }); pick = best; }
    if (!pick) { var last = null; order.forEach(function (k) { var dd = days[ds], sh = dd && dd.shifts && dd.shifts[k]; if (!sh) return; var w = win(sh, k); if (!last || w.s > last.w.s) last = { d: ds, k: k, sh: sh, w: w }; }); pick = last; }
  }
  var teams = (S.teams || []).map(function (t) { return { id: String(t.id), name: String(t.name || '').slice(0, 40) }; }), tf = Array.isArray(s.teams) ? s.teams.map(String) : [], pf = Array.isArray(s.pos) ? s.pos.map(String) : [];
  var posOf = {}; ((S.roster && S.roster.people) || []).forEach(function (p) { if (p && p.name) posOf[String(p.name).trim().toLowerCase()] = String(p.pos || ''); });
  var out = { ok: true, screen: { name: String(s.name || '').slice(0, 60), title: String(s.title || '').slice(0, 80), view: s.view === 'full' ? 'full' : 'now', zoom: Math.max(0.5, Math.min(3, +s.zoom || 1)), names: s.names === 'full' || s.names === 'first' ? s.names : 'short', zinfo: s.zinfo === 'cell' || s.zinfo === 'both' ? s.zinfo : 'legend', ahead: Math.max(1, Math.min(12, +s.ahead || 4)), rowsPer: Math.max(0, Math.min(40, +s.rowsPer || 0)), u: +s.u || 0 }, now: { d: ds, h: hr }, teams: [], rows: [], zones: {}, updated: +(K[hit.pre + 'totSchedule'] && K[hit.pre + 'totSchedule'].t) || 0 };
  if (!pick) { out.empty = true; return out; }
  var w2 = win(pick.sh, pick.k); out.date = pick.d; out.shift = pick.k; out.start = w2.s; out.len = w2.L;
  var zc = (cfg.zoneTeams || {}), seenT = {};
  (pick.sh.rows || []).forEach(function (r) {
    if (!r || !String(r.name || '').trim()) return; var tid = String(r.t || ''); if (tf.length && tf.indexOf(tid) < 0) return;
    var pid = posOf[String(r.name).trim().toLowerCase()] || ''; if (pf.length && pf.indexOf(pid) < 0) return;
    var n = Math.max(1, Math.min(48, Math.round((+r.len || w2.L) * 2))), c = []; for (var i = 0; i < n; i++) c.push(String((r.cells || [])[i] || '').trim().slice(0, 24));
    out.rows.push({ n: tvName_(r.name, out.screen.names), t: tid, p: pid, f: Math.max(0, +r.from || 0), c: c }); seenT[tid] = 1;
    if (zc[tid] && zc[tid].on && !out.zones[tid]) { var zl = (pick.sh.zones && pick.sh.zones[tid]) || ((cfg.zones || {})[pick.k] || {})[tid] || []; out.zones[tid] = zl.map(function (z) { return { n: String(z.n).slice(0, 12), t: (z.t || []).slice(0, 60).map(function (x) { return +x || 0; }) }; }); }
  });
  out.teams = teams.filter(function (t) { return seenT[t.id]; }); if (seenT['']) out.teams.push({ id: '', name: 'No team' });
  return out;
}

/* ===== v3.16 employee requests ===== */
const REQ_TYPES = { swap: 'Swap a shift', giveaway: 'Give away a shift', annual: 'Annual leave', sick: 'Sick leave', dayoff: 'Day off', payq: 'Question about my pay' };   /* v3.31: day off, pay question */
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
function isoOk_(v) { v = String(v || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false; var d = new Date(v + 'T12:00:00Z'); return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v; }   /* v3.39: 2027-02-30 is not a date */
function dayDiff_(a, b) { return Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000); }
function reqNew_(b) {
  var g = verifyGoogle_(String(b.idToken || '')); if (!g) return { error: 'sign-in invalid' };
  var df = file_(DATA, '{"keys":{}}'), cur = readJ_(df, { keys: {} }); cur.keys = cur.keys || {};
  var ep = empOf_(cur.keys, g.email); if (!ep) return { error: 'no employee found for this email' };
  if (/^(terminated|retired)$/i.test(String(ep.e.status || '').trim())) return { error: 'This account is no longer active. Ask your manager.' };
  var type = String(b.type || ''); if (!Object.prototype.hasOwnProperty.call(REQ_TYPES, type)) return { error: 'bad type' };   /* v3.39: not 'constructor' or 'toString' */
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'), from = String(b.from || ''), to = String(b.to || from);
  if (!isoOk_(from) || !isoOk_(to)) return { error: 'Enter valid dates.' };
  if (dayDiff_(from, to) < 0) return { error: 'The end date is before the start date.' };
  if (dayDiff_(from, to) > 60) return { error: 'A request can cover at most 60 days.' };
  if (dayDiff_(today, from) < (type === 'sick' ? -14 : 0) || dayDiff_(today, from) > (type === 'sick' ? 1 : 400)) return { error: type === 'sick' ? 'Sick leave can be reported from 14 days back up to tomorrow.' : 'Choose a date from today onward (within the next 13 months).' };   /* v3.39: sick leave is not booked months ahead */
  var shift = String(b.shift || '').replace(/[^\w \-:]/g, '').slice(0, 30), withName = type === 'swap' ? Array.from(String(b.withName || '').trim()).slice(0, 80).join('') : '';   /* v3.39: the tool escapes every field, so text is kept as typed */
  if (type === 'swap' && withName.length < 2) return { error: 'Pick the colleague you swap with.' };
  if (type === 'payq' && !String(b.note || '').trim()) return { error: 'Write your question.' };
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
  var note = Array.from(String(b.note || '').trim()).slice(0, 500).join(''), key = ep.pre + 'totEmpRequests', old = cur.keys[key], arr = jp_(old && old.v, []); if (!Array.isArray(arr)) arr = [];
  var mineOpen = arr.filter(function (r) { return r && String(r.email || '').toLowerCase() === g.email && r.status === 'pending'; });
  if (mineOpen.length >= 10) return { error: 'You already have 10 open requests. Wait for a decision or cancel one.' };
  if (mineOpen.some(function (r) { return r.type === type && r.from === from && r.to === to && (type === 'payq' ? String(r.note || '') === note : type !== 'swap' || String(r.with || '').toLowerCase() === withName.toLowerCase()); })) return { error: 'You already sent this request.' };
  if ((type === 'swap' || type === 'giveaway') && mineOpen.some(function (r) { return (r.type === 'swap' || r.type === 'giveaway') && r.from === from; })) return { error: 'You already have an open swap or give-away for that shift. Cancel it first.' };   /* v3.39 */
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
  if (m) return m[2] in Object.prototype ? null : { site: m[1], name: m[2] };   /* v3.39: not 'constructor', '__proto__', 'toString' … (they broke the rule tables and poisoned every pull) */
  return /^[A-Za-z0-9_.:-]{1,60}$/.test(k) && !(k in Object.prototype) ? { site: 'main', name: k } : null;
}
function policy_(cur) { try { var e = cur.keys.totAccessPolicy; var p = e && JSON.parse(e.v); return p && typeof p === 'object' ? p : { users: {}, roles: {} }; } catch (x) { return { users: {}, roles: {} }; } }
function whoIs_(cur, em) { var p = policy_(cur), u = (p.users || {})[em]; if (!u || !u.role) return { role: '', sites: [] };   /* v2.1: an approved account with no role yet receives no site data */
  return { role: String(u.role), sites: Array.isArray(u.sites) ? u.sites.map(String) : ['main'] }; }
/* v3.21 ADMIN-ONLY MODE: every screen except Home is locked for non-admins until the admin grants it (tool: Permissions page, key totAccessGrants).
   Switch: totAccessGrants.on === false turns it off; otherwise it is on. Keys not listed here (audit log, employee list, policy, ...) are not gated. */
const GATE_VIEW = { totBonusCfg: 'dept', totBonusReviews: 'dept', totRemarks: 'dept', totIncidents: 'dept', totIncImports: 'dept', totIncCfg: 'dept', evalResults: 'exam', traineeNotes: 'exam', coachingActions: 'exam', evalShare: 'exam', evalVideos: 'exam', evalPhotos: 'exam', totWorkshopFiles: 'exam', totRetrain: 'exam', wsCustomConfig: 'exam', totEvalKinds: 'exam',
  totOnboardingHier: 'onboarding', totOnboardingV2: 'onboarding', totOnboardingFiles: 'onboarding', totSchedule: 'schedule', totMySchedules: 'schedule', totAppearance: 'appearance', totAppearanceDept: 'appearance',
  totTasks: 'tasks', totCases: 'tasks', totComments: 'tasks', totAnnouncements: 'tasks', totRecruitment: 'recruiting', totWorkbooks: 'recruiting', totEmpRequests: 'requests',
  totGameCounts: 'dept', totImportHistory: 'dept', totLifecycle: 'dept', totDeptDocs: 'dept', totDeptCfg: 'dept', idPrintHistory: 'id', logbookDescriptions: 'logbooks', logbookCustomGames: 'logbooks', logbookSettings: 'logbooks' };
function grants_(cur) { try { var e = cur.keys.totAccessGrants, g = e && JSON.parse(e.v); return g && typeof g === 'object' ? g : {}; } catch (x) { return {}; } }
function gateOk_(cur, em, name) { var v = GATE_VIEW[name]; if (!v) return true; var g = grants_(cur); if (g.on === false) return true; var u = g.byEmail && g.byEmail[em], x = u && u.views && u.views[v]; return !!(x && (!x.until || +x.until > Date.now())); }
function redactGrants_(e, em) { try { var g = JSON.parse(e.v), o = {}; if (g.byEmail && g.byEmail[em]) o[em] = g.byEmail[em]; return { v: JSON.stringify({ v: g.v || 1, on: g.on, u: g.u || 0, byEmail: o }), t: e.t }; } catch (x) { return { v: JSON.stringify({ byEmail: {} }), t: e.t }; } }
function mineAsks_(e, em) { try { var a = JSON.parse(e.v); return { v: JSON.stringify((Array.isArray(a) ? a : []).filter(function (r) { return r && r.email === em; })), t: e.t }; } catch (x) { return { v: '[]', t: e.t }; } }
function mergeAsks_(newV, oldV, em) { var n = [], o = []; try { n = JSON.parse(newV); } catch (x) {} try { o = oldV ? JSON.parse(oldV) : []; } catch (x) {} n = (Array.isArray(n) ? n : []).filter(function (r) { return r && r.email === em; }).slice(-200); o = (Array.isArray(o) ? o : []).filter(function (r) { return r && r.email !== em; }); return JSON.stringify(o.concat(n)); }
/* v3.29 Service Management: incidents are also open to any position the admin maps to the Service Management department; performance coaches
   read them (to coach), but only service managers, managers and seniors (and the department) write them */
const RESTRICT_DEPT = { totIncidents: ['service'], totIncImports: ['service'], totIncCfg: ['service'] };
const WRITE_ROLES = { totTvScreens: ['manager', 'senior', 'scheduling_coordinator', 'shift_lead'], totTeams: ['manager', 'senior'], totBonusCfg: ['manager'],  totIncidents: ['manager', 'senior', 'service_manager'], totIncImports: ['manager', 'senior', 'service_manager'], totIncCfg: ['manager', 'senior', 'service_manager'] };
function roleOk_(name, role, dept) { var r = RESTRICT[name]; if (!r || r.indexOf(role) >= 0) return true; var d = RESTRICT_DEPT[name]; return !!(d && dept && d.indexOf(dept) >= 0); }
function writeOk_(name, role, dept) { var r = WRITE_ROLES[name]; if (!r || r.indexOf(role) >= 0) return true; var d = RESTRICT_DEPT[name]; return !!(d && dept && d.indexOf(dept) >= 0); }
/* v2.4: detailed access. The admin ticks parts per position in the tool (Admin > Detailed access); the policy keeps policy.roles[role].caps.
   If a position has no ticks yet, its old "spaces" list decides (same defaults as the tool). */
const CAP_VIEW = { onboarding: 'onboarding', ws_register: 'exam', ws_checklist: 'exam', exam_check: 'exam', results_view: 'exam', results_edit: 'exam', results_send: 'exam', videos_upload: 'exam', id: 'id', logbooks: 'logbooks', fmd_view: 'schedule', appearance_view: 'appearance', appearance_issue: 'appearance', appearance_manage: 'appearance' };
const DEFAULT_VIEWS = { shift_lead: ['exam', 'id', 'schedule'], performance_coach: ['exam', 'schedule'], scheduling_coordinator: ['schedule'], service_manager: ['schedule'] };
/* data keys that need a part of the tool: who may read them and who may write them */
const KEY_CAPS = { totWorkshopFiles: { read: ['ws_register'], write: ['ws_register'] }, totOnboardingFiles: { read: ['onboarding'], write: ['onboarding'] },
  evalResults: { read: ['results_view', 'exam_check', 'ws_checklist'], write: ['exam_check', 'ws_checklist', 'results_edit'] }, evalShare: { read: ['results_send', 'results_view'], write: ['results_send'] },
  evalVideos: { read: ['videos_view', 'videos_upload'], write: ['videos_upload'] },
  evalPhotos: { read: ['results_view', 'exam_check', 'ws_checklist', 'videos_view', 'videos_upload'], write: ['exam_check', 'ws_checklist', 'results_edit', 'videos_upload'] },   /* v3.28: photos attached while evaluating */
  totAppearanceDept: { read: ['appearance_view', 'appearance_issue', 'appearance_manage'], write: ['appearance_issue', 'appearance_manage'] } };   /* v2.5: uniforms inventory and transactions */
function capsFor_(cur, role) { var p = policy_(cur), r = (p.roles || {})[role], c = r && r.caps; if (c && typeof c === 'object') return c;
  var views = r && Array.isArray(r.views) ? r.views : (DEFAULT_VIEWS[role] || ['onboarding', 'exam', 'id', 'logbooks', 'schedule', 'appearance']), o = {}; Object.keys(CAP_VIEW).forEach(function (k) { o[k] = views.indexOf(CAP_VIEW[k]) >= 0; }); o.videos_view = role === 'manager'; return o; }
/* v3.36 ACCESS TO SPACES AND PAGES (policy.access, set in the tool: Admin → 🔐 Access to spaces and pages). Same rules as the tool:
   level per page id, space ('@<space>') or all ('*'), for a person (users[e-mail]) before their position (roles[role]); 'def' or nothing = the old rules. */
const ACC_LV = { none: 1, view: 1, edit: 1 }, DEPT_SPACE = { appearance: 'uniforms', access: 'office', it: 'office' };
function accA_(cur) { var A = policy_(cur).access; return A && typeof A === 'object' ? A : null; }
function accSp_(pid) { var a = String(pid).split('.'); return a[0] === 'dw' ? (DEPT_SPACE[a[1]] || a[1]) : a[0]; }
function accPick_(m, pid, sp) { if (!m || typeof m !== 'object') return ''; return m[pid] || m['@' + sp] || m['*'] || ''; }
function accLvl_(A, em, role, pid) { if (!A) return ''; var sp = accSp_(pid), v = accPick_(em && A.users && A.users[em], pid, sp) || accPick_(role && A.roles && A.roles[role], pid, sp); return ACC_LV[v] ? v : ''; }
/* parts of the tool (KEY_CAPS, videos) follow the page levels: c = pages that use the part, e = pages where it changes data (Edit only) */
const ACC_CAPS = { onboarding: { c: ['academy.onboarding', 'academy.trainee_progress'] }, ws_register: { c: ['academy.workshop'] }, ws_checklist: { c: ['academy.workshop', 'performance.workshop_evaluation'] },
  id: { c: ['academy.id_creation'] }, logbooks: { c: ['academy.logbooks'] }, retrain: { c: ['academy.retraining', 'performance.retraining', 'fmd.retraining'] },
  results_view: { c: ['academy.retakes_notes', 'academy.who_needs_what', 'performance.results', 'performance.send_results', 'performance.coaching_hub', 'performance.who_needs_what'] },
  exam_check: { c: ['performance.exam_evaluation'] }, results_edit: { e: ['performance.results'] }, results_send: { e: ['performance.send_results'] },
  videos_view: { c: ['performance.videos'] }, videos_upload: { e: ['performance.videos'] }, fmd_view: { c: ['fmd.schedule'] },
  appearance_view: { c: ['uniforms.uniforms'] }, appearance_issue: { e: ['uniforms.uniforms'] }, appearance_manage: { e: ['uniforms.uniforms'] } };
function accCaps_(A, em, role, caps) { if (!A) return caps; var o = {}; Object.keys(caps || {}).forEach(function (k) { o[k] = caps[k]; });
  Object.keys(ACC_CAPS).forEach(function (k) { var r = ACC_CAPS[k], und = false, g = (r.c || []).concat(r.e || []).some(function (p) { var L = accLvl_(A, em, role, p), inE = (r.e || []).indexOf(p) >= 0; if (!L) { und = true; return false; } return inE ? L === 'edit' : L !== 'none'; });
    o[k] = g || (und && !!o[k]); });
  return o; }
/* data that belongs to certain pages only: readable when one of them is View only or Edit, writable when one is Edit, refused when all are Hidden, else the old rules */
const PJ_PAGES = ['projects.my_work', 'projects.all_projects', 'projects.progress', 'projects.teams_departments', 'projects.data_explorer', 'projects.updates'], INC_PAGES = ['dw.service.inc', 'dw.service.jira', 'dw.service.rep'];
const KEY_PAGES = { totIncidents: INC_PAGES, totIncImports: INC_PAGES, totIncCfg: INC_PAGES, totRecruitment: ['hr.recruiting', 'dw.hr.cand'], totWorkbooks: ['hr.recruiting', 'dw.hr.cand'], totLifecycle: ['dw.hr.life'],
  totEmpRequests: ['fmd.employee_requests'], totBonusCfg: ['dw.fmd.bonus'], totBonusReviews: ['dw.fmd.bonus'], totGameCounts: ['dw.fmd.games'], totImportHistory: ['dw.fmd.games'],
  totSchedule: ['fmd.schedule'], totMySchedules: ['fmd.schedule'], totProjects: PJ_PAGES, totProjItems: PJ_PAGES, totProjBoard: PJ_PAGES,
  totOnboardingHier: ['academy.onboarding', 'academy.trainee_progress'], totOnboardingV2: ['academy.onboarding', 'academy.trainee_progress'], totRetrain: ['academy.retraining', 'performance.retraining', 'fmd.retraining'],
  totChannels: ['community.channels', 'community.chats'], totMessages: ['community.channels', 'community.chats'],
  idPrintHistory: ['academy.id_creation'], logbookDescriptions: ['academy.logbooks'], logbookCustomGames: ['academy.logbooks'], logbookSettings: ['academy.logbooks'] };
/* one check for reading or writing a key: page levels first, then the position rules (roleOk_, writeOk_, capOk_) and the admin-only mode (gateOk_) */
function keyOk_(cur, em, me, cx, name, mode) {
  var legacy = function () { return roleOk_(name, me.role, cx.dept) && (mode !== 'write' || writeOk_(name, me.role, cx.dept)) && capOk_(name, me, mode); };
  var ps = KEY_PAGES[name], A = me.acc;
  if (ps && A) { var ls = ps.map(function (p) { return accLvl_(A, em, me.role, p); });
    if (ls.some(function (v) { return mode === 'write' ? v === 'edit' : (v === 'view' || v === 'edit'); })) return gateOk_(cur, em, name);
    if (!ls.some(function (v) { return !v; })) return false; }
  return legacy() && gateOk_(cur, em, name); }
function capOk_(name, me, mode) { var r = KEY_CAPS[name]; if (!r) return true; return r[mode].some(function (k) { return !!(me.caps && me.caps[k]); }); }
/* v3.24: a non-admin receives their own full entry plus a directory of colleagues for "Assign to…", with only { name, role } each:
   everyone in their own department, or everyone for managers, seniors and Management (c is ctx_, so the department rules match the ticket rules) */
function redactPolicy_(e, em, c) { try { var p = JSON.parse(e.v), all = p.users || {}, u = {};
  Object.keys(all).forEach(function (k) { var x = all[k]; if (!x || typeof x !== 'object') return; if (k === em) { u[k] = x; return; }
    if (c && (c.all || (c.dept && c.dOf(x.role) === c.dept))) u[k] = { name: String(x.name || ''), role: String(x.role || '') }; });
  var cd = {}; Object.keys(all).forEach(function (k) { var x = all[k]; if (x && typeof x === 'object' && x.role) cd[k] = { name: String(x.name || ''), role: String(x.role || '') }; });   /* v3.38 Community: staff directory for direct chats */
  var A = p.access && typeof p.access === 'object' ? p.access : null, ac = A ? { roles: A.roles || {}, users: {} } : undefined; if (A && A.users && A.users[em]) ac.users[em] = A.users[em];   /* v3.36 */
  return { v: JSON.stringify({ roles: p.roles || {}, depts: p.depts || {}, users: u, upd: p.upd || 0, access: ac, chatDir: cd }), t: e.t }; } catch (x) { return { v: JSON.stringify({ roles: {}, users: {}, upd: 0 }), t: e.t }; } }
function stripPay_(e) { try { var o = JSON.parse(e.v); if (o && typeof o === 'object' && !Array.isArray(o) && 'pay' in o) { delete o.pay; return { v: JSON.stringify(o), t: e.t }; } } catch (x) {} return e; }
function keepPay_(newV, oldV) { try { var n = JSON.parse(newV); if (!n || typeof n !== 'object' || Array.isArray(n)) return newV; var o = oldV ? JSON.parse(oldV) : null; if (o && o.pay !== undefined) n.pay = o.pay; else delete n.pay; return JSON.stringify(n); } catch (x) { return newV; } }

/* ===== v3.23 record-level privacy: tickets (totTasks), cases (totCases), comments (totComments), announcements (totAnnouncements), audit log ===== */
/* Same department list and default position -> department mapping as the tool (Admin can change the mapping; it is stored in policy.depts). */
/* v3.25: 'management' is no longer a department (manager and senior are positions that see everything, see c.all) */
const DEPT_IDS = ['academy', 'performance', 'fmd', 'appearance', 'hr', 'access', 'it', 'service'];
const DEPT_DEF = { training_coordinator: 'academy', performance_coach: 'performance', shift_lead: 'performance', scheduling_coordinator: 'fmd', hr_recruiter: 'hr', service_manager: 'service' };
const SCOPED = ['totTasks', 'totCases', 'totAnnouncements', 'totProjects', 'totProjItems', 'totProjBoard', 'totChannels', 'totMessages', 'totComments'];   /* v3.38: channels before their messages */   /* comments last: their visibility depends on the tickets, announcements and projects; projects before their items and board */
const DEL_KEEP_DAYS = 180, AUDIT_MAX = 20000, JOURNAL_MAX = 8000;
function low_(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
/* who is asking: the admin key sees everything; everybody else is described by their position and department */
function ctx_(cur, em, admin) {
  var cache = {}, c = { all: !!admin, adm: !!admin, em: em, name: '', dept: '', cache: cache };
  c.idx = function (pre, name) { var k = pre + name; if (!cache[k]) { var o = {}, a = jp_(cur.keys[k] && cur.keys[k].v, []); (Array.isArray(a) ? a : []).forEach(function (x) { if (x && x.id != null) o[String(x.id)] = x; }); Object.defineProperty(o, '__pre', { value: pre }); cache[k] = o; } return cache[k]; };
  /* v3.33: the teams this person belongs to (member or lead) and the departments of those teams, per site */
  c.tm = function (pre) { var k = pre + 'totTeams#me'; if (!cache[k]) { var o = { t: {}, d: {} }, a = jp_(cur.keys[pre + 'totTeams'] && cur.keys[pre + 'totTeams'].v, []);
    (Array.isArray(a) ? a : []).forEach(function (t) { if (!t || t.id == null || !em) return; if ((Array.isArray(t.members) ? t.members : []).map(low_).indexOf(em) >= 0 || low_(t.lead) === em) { o.t[String(t.id)] = 1; if (t.dept) o.d[String(t.dept)] = 1; } }); cache[k] = o; } return cache[k]; };
  c.dels = function (k) { return (cur.del || {})[k] || {}; };   /* v3.32: ids deleted from a key (projects removed with their items) */
  if (admin) return c;
  var p = policy_(cur), u = (p.users || {})[em] || {}, depts = p.depts || {}, role = String(u.role || '');
  c.dOf = function (x) { x = String(x || ''); return DEPT_IDS.indexOf(x) >= 0 ? x : (depts[x] || DEPT_DEF[x] || x); };
  c.name = low_(u.name); c.dept = c.dOf(role); c.role = role;
  var A = p.access && typeof p.access === 'object' ? p.access : null;   /* v3.36: department boards opened (View only / Edit) or Hidden for this person or position */
  c.bl = function (d) { var k = 'bl:' + d; if (!(k in cache)) cache[k] = accLvl_(A, em, role, 'dw.' + d + '.board'); return cache[k]; };
  /* same people the tool lets open "All tasks" and every department (__dept.wide()). The last clause is legacy compatibility only: before v3.25 the admin
     could map a position to the Management department in policy.depts, and such a position keeps seeing everything. */
  c.all = role === 'manager' || role === 'senior' || c.dept === 'management';
  return c;
}
/* a ticket is visible to: its sender, its assignee, the department it is addressed to, the department that sent it, and (for case tickets) HR */
function taskVis_(t, c) {
  if (c.all) return true; if (!t) return false;
  var fe = low_(t.fromEmail), te = low_(t.toEmail);
  if (fe ? fe === c.em : (c.name && low_(t.fromName) === c.name)) return true;
  if (te ? te === c.em : (c.name && !!t.toName && low_(t.toName) === c.name)) return true;
  var td = c.dOf(t.toRole), bl = c.bl ? c.bl(td) : '';
  if (bl === 'view' || bl === 'edit') return true;   /* v3.36: a board opened to this person */
  if (c.dept && (c.bl ? c.bl(c.dept) : '') !== 'none' && (td === c.dept || c.dOf(t.fromRole) === c.dept)) return true;   /* their own board, unless Hidden */
  return !!t.caseId && c.dept === 'hr';
}
/* v3.36: a ticket on a board this person may only view (View only) cannot be changed by them, unless they sent it or it is assigned to them */
function taskEd_(t, c) { if (c.all || !c.bl || !t) return true; var fe = low_(t.fromEmail), te = low_(t.toEmail); if ((fe && fe === c.em) || (te && te === c.em)) return true; return c.bl(c.dOf(t.toRole)) !== 'view'; }
/* a case record is visible to HR, to people who see everything, to its creator, and (v3.25) for READING to anyone who can see one of the tickets the case
   itself created (ref 'case:' or 'wt:', sent by the case creator), so Uniforms / Building access / IT see the case title of their linked ticket. A ticket a
   person makes up with someone else's caseId does not count. Saving a case still needs HR, full access or being its creator (scopedPush_ passes pre=null).
   The case-id index is cached per request with the tickets (see push). */
function caseVis_(x, c, pre) {
  if (c.all || c.dept === 'hr') return true; if (!x) return false; if (low_(x.byEmail) === c.em) return true;
  if (pre == null || x.id == null || !c.idx) return false;
  var k = pre + 'totTasks#case';
  if (!c.cache[k]) { var o = {}, t = c.idx(pre, 'totTasks'); Object.keys(t).forEach(function (i) { var y = t[i]; if (!y || y.caseId == null || !/^(case|wt):/.test(String(y.ref || '')) || !taskVis_(y, c)) return; var m = o[String(y.caseId)] = o[String(y.caseId)] || {}; m[low_(y.fromEmail)] = 1; }); c.cache[k] = o; }
  var m = c.cache[k][String(x.id)]; return !!(m && x.byEmail && m[low_(x.byEmail)]);
}
function annVis_(a, c) { if (c.all) return true; if (!a) return false; if (low_(a.fromEmail) === c.em) return true; var to = Array.isArray(a.toRoles) ? a.toRoles : []; return !to.length || to.some(function (x) { return c.dOf(x) === c.dept; }); }
function cmVis_(x, c, pre) {
  if (c.all) return true; if (!x) return false; if (low_(x.email) === c.em) return true;
  if (x.kind === 'task') return taskVis_(c.idx(pre, 'totTasks')[String(x.ref)], c);
  if (x.kind === 'ann' || x.kind === 'ack') return annVis_(c.idx(pre, 'totAnnouncements')[String(x.ref)], c);
  if (x.kind === 'proj') return pjLevel_(c.idx(pre, 'totProjects')[String(x.ref)], c, c.idx(pre, 'totProjects'), 0) >= 1;   /* v3.32 project discussion: everyone who can open the project */
  if (x.kind === 'pitem') return pjRecLevel_('totProjItems', c.idx(pre, 'totProjItems')[String(x.ref)], c, c.idx(pre, 'totProjects')) >= 1;   /* v3.33 comments on one item: whoever can open that item */
  return false;   /* unknown kinds stay private to their author */
}
function recVis_(name, x, c, pre) { if (name === 'totChannels') return chVis_(x, c); if (name === 'totMessages') return msgVis_(x, c, pre); if (PROJ_KEYS.indexOf(name) >= 0) return pjRecLevel_(name, x, c, c.idx(pre, 'totProjects')) >= 1; return name === 'totTasks' ? taskVis_(x, c) : name === 'totCases' ? caseVis_(x, c, pre) : name === 'totAnnouncements' ? annVis_(x, c) : cmVis_(x, c, pre); }
/* who may delete a record: the person who created it, or someone who sees everything (same rule as the tool's delete buttons) */
function recOwner_(name, x, c) { if (c.all) return true; var e = name === 'totComments' ? x.email : name === 'totCases' ? x.byEmail : x.fromEmail, n = name === 'totComments' ? x.who : name === 'totCases' ? x.by : x.fromName;
  return e ? low_(e) === c.em : (!!c.name && low_(n) === c.name); }   /* records saved before e-mails were stored: the name from the access list */
function scopedPull_(name, v, c, pre) { var all = name === 'totChannels' || name === 'totMessages' ? c.adm : c.all;   /* v3.38: managers do not read other people's direct chats */
  var a = jp_(v, null); if (!Array.isArray(a)) return all ? v : '[]'; return all ? v : JSON.stringify(a.filter(function (x) { return x && recVis_(name, x, c, pre); })); }
/* merge a save record by record: records this person cannot see are kept untouched; a visible record missing from the save counts as deleted only if
   this person may delete it; new records are accepted only if this person can see them; deleted ids are remembered so they never come back */
const REC_AUTHOR = { totTasks: ['fromEmail', 'fromName', 'fromRole'], totCases: ['byEmail', 'by'], totAnnouncements: ['fromEmail', 'fromName', 'fromRole'], totComments: ['email', 'who'] };
function scopedPush_(name, newV, oldV, c, pre, del) {
  if (name === 'totChannels' || name === 'totMessages') return chatPush_(name, newV, oldV, c, pre, del);   /* v3.38 */
  if (PROJ_KEYS.indexOf(name) >= 0) return projPush_(name, newV, oldV, c, pre, del);   /* v3.32 */
  var n = jp_(newV, null), o = jp_(oldV, []), now = Date.now(); if (!Array.isArray(n)) return null; if (!Array.isArray(o)) o = [];
  var inN = {}, seen = {}, out = [], vis = function (x) { return recVis_(name, x, c, name === 'totCases' ? null : pre) && (name !== 'totTasks' || taskEd_(x, c)); };   /* v3.25: linked-ticket case visibility is read-only; v3.36: View-only boards */
  n.forEach(function (x) { if (x && x.id != null) inN[String(x.id)] = x; });
  var AU = REC_AUTHOR[name] || [];
  o.forEach(function (x) { var id = x && x.id != null ? String(x.id) : null; if (id == null) { out.push(x); return; } seen[id] = 1;
    if (!vis(x)) { out.push(x); return; }
    if (inN[id] !== undefined) { var y = inN[id];
      if (!c.all && y && typeof y === 'object' && x && typeof x === 'object') {   /* v3.39: the author never changes; announcements and comments are changed by their author only */
        if ((name === 'totAnnouncements' || name === 'totComments') && !recOwner_(name, x, c)) { out.push(x); return; }
        AU.forEach(function (f) { if (x[f] === undefined) delete y[f]; else y[f] = x[f]; }); }
      out.push(y); return; }
    if (recOwner_(name, x, c)) { del[id] = now; return; }
    out.push(x); });
  n.forEach(function (x) { var id = x && x.id != null ? String(x.id) : null; if (id == null || seen[id] || del[id]) return; seen[id] = 1;
    if (x && typeof x === 'object' && !c.all && AU.length && x[AU[0]] && low_(x[AU[0]]) !== c.em) return;   /* v3.39: a new record is written under the sender's own e-mail, never under someone else's */
    if (vis(x)) out.push(x); });
  return JSON.stringify(out);
}
/* ===== v3.38 COMMUNITY: channels and direct chats for staff (people with a position in the tool; never the employee page).
   totChannels: { id, kind: 'ch' | 'dm', name, aud: { all, depts[], people[] } (channels), members[] (direct / group chats), mode 'open' | 'announce', byEmail, archived }
   totMessages: { id, ch, kind: 'msg' | 'react', email, by, ts, text, parent (thread), ann (announcement), ref + emoji (reaction), del (removed) }
   - Only managers (the position) and the admin key create, change or delete channels. Seniors and everyone else cannot.
   - A direct or group chat is created by one of its members; its members never change afterwards. Nobody else reads it, managers included.
   - A channel is read by its audience (everyone, chosen departments, chosen people), its creator and managers.
   - Messages: written only under one's own e-mail, only in channels and chats one can read and that are not archived; in an announcement channel only
     managers start new posts (anyone in it may reply and react). One's own messages can be edited or removed; managers may remove any message in a channel
     (not in direct chats). Reactions are records of their own, added and removed only by their owner. ===== */
/* each channel or chat keeps its newest CHAT_KEEP messages (and their replies' reactions); older ones are dropped so the shared file stays small */
const CHAT_KEEP = 1500, CHAT_BURST = 60;
function chatTrim_(a) { var by = {}; a.forEach(function (x) { if (x && x.kind !== 'react' && x.ch != null) (by[x.ch] = by[x.ch] || []).push(x); }); var drop = {};
  Object.keys(by).forEach(function (k) { var l = by[k]; if (l.length <= CHAT_KEEP) return; l.sort(function (p, q) { return (+p.ts || 0) - (+q.ts || 0); }).slice(0, l.length - CHAT_KEEP).forEach(function (x) { drop[String(x.id)] = 1; }); });
  if (!Object.keys(drop).length) return a; return a.filter(function (x) { return !(x && (drop[String(x.id)] || (x.kind === 'react' && drop[String(x.ref)]))); }); }
function chMgr_(c) { return !!(c.adm || c.role === 'manager'); }
function chVis_(x, c) { if (!x || typeof x !== 'object') return false; if (c.adm) return true;
  if (x.kind === 'dm') return (Array.isArray(x.members) ? x.members : []).map(low_).indexOf(c.em) >= 0;
  if (c.role === 'manager' || (c.em && low_(x.byEmail) === c.em)) return true;
  var a = x.aud && typeof x.aud === 'object' ? x.aud : {}; if (a.all) return true;
  if ((Array.isArray(a.people) ? a.people : []).map(low_).indexOf(c.em) >= 0) return true;
  return !!c.dept && (Array.isArray(a.depts) ? a.depts : []).indexOf(c.dept) >= 0; }
function msgVis_(x, c, pre) { if (!x || typeof x !== 'object') return false; if (c.adm) return true; if (pre == null) return false; return chVis_(c.idx(pre, 'totChannels')[String(x.ch)], c); }
function chatPush_(name, newV, oldV, c, pre, del) {
  var n = jp_(newV, null), o = jp_(oldV, []), now = Date.now(), C = name === 'totChannels'; if (!Array.isArray(n)) return null; if (!Array.isArray(o)) o = [];
  var newMsgs = 0, chs = {}, base = c.idx(pre, 'totChannels'); Object.keys(base).forEach(function (k) { chs[k] = base[k]; });
  var inN = {}, seen = {}, out = [], mine = function (x) { return !!c.em && low_(x.email) === c.em; };
  var chOf = function (x) { return chs[String(x && x.ch)]; }, canSee = function (x) { return C ? chVis_(x, c) : chVis_(chOf(x), c); };
  var mid = {}; o.forEach(function (y) { if (y && y.id != null) mid[String(y.id)] = y; }); n.forEach(function (y) { if (y && y.id != null && !mid[String(y.id)]) mid[String(y.id)] = y; });
  var canPost = function (x) { var ch = chOf(x); if (!ch || !chVis_(ch, c) || ch.archived) return false; if (!mine(x) && !c.adm) return false;
    if (x.parent) { var pm = mid[String(x.parent)]; if (!pm || String(pm.ch) !== String(x.ch) || pm.parent || pm.kind === 'react') return false; }   /* a reply needs a post in the same channel */
    if (x.kind === 'react') return !!x.ref; return !(ch.kind !== 'dm' && ch.mode === 'announce' && !x.parent && !chMgr_(c) && low_(ch.byEmail) !== c.em); };
  n.forEach(function (x) { if (x && x.id != null) inN[String(x.id)] = x; });
  o.forEach(function (x) { var id = x && x.id != null ? String(x.id) : null; if (id == null) { out.push(x); return; } seen[id] = 1;
    if (!C && x && !chs[String(x.ch)]) { del[id] = now; return; }   /* messages of a deleted channel go with it */
    if (!canSee(x)) { out.push(x); return; }
    var y = inN[id];
    if (C) { var mayEdit = x.kind === 'dm' ? (Array.isArray(x.members) ? x.members : []).map(low_).indexOf(c.em) >= 0 : chMgr_(c);
      if (y === undefined) { if (x.kind === 'dm' ? low_(x.byEmail) === c.em || c.adm : chMgr_(c)) { del[id] = now; return; } out.push(x); return; }
      if (!mayEdit || !y || typeof y !== 'object') { out.push(x); return; }
      if (x.kind === 'dm') { y.members = x.members; y.kind = 'dm'; } else y.kind = 'ch'; y.byEmail = x.byEmail; y.id = x.id; chs[id] = y; out.push(y); return; }
    var ch = chOf(x), mod = ch && ch.kind !== 'dm' && chMgr_(c);
    if (y === undefined) { if (ch && ch.archived) { out.push(x); return; } if (mine(x) || mod) { del[id] = now; return; } out.push(x); return; }   /* an archived channel is read only, deletes included */
    if (!y || typeof y !== 'object' || x.kind === 'react') { out.push(x); return; }
    if (mine(x)) { if (ch && ch.archived) { out.push(x); return; } ['email', 'by', 'ch', 'ts', 'kind', 'parent'].forEach(function (f) { y[f] = x[f]; }); y.id = x.id; out.push(y); return; }
    if (mod && y.del && !x.del) { var z = JSON.parse(JSON.stringify(x)); z.del = { by: String(y.del.by || '').slice(0, 80), ts: now }; z.text = ''; out.push(z); return; }   /* a manager removes a message */
    out.push(x); });
  n.forEach(function (x) { var id = x && x.id != null ? String(x.id) : null; if (id == null || seen[id] || del[id] || !x || typeof x !== 'object') return; seen[id] = 1;
    if (C) { if (x.kind === 'dm') { var mm = (Array.isArray(x.members) ? x.members : []).map(low_).filter(Boolean); if (!(c.adm || (mm.indexOf(c.em) >= 0 && low_(x.byEmail) === c.em)) || mm.length < 2 || mm.length > 20) return; x.members = mm; }
      else { if (!chMgr_(c)) return; x.kind = 'ch'; }
      chs[id] = x; out.push(x); return; }
    if (!c.adm && ++newMsgs > CHAT_BURST) return;   /* v3.39: one save adds at most 60 messages, so nobody can push the history out */
    if (!canPost(x)) return; x.text = String(x.text || '').slice(0, 4000); x.ts = Math.min(+x.ts || now, now);   /* a message is never dated in the future */
    out.push(x); });
  if (!C) out = chatTrim_(out);
  return JSON.stringify(out);
}
/* ===== v3.32 projects: shared and personal projects, broken down into sub-projects (parent), with work items and a visual board =====
   Access per project: owner and managers (editors) manage everything including access; the assigned teams / departments / people work on it (edit, add
   items, break it down into their own sub-projects); viewers only read. Visibility 'members' = only those people; 'org' = everyone may read;
   'inherit' (sub-projects) = whoever can read the parent. Whoever manages a project also manages every sub-project below it. Levels: 0 none, 1 read, 2 work, 3 manage. */
const PROJ_KEYS = ['totProjects', 'totProjItems', 'totProjBoard'];
const PJ_ACCESS = ['ownerEmail', 'ownerName', 'byEmail', 'parent', 'visibility', 'editors', 'assignees', 'viewers', 'boardEdit', 'stage', 'stages', 'gateApprovers'];   /* v3.33: board rights and the workflow stage are managers' too */
/* v3.33: an access list holds people (e-mails), departments and teams; a team member counts for the team and for the team's department */
function pjIn_(a, c, pre) { if (!a || typeof a !== 'object') return false; var pp = Array.isArray(a.people) ? a.people : [], dd = Array.isArray(a.depts) ? a.depts : [], tt = Array.isArray(a.teams) ? a.teams : [], m = pre != null && c.tm ? c.tm(pre) : { t: {}, d: {} };
  return pp.some(function (e) { return low_(e) === c.em; }) || dd.some(function (d) { var n = c.dOf(d); return (!!c.dept && n === c.dept) || !!m.d[n]; }) || tt.some(function (t) { return !!m.t[String(t)]; }); }
function pjHas_(a) { return !!a && typeof a === 'object' && ['people', 'depts', 'teams'].some(function (k) { return Array.isArray(a[k]) && a[k].length > 0; }); }
function pjLevel_(p, c, ix, depth) {
  if (c.all) return 3; if (!p || typeof p !== 'object') return 0;
  var up = (depth || 0) < 12 && p.parent != null && p.parent !== '' && ix[String(p.parent)] ? pjLevel_(ix[String(p.parent)], c, ix, (depth || 0) + 1) : 0;
  if (low_(p.ownerEmail) === c.em || low_(p.byEmail) === c.em || pjIn_(p.editors, c, ix.__pre) || up >= 3) return 3;
  if (pjIn_(p.assignees, c, ix.__pre)) return 2;
  if (pjIn_(p.viewers, c, ix.__pre) || p.visibility === 'org' || (p.visibility !== 'members' && p.parent && up >= 1)) return 1;
  return 0;
}
/* a work item / board shape belongs to a project (pid); a person assigned to one item may update that item even without rights on the project.
   v3.33: the board follows the project's boardEdit ('work' default, 'managers' = only managers draw, 'all' = viewers draw too); an item can be
   restricted (only the listed people / departments / teams, the project managers, its assignee and its creator see it) or shared beyond the project
   (share: read, or work with share.edit); approvers always see the approval asked of them. */
function pjRecLevel_(name, x, c, ix) { if (c.all) return 3; if (!x) return 0; if (name === 'totProjects') return pjLevel_(x, c, ix, 0);
  var p = ix[String(x.pid)], l = pjLevel_(p, c, ix, 0), pre = ix.__pre;
  if (name === 'totProjBoard') { var be = p && p.boardEdit; return be === 'managers' && l < 3 ? Math.min(l, 1) : be === 'all' && l >= 1 ? Math.max(l, 2) : l; }
  var asg = low_(x.assigneeEmail) === c.em, mine = asg || low_(x.byEmail) === c.em;
  if (pjHas_(x.restrict) && l < 3 && !mine) l = pjIn_(x.restrict, c, pre) ? Math.max(l, 1) : 0;   /* the people it is restricted to always read it */
  if (pjIn_(x.share, c, pre)) l = Math.max(l, x.share.edit ? 2 : 1);
  if (asg) l = Math.max(l, 2);
  if (x.kind === 'approval' && (Array.isArray(x.approvers) ? x.approvers : []).map(low_).indexOf(c.em) >= 0) l = Math.max(l, 1);
  return l; }
/* v3.33 approvals: the status is worked out here from the approvers' decisions; each person can only write their own decision */
function pjApprSt_(z) { var ap = (Array.isArray(z.approvers) ? z.approvers : []).map(low_), ds = z.decisions || {}, v = ap.map(function (e) { return ds[e] && ds[e].d; });
  if (v.indexOf('rejected') >= 0) return 'rejected'; if (v.indexOf('changes') >= 0) return 'changes'; if (!ap.length) return 'pending';
  return (z.rule === 'any' ? v.indexOf('approved') >= 0 : v.every(function (d) { return d === 'approved'; })) ? 'approved' : 'pending'; }
function pjDec_(d) { return d && typeof d === 'object' && ['approved', 'rejected', 'changes'].indexOf(d.d) >= 0 ? { d: d.d, note: String(d.note || '').slice(0, 1000), who: String(d.who || '').slice(0, 80), ts: Math.min(+d.ts || Date.now(), Date.now() + 60000) } : null; }
function pjApprove_(x, y, c, l) { var ap = (Array.isArray(x.approvers) ? x.approvers : []).map(low_), me = ap.indexOf(c.em) >= 0, z = l >= 2 && y && typeof y === 'object' ? y : JSON.parse(JSON.stringify(x)), d = {}, keep = Array.isArray(z.approvers) ? z.approvers.map(low_) : ap;
  Object.keys(x.decisions || {}).forEach(function (e) { if (keep.indexOf(e) >= 0) d[e] = x.decisions[e]; });   /* approvers taken off lose their decision */
  if (c.all && y && y.decisions) Object.keys(y.decisions).forEach(function (e) { var q = pjDec_(y.decisions[e]); if (q) d[low_(e)] = q; });
  else if (me && y && y.decisions && y.decisions[c.em] !== undefined) { var q = pjDec_(y.decisions[c.em]); if (q) d[c.em] = q; else delete d[c.em]; }
  if (!c.all && l < 3) ['approvers', 'rule', 'ref', 'byEmail', 'by', 'pid'].forEach(function (f) { if (x[f] === undefined) delete z[f]; else z[f] = x[f]; });   /* only managers change who approves and the rule */
  if (!c.all && l < 3) { d = {}; Object.keys(x.decisions || {}).forEach(function (e) { d[e] = x.decisions[e]; }); if (me && y && y.decisions && y.decisions[c.em] !== undefined) { var q2 = pjDec_(y.decisions[c.em]); if (q2) d[c.em] = q2; else delete d[c.em]; } }
  z.decisions = d; z.kind = 'approval'; z.status = pjApprSt_(z); return z; }
/* merge a save record by record (like scopedPush_), with edit rights: readers cannot change, people who work on a project cannot change its access
   settings, items never move to another project, only managers delete projects; new top-level projects must be owned by the person saving them and
   new sub-projects / items / shapes need work rights on their project */
function projPush_(name, newV, oldV, c, pre, del) {
  var n = jp_(newV, null), o = jp_(oldV, []), now = Date.now(), P = name === 'totProjects'; if (!Array.isArray(n)) return null; if (!Array.isArray(o)) o = [];
  var ix = {}, base = c.idx(pre, 'totProjects'); Object.keys(base).forEach(function (k) { ix[k] = base[k]; }); Object.defineProperty(ix, '__pre', { value: pre });
  var inN = {}, seen = {}, out = [], lvl = function (x) { return pjRecLevel_(name, x, c, ix); };
  n.forEach(function (x) { if (x && x.id != null) inN[String(x.id)] = x; });
  var gone = P ? {} : c.dels(pre + 'totProjects');   /* items and shapes of a deleted project are removed with it */
  o.forEach(function (x) { var id = x && x.id != null ? String(x.id) : null; if (id == null) { out.push(x); return; } seen[id] = 1;
    if (!P && x && gone[String(x.pid)]) { del[id] = now; return; }
    var l = lvl(x), y = inN[id]; if (l < 1) { out.push(x); return; }
    if (y !== undefined) { if (!P && name === 'totProjItems' && x.kind === 'approval') { if (l < 2 && (x.approvers || []).map(low_).indexOf(c.em) < 0) { out.push(x); return; } var z = pjApprove_(x, y, c, l); z.pid = x.pid; z.id = x.id; out.push(z); return; }
      if (l < 2 || !y || typeof y !== 'object') { out.push(x); return; }
      if (!P && name === 'totProjItems' && !(c.all || l >= 3 || low_(x.byEmail) === c.em)) ['restrict', 'share'].forEach(function (f) { if (x[f] === undefined) delete y[f]; else y[f] = x[f]; });   /* item access: project managers and the item's creator */
      if (P && l >= 3 && !c.adm && (+y.stage || 0) > (+x.stage || 0)) {   /* managers too; only the admin key skips the gate */
        var tg = (Array.isArray(x.stages) ? x.stages : [])[+y.stage], its = c.idx(pre, 'totProjItems');   /* a stage that needs approval is entered only after it is approved */
        var G = (x.gateApprovers && Array.isArray(x.gateApprovers.people) && x.gateApprovers.people.length ? x.gateApprovers.people : [x.ownerEmail]).map(low_).filter(Boolean);   /* every gate approver must be on the request */
        if (tg && tg.gate && !Object.keys(its).some(function (k) { var a = its[k], ap = a && Array.isArray(a.approvers) ? a.approvers.map(low_) : []; return a && a.kind === 'approval' && String(a.pid) === String(x.id) && a.ref === 'stage:' + (+y.stage) && a.status === 'approved' && G.every(function (e) { return ap.indexOf(e) >= 0; }); })) y.stage = x.stage; }
      if (P && l < 3) PJ_ACCESS.forEach(function (f) { if (x[f] === undefined) delete y[f]; else y[f] = x[f]; });
      if (P && String(y.parent || '') !== String(x.parent || '') && y.parent && pjLevel_(ix[String(y.parent)], c, ix, 0) < 2) y.parent = x.parent;   /* move only under a project you work on */
      if (!P) y.pid = x.pid; y.id = x.id; out.push(y); return; }
    if (P ? l >= 3 : l >= 2) { del[id] = now; return; }
    out.push(x); });
  n.forEach(function (x) { var id = x && x.id != null ? String(x.id) : null; if (id == null || seen[id] || del[id] || typeof x !== 'object') return; seen[id] = 1;
    var ok = P ? (x.parent != null && x.parent !== '' ? pjLevel_(ix[String(x.parent)], c, ix, 0) >= 2 : (c.all || low_(x.ownerEmail) === c.em)) : name === 'totProjBoard' ? pjRecLevel_(name, x, c, ix) >= 2 : pjLevel_(ix[String(x.pid)], c, ix, 0) >= 2;   /* v3.33 the board follows its drawing rights */
    if (!ok) return; if (P) ix[id] = x;
    if (!P && name === 'totProjItems' && x.kind === 'approval') { x.decisions = {}; x.status = pjApprSt_(x); }   /* a new approval starts with no decisions */
    out.push(x); });
  return JSON.stringify(out);
}
/* ----- v3.32 project updates by e-mail, only to the people involved (owner, managers, assigned people and the members of assigned departments,
   people with an item assigned). Daily digest of the last 24 hours: sent once a day on the first save (or by the trigger installProjectDigest());
   on demand: action 'projNotify' from the project page (work rights needed). Readers (viewers) are not e-mailed. ----- */
function pjPeople_(cur) { var p = policy_(cur), us = p.users || {}, depts = p.depts || {}, dOf = function (x) { x = String(x || ''); return DEPT_IDS.indexOf(x) >= 0 ? x : (depts[x] || DEPT_DEF[x] || x); };
  return { known: function (e) { var u = us[low_(e)]; return !!(u && u.role); }, name: function (e) { var u = us[low_(e)]; return u && u.name ? String(u.name) : String(e || ''); }, inDept: function (d) { d = dOf(d); return Object.keys(us).filter(function (k) { return us[k] && dOf(us[k].role) === d; }); } }; }
function pjInvolved_(p, items, who, teams) { var set = {}, add = function (e) { e = low_(e); if (/^[^@\s]+@[^@\s]+$/.test(e) && who.known(e)) set[e] = 1; }, tm = {};   /* v3.39: only people in the access list are e-mailed, never an address typed into a project */ (Array.isArray(teams) ? teams : []).forEach(function (t) { if (t && t.id != null) tm[String(t.id)] = t; });
  add(p.ownerEmail); [p.editors, p.assignees].forEach(function (a) { if (!a) return; (a.people || []).forEach(add); (a.depts || []).forEach(function (d) { who.inDept(d).forEach(add); }); (a.teams || []).forEach(function (t) { t = tm[String(t)]; if (t) { add(t.lead); (t.members || []).forEach(add); } }); });
  (items || []).forEach(function (it) { if (!it || String(it.pid) !== String(p.id)) return; add(it.assigneeEmail); if (it.kind === 'approval' && it.status !== 'approved' && it.status !== 'rejected') (it.approvers || []).forEach(add); });
  (Array.isArray(p.mute) ? p.mute : []).forEach(function (e) { delete set[low_(e)]; }); return Object.keys(set); }
const PJ_ST = { todo: 'To do', doing: 'In progress', blocked: 'BLOCKED', help: 'NEEDS HELP', waiting: 'WAITING', review: 'In review', done: 'Done', planned: 'Planned', active: 'Active', cancelled: 'Cancelled' };
function pjSummary_(p, items, since, all) {
  var td = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'), its = items.filter(function (i) { return i && String(i.pid) === String(p.id); }), mine = its.filter(function (i) { return ['note', 'update', 'doc', 'link', 'file', 'approval'].indexOf(i.kind) < 0; }), soon = Utilities.formatDate(new Date(Date.now() + 2 * 86400000), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var done = mine.filter(function (i) { return i.status === 'done'; }).length, L = [];
  var kids = all.filter(function (q) { return q && String(q.parent) === String(p.id); });
  L.push('■ ' + String(p.title || 'Project') + ' — ' + (PJ_ST[p.status] || p.status || 'Active') + (p.due ? ' · due ' + p.due : '') + ' · ' + done + '/' + mine.length + ' items done' + (kids.length ? ' · ' + kids.length + ' sub-project(s)' : ''));
  var bl = mine.filter(function (i) { return i.status === 'blocked'; }), hp = mine.filter(function (i) { return i.status === 'help'; }), wt = mine.filter(function (i) { return i.status === 'waiting'; }),
    od = mine.filter(function (i) { return i.status !== 'done' && i.due && i.due < td; }), nm = function (i) { return String(i.title || '') + (i.assigneeName ? ' (' + i.assigneeName + ')' : ''); };
  bl.forEach(function (i) { L.push('  ⛔ Blocked: ' + nm(i) + (i.blocker ? ' — ' + String(i.blocker).slice(0, 200) : '')); });
  hp.forEach(function (i) { L.push('  🙋 Needs help: ' + nm(i) + (i.help ? ' — ' + String(i.help).slice(0, 200) : '')); });
  wt.forEach(function (i) { L.push('  ⏳ Waiting' + (i.waitingFor ? ' for ' + String(i.waitingFor).slice(0, 120) : '') + ': ' + nm(i) + (i.waitSince ? ' (' + Math.max(0, Math.round((Date.now() - +i.waitSince) / 86400000)) + ' days)' : '')); });
  od.forEach(function (i) { L.push('  ⏰ Overdue (due ' + i.due + '): ' + nm(i)); });
  var ds = mine.filter(function (i) { return i.status !== 'done' && i.due && i.due >= td && i.due <= soon; }); ds.forEach(function (i) { L.push('  📅 Due soon (' + i.due + '): ' + nm(i)); });
  var ap = its.filter(function (i) { return i.kind === 'approval' && (i.status === 'pending' || i.status === 'changes'); }); ap.forEach(function (i) { var n = (i.approvers || []).length, ok = Object.keys(i.decisions || {}).filter(function (e) { return i.decisions[e].d === 'approved'; }).length; L.push('  ✔ Approval ' + (i.status === 'changes' ? 'sent back for changes' : 'waiting') + ': ' + String(i.title || '') + ' (' + ok + '/' + n + ' approved)'); });
  var ch = []; (p.hist || []).forEach(function (h) { if (h && +h.ts > since) ch.push(h); }); its.forEach(function (i) { (i.hist || []).forEach(function (h) { if (h && +h.ts > since) ch.push({ ts: h.ts, who: h.who, act: String(h.act || '') + ': ' + String(i.title || '') }); }); });
  kids.forEach(function (q) { (q.hist || []).forEach(function (h) { if (h && +h.ts > since) ch.push({ ts: h.ts, who: h.who, act: String(h.act || '') + ' (sub-project ' + String(q.title || '') + ')' }); }); });
  ch.sort(function (a, b) { return (+a.ts || 0) - (+b.ts || 0); }).slice(-25).forEach(function (h) { L.push('  • ' + Utilities.formatDate(new Date(+h.ts), Session.getScriptTimeZone(), 'dd MMM HH:mm') + ' ' + String(h.who || '') + ': ' + String(h.act || '').slice(0, 200)); });
  return { text: L.join('\n'), changes: ch.length, alerts: bl.length + hp.length + od.length + ds.length + ap.length };
}
function projDigest_(cur, force) {
  var Pr = PropertiesService.getScriptProperties(), day = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  if (!force && Pr.getProperty('LAST_PDIG') === day) return 0; Pr.setProperty('LAST_PDIG', day);
  var since = Date.now() - 86400000, who = pjPeople_(cur), per = {}, sent = 0;
  Object.keys(cur.keys || {}).forEach(function (k) { var q = parseKey_(k); if (!q || q.name !== 'totProjects') return; var pre = k.slice(0, k.length - q.name.length);
    var all = jp_(cur.keys[k].v, []), items = jp_(cur.keys[pre + 'totProjItems'] && cur.keys[pre + 'totProjItems'].v, []); if (!Array.isArray(all)) return; if (!Array.isArray(items)) items = [];
    all.forEach(function (p) { if (!p || p.digest === 'off' || p.status === 'done' || p.status === 'cancelled') return; var s = pjSummary_(p, items, since, all); if (!s.changes && !s.alerts) return;
      pjInvolved_(p, items, who, jp_(cur.keys[pre + 'totTeams'] && cur.keys[pre + 'totTeams'].v, [])).forEach(function (e) { (per[e] = per[e] || []).push(s.text); }); }); });
  Object.keys(per).forEach(function (e) { try { MailApp.sendEmail(e, 'Projects: your daily update (' + per[e].length + ')', 'Hello ' + who.name(e) + ',\n\nWhat changed in your projects in the last 24 hours, and what is blocked, needs help or is overdue:\n\n' + per[e].join('\n\n') + '\n\nOpen the tool > Projects for details. You receive this because you own, manage or work on these projects.'); sent++; } catch (x) {} });
  return sent;
}
function projNotify_(cur, cx, b, me) {
  var site = String(b.site || 'main').replace(/[^a-z0-9-]/g, ''), pre = site === 'main' ? '' : 's~' + site + '~'; if (me && me.sites.indexOf(site) < 0) return { error: 'not allowed' };
  var ix = cx.idx(pre, 'totProjects'), p = ix[String(b.pid || '')];
  if (!p) return { error: 'project not found' }; if (pjLevel_(p, cx, ix, 0) < 2) return { error: 'not allowed' };
  var ck = CacheService.getScriptCache(), rk = 'pn:' + sh_(pre + '|' + p.id); if (ck.get(rk)) return { error: 'An update for this project was sent less than a minute ago.' };
  var items = jp_(cur.keys[pre + 'totProjItems'] && cur.keys[pre + 'totProjItems'].v, []), all = jp_(cur.keys[pre + 'totProjects'].v, []), who = pjPeople_(cur);
  if (!Array.isArray(items)) items = []; var days = Math.min(30, Math.max(1, +b.days || 7)), s = pjSummary_(p, items, Date.now() - days * 86400000, Array.isArray(all) ? all : []);
  var to = pjInvolved_(p, items, who, jp_(cur.keys[pre + 'totTeams'] && cur.keys[pre + 'totTeams'].v, [])).filter(function (e) { return e !== cx.em; }), note = String(b.note || '').slice(0, 2000), from = cx.all ? 'The admin' : who.name(cx.em);
  if (!to.length) return { ok: true, sent: 0 };
  var n = 0; to.slice(0, 80).forEach(function (e) { try { MailApp.sendEmail(e, 'Project update: ' + String(p.title || '').slice(0, 80), 'Hello ' + who.name(e) + ',\n\n' + from + ' sent an update' + (note ? ':\n\n' + note : '.') + '\n\nSummary (changes of the last ' + days + ' days):\n\n' + s.text + '\n\nOpen the tool > Projects for details.'); n++; } catch (x) {} });
  ck.put(rk, '1', 60); return { ok: true, sent: n };
}
/* ----- v3.33 project files: uploaded to the tool's Drive folder (private), named "pjfile-<project id>-…" by the server. Upload needs work rights on the
   project; download goes through the item that holds the file, so its access rules (project, restricted / shared item) decide who gets it. ----- */
function pjPre_(b, me) { var site = String(b.site || 'main').replace(/[^a-z0-9-]/g, ''); if (me && me.sites.indexOf(site) < 0) return null; return site === 'main' ? '' : 's~' + site + '~'; }
const PJ_FILE_MAX = 26214400, PJ_CH = 1572864;
function pjFileUp_(b, cx, me) {
  var pre = pjPre_(b, me); if (pre == null) return { error: 'not allowed' };
  var ix = cx.idx(pre, 'totProjects'), p = ix[String(b.pid || '')]; if (!p || pjLevel_(p, cx, ix, 0) < 2) return { error: 'not allowed' };
  var up = String(b.up || '').replace(/[^\w]/g, '').slice(0, 40), i = +b.i, n = +b.n, size = +b.size, cache = CacheService.getScriptCache();
  if (!up || !(size > 0) || !(n >= 1) || !(i >= 0) || i >= n) return { error: 'bad upload' }; if (size > PJ_FILE_MAX) return { error: 'The file is larger than 25 MB.' };
  var mime = String(b.mime || 'application/octet-stream').replace(/[^\w.+\/-]/g, '').slice(0, 100) || 'application/octet-stream', loc = cache.get('pf:' + up);
  if (!loc) { if (i !== 0) return { error: 'upload session lost, start again' };
    var nm = 'pjfile-' + String(p.id).replace(/[^\w-]/g, '') + '-' + String(b.name || 'file').replace(/[\\/:*?"<>|]/g, '_').slice(0, 100);
    var ir = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id', { method: 'post', contentType: 'application/json; charset=UTF-8', headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(size) }, payload: JSON.stringify({ name: nm, parents: [folder_().getId()] }), muteHttpExceptions: true });
    loc = ir.getHeaders().Location || ir.getHeaders().location; if (!loc) return { error: 'drive refused the upload' }; cache.put('pf:' + up, loc, 21000); }
  var bytes = Utilities.base64Decode(String(b.data || '')), s0 = i * PJ_CH, e0 = s0 + bytes.length - 1;
  var pr = UrlFetchApp.fetch(loc, { method: 'put', contentType: mime, headers: { 'Content-Range': 'bytes ' + s0 + '-' + e0 + '/' + size }, payload: bytes, muteHttpExceptions: true }), code = pr.getResponseCode();
  if (code === 308) return { ok: true };
  if (code === 200 || code === 201) { cache.remove('pf:' + up); return { ok: true, fileId: JSON.parse(pr.getContentText()).id }; }
  return { error: 'drive error ' + code };
}
function pjFileGet_(b, cx, me) {
  var pre = pjPre_(b, me); if (pre == null) return { error: 'not allowed' };
  var it = cx.idx(pre, 'totProjItems')[String(b.id || '')]; if (!it || !it.fileId) return { error: 'gone' };
  if (pjRecLevel_('totProjItems', it, cx, cx.idx(pre, 'totProjects')) < 1) return { error: 'not allowed' };
  var fid = String(it.fileId); if (!/^[\w-]+$/.test(fid)) return { error: 'bad id' };
  var f; try { f = DriveApp.getFileById(fid); } catch (x) { return { error: 'gone' }; } if (f.isTrashed()) return { error: 'gone' };
  if (String(f.getName()).indexOf('pjfile-' + String(it.pid).replace(/[^\w-]/g, '') + '-') !== 0) return { error: 'not allowed' };   /* only files uploaded to this project */
  var inF = false, ps = f.getParents(), f0 = folder_().getId(); while (ps.hasNext()) { if (ps.next().getId() === f0) inF = true; } if (!inF) return { error: 'not allowed' };
  var size = f.getSize(), i = Math.max(0, +b.i || 0), s0 = i * PJ_CH; if (size && s0 >= size) return { error: 'bad range' };
  var rr = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + fid + '?alt=media', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), Range: 'bytes=' + s0 + '-' + (Math.min(size, s0 + PJ_CH) - 1) }, muteHttpExceptions: true });
  if (rr.getResponseCode() >= 300) return { error: 'drive error ' + rr.getResponseCode() };
  return { ok: true, n: Math.max(1, Math.ceil(size / PJ_CH)), mime: f.getMimeType(), name: String(it.fileName || it.title || 'file'), data: Utilities.base64Encode(rr.getContent()) };
}
/* Run ONCE from the Apps Script editor to send the daily project digest every morning even when nobody saves. */
function projDigestRun() { var cur = readJ_(file_(DATA, '{"keys":{}}'), { keys: {} }); cur.keys = cur.keys || {}; return projDigest_(cur, false); }
function installProjectDigest() { ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'projDigestRun') ScriptApp.deleteTrigger(t); }); ScriptApp.newTrigger('projDigestRun').timeBased().everyDays(1).atHour(7).create(); }
function delMap_(cur, k) { cur.del = cur.del || {}; var m = cur.del[k] = cur.del[k] || {}, cut = Date.now() - DEL_KEEP_DAYS * 86400000; Object.keys(m).forEach(function (i) { if (m[i] < cut) delete m[i]; }); return m; }
/* audit log for non-admins: they receive their own entries; what they send is added (never replaces), and only entries in their own name are accepted */
function auditMine_(x, c) { var e = low_(x && x.email); return e ? e === c.em : (!!c.name && low_(x && x.who) === c.name); }
function auditId_(x) { return x && x.id != null ? String(x.id) : x && typeof x === 'object' ? String(x.ts) + '|' + x.who + '|' + x.act : JSON.stringify(x); }
function auditPull_(v, c) { var a = jp_(v, null); return Array.isArray(a) ? JSON.stringify(a.filter(function (x) { return auditMine_(x, c); })) : '[]'; }
/* v3.28 change journal: add-only like the audit log. A person receives their own entries, their department's, and the entries about data they can open
   themselves (src = the data key the change was made in, checked with the same rules as reading that key). */
function journalPull_(v, c, okSrc) { var a = jp_(v, null); if (!Array.isArray(a)) return '[]'; if (c.all) return v;
  return JSON.stringify(a.filter(function (x) { return x && typeof x === 'object' && (low_(x.email) === c.em || (x.dep && x.dep === c.dept) || (x.src && okSrc(String(x.src)))); })); }
function auditPush_(newV, oldV, c, max) {
  var n = jp_(newV, null), o = jp_(oldV, []); if (!Array.isArray(n)) return null; if (!Array.isArray(o)) o = [];
  var seen = {}; o.forEach(function (x) { seen[auditId_(x)] = 1; });
  n.forEach(function (x) { if (!x || typeof x !== 'object' || seen[auditId_(x)]) return; var e = low_(x.email); if (e && e !== c.em) return; if (!e) x.email = c.em; seen[auditId_(x)] = 1; o.push(x); });
  max = max || AUDIT_MAX; if (o.length > max) { o.sort(function (a, b) { return (+(a && a.ts) || 0) - (+(b && b.ts) || 0); }); o = o.slice(-max); }
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
    var b = null; try { b = JSON.parse(e.postData.contents); } catch (x) {}
    if (!b || typeof b !== 'object' || Array.isArray(b)) return out_({ error: 'bad request' });   /* v3.39 */
    var act = b.action, admin = b.admin === ADMIN_SECRET;
    var af = file_(ACCESS, '{"users":{}}'), acc = readJ_(af, { users: {} }); acc.users = acc.users || {};
    var em = String(b.email || '').trim().toLowerCase();
    function saveAcc() { af.setContent(JSON.stringify(acc)); }

    if (act === 'request') {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em) || !b.pwHash) return out_({ error: 'invalid' });
      if (acc.users[em]) { if (acc.users[em].ph !== sh_(b.pwHash)) { failed_(em); return out_({ status: 'bad', exists: true }); }   /* v2.1: only the owner of the password learns the status */
        return out_({ status: acc.users[em].status, exists: true }); }
      var rqc = CacheService.getScriptCache(), rqn = +(rqc.get('rq:n') || 0); if (rqn >= 30) return out_({ error: 'busy' }); rqc.put('rq:n', String(rqn + 1), 600);   /* v3.39: at most 30 new requests per 10 minutes, so nobody can flood the owner's mail */
      if (Object.keys(acc.users).filter(function (k) { return acc.users[k] && acc.users[k].status === 'pending'; }).length >= 100 || Object.keys(acc.users).length >= 500) return out_({ error: 'full' });   /* only waiting requests fill the list */
      acc.users[em] = { name: String(b.name || '').slice(0, 80), ph: sh_(b.pwHash), status: 'pending', at: Date.now() }; saveAcc();
      try { MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'Tool access request: ' + em, (b.name || '') + ' (' + em + ') asked for access.\nOpen the tool > admin space > Access requests to approve or deny.'); } catch (x) {}
      return out_({ status: 'pending' });
    }
    if (act === 'tv') return out_(tv_(b));   /* v3.40: lobby screen: no sign-in, a secret token */
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
        if (!admin) { var dfv = file_(DATA, '{"keys":{}}'), curv = readJ_(dfv, { keys: {} }); curv.keys = curv.keys || {}; var mv = whoIs_(curv, em); if (!accCaps_(accA_(curv), em, mv.role, capsFor_(curv, mv.role)).videos_upload) return out_({ error: 'not allowed' }); }   /* v2.4 */
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
    var me = admin ? null : whoIs_(cur, em); if (me) { me.acc = accA_(cur); me.caps = accCaps_(me.acc, em, me.role, capsFor_(cur, me.role)); }   /* v3.36 page levels */

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
    if (me && /^(projNotify|pjFileUp|pjFileGet)$/.test(act) && !keyOk_(cur, em, me, cx, 'totProjects', act === 'pjFileGet' ? 'read' : 'write')) return out_({ error: 'not allowed' });   /* v3.36: Projects hidden or View only */
    if (act === 'projNotify') return out_(projNotify_(cur, cx, b, me));   /* v3.32 */
    if (act === 'pjFileUp') return out_(pjFileUp_(b, cx, me));   /* v3.33 */
    if (act === 'pjFileGet') return out_(pjFileGet_(b, cx, me));
    if (act === 'pull') {
      if (admin) return out_({ keys: cur.keys, updatedAt: cur.updatedAt || 0 });
      var res = { keys: {}, updatedAt: cur.updatedAt || 0 };
      Object.keys(cur.keys).forEach(function (k) {
        var p = parseKey_(k), en = cur.keys[k]; if (!p || !en) return;
        if (k === 'totAccessPolicy') { res.keys[k] = redactPolicy_(en, em, cx); return; }
        if (k === 'totSites') { res.keys[k] = en; return; }
        if (p.name === 'totIntegrations') return;   /* v3.39: flow trigger URLs are secrets; only the admin key reads them */
        if (p.name === 'totAccessGrants') { res.keys[k] = redactGrants_(en, em); return; }
        if (p.name === 'totAccessAsks') { res.keys[k] = mineAsks_(en, em); return; }
        if (me.sites.indexOf(p.site) < 0 || !keyOk_(cur, em, me, cx, p.name, 'read')) return;
        var pre = k.slice(0, k.length - p.name.length);
        if (SCOPED.indexOf(p.name) >= 0) { res.keys[k] = { v: scopedPull_(p.name, en.v, cx, pre), t: en.t }; return; }   /* v3.23 */
        if (p.name === 'auditLog') { res.keys[k] = { v: auditPull_(en.v, cx), t: en.t }; return; }
        if (p.name === 'totJournal') { res.keys[k] = { v: journalPull_(en.v, cx, function (src) { return src !== 'totJournal' && src !== 'auditLog' && ADMIN_ONLY_WRITE.indexOf(src) < 0 && keyOk_(cur, em, me, cx, src, 'read'); }), t: en.t }; return; }   /* v3.28 */
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
        if (!admin && (ADMIN_ONLY_WRITE.indexOf(k) >= 0 || ADMIN_ONLY_WRITE.indexOf(p.name) >= 0 || me.sites.indexOf(p.site) < 0 || !keyOk_(cur, em, me, cx, p.name, 'write'))) { denied.push(k); return; }
        var o = cur.keys[k], t = Math.min(+n.t || now, now + 60000), pre = k.slice(0, k.length - p.name.length);
        if (!admin && !o && Object.keys(cur.keys).length >= MAX_KEYS) { denied.push(k); return; }   /* v3.39: staff cannot create unlimited keys */
        if (!admin && p.name === 'totJournal') { var jv = auditPush_(n.v, o && o.v, cx, JOURNAL_MAX); if (jv == null) { denied.push(k); return; } cur.keys[k] = { v: jv, t: Math.max(now, (+(o && o.t) || 0) + 1) }; changed = true; return; }   /* v3.28 add-only */
        if (!admin && p.name === 'auditLog') { var av = auditPush_(n.v, o && o.v, cx); if (av == null) { denied.push(k); return; } cur.keys[k] = { v: av, t: Math.max(now, (+(o && o.t) || 0) + 1) }; changed = true; return; }   /* v3.23 add-only, never a conflict */
        if (o && n.bt != null && (+o.t || 0) > (+n.bt || 0)) { conflicts.push(k); return; }   /* somebody saved after this device last read it */
        if (o && n.bt == null && t < (+o.t || 0)) return;                                    /* old clients: newest time wins */
        var val = n.v;
        if (!admin && p.name === 'totSchedule' && PAY_ROLES.indexOf(me.role) < 0) val = keepPay_(val, o && o.v);
        if (!admin && p.name === 'totAccessAsks') val = mergeAsks_(val, o && o.v, em);   /* a person may only write their own requests; other people's are kept */
        if (SCOPED.indexOf(p.name) >= 0) { val = scopedPush_(p.name, val, o && o.v, cx, pre, delMap_(cur, k)); if (val == null) { denied.push(k); return; } delete cx.cache[k]; delete cx.cache[k + '#case']; }   /* v3.23 */
        if (o) t = Math.max(t, (+o.t || 0) + 1);                                              /* versions only go up, so a missed save is always noticed */
        cur.keys[k] = { v: val, t: t }; changed = true;
      });
      if (changed) { backup_(df); cur.updatedAt = now; df.setContent(JSON.stringify(cur)); try { projDigest_(cur, false); } catch (x) {} }   /* v3.32 daily project digest */
      return out_({ ok: true, conflicts: conflicts, denied: denied });
    }
    return out_({ error: 'unknown' });
  } catch (ex) { try { Logger.log('doPost: ' + (ex && ex.stack || ex)); } catch (x) {} return out_({ error: 'server error' }); }   /* v3.39: never an HTML error page */
  finally { lock.releaseLock(); }
}


/* v2.91: evaluation videos are deleted after 62 days. Run installVideoCleanup() ONCE from the Apps Script editor to check daily. */
function cleanVideos_() { var cut = Date.now() - 62 * 86400000, it = folder_().getFiles(); while (it.hasNext()) { var f = it.next(); if (/^video\//.test(f.getMimeType()) && String(f.getName()).indexOf('pjfile-') !== 0 && f.getDateCreated().getTime() < cut) f.setTrashed(true); } }
function installVideoCleanup() { ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'cleanVideos_') ScriptApp.deleteTrigger(t); }); ScriptApp.newTrigger('cleanVideos_').timeBased().everyDays(1).create(); }
