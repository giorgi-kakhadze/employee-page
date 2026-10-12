'use strict';
/* Microsoft Dynamics 365 (HR) employee pull for the Server Edition. Settings come from the environment (PTF_DYN_*), never from the browser. */
const MAXPAGES = 40, MAXROWS = 20000;
/* ---- Microsoft Dynamics 365 (HR): which Dynamics field fills which column. Several names are tried, the first one that has a value wins. Override with DYN_MAP. ---- */
var DYN_MAP = {
  'Full Name': ['Name', 'FullName', 'WorkerName', 'DisplayName', 'EmployeeName'],
  'HR ID': ['PersonnelNumber', 'EmployeeId', 'EmployeeNumber', 'WorkerId', 'PersonnelNo'],
  'Email Address': ['PrimaryContactEmail', 'Email', 'EmailAddress', 'EmailAddress1', 'WorkEmail'],
  'Phone Number': ['PrimaryContactPhone', 'PrimaryPhone', 'Phone', 'MobilePhone', 'Telephone1'],
  'Start Date': ['EmploymentStartDate', 'StartDate', 'HireDate', 'EmploymentDate'],
  'End Date': ['EmploymentEndDate', 'EndDate', 'TerminationDate'],
  'Position': ['Position', 'PositionId', 'JobTitle', 'Title', 'JobId'],
  'Status': ['Status', 'EmploymentStatus', 'WorkerStatus']
};
function dynStr(v) { return v == null || typeof v === 'object' ? '' : String(v).trim(); }
function dynDate(v) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dynStr(v)); if (!m || +m[1] < 1950 || +m[1] >= 2100) return ''; return m[0]; }   /* 1900-01-01 and 2154-12-31 are "no date" in Dynamics */
function dynStatus(v) { v = dynStr(v); if (/^(active|employed|1|true|current)$/i.test(v)) return 'Employed'; if (/^(inactive|terminated|ended|resigned|dismissed|left|0|false|former)/i.test(v)) return 'Terminated'; return v; }
function dynMerge(over) { var m = {}; Object.keys(DYN_MAP).forEach(function (k) { m[k] = DYN_MAP[k]; }); if (over && typeof over === 'object') Object.keys(over).forEach(function (k) { if (!DYN_MAP[k]) return; var v = over[k]; m[k] = (Array.isArray(v) ? v : [v]).map(String).filter(Boolean).slice(0, 10); }); return m; }
/* records (objects) -> header row + data rows in the columns the import already understands */
function dynBuild(recs, over, today) {
  var map = dynMerge(over), heads = Object.keys(map), used = {}, rows = recs.map(function (r) { var L = {}; Object.keys(r || {}).forEach(function (k) { L[k.toLowerCase()] = r[k]; });
    return heads.map(function (h) { var v = ''; map[h].forEach(function (c) { var x = L[c.toLowerCase()]; if (v === '' && x != null) v = /Date$/.test(h) ? dynDate(x) : h === 'Status' ? dynStatus(x) : dynStr(x); }); if (v !== '') used[h] = 1; return v; }); });
  if (!used['Full Name'] || !used['HR ID']) return { error: 'The answer from Dynamics has no field I can use for ' + (!used['Full Name'] ? 'the name' : 'the employee ID') + '. Use "Show fields" and set DYN_MAP to the field names you see.' };
  var iE = heads.indexOf('End Date'), iS = heads.indexOf('Status'); if (!used['Status']) { used['Status'] = 1; rows.forEach(function (r) { r[iS] = iE >= 0 && r[iE] && r[iE] < today ? 'Terminated' : 'Employed'; }); }
  var keep = heads.filter(function (h) { return used[h]; }), idx = keep.map(function (h) { return heads.indexOf(h); });
  return { header: keep, rows: rows.map(function (r) { return idx.map(function (i) { return r[i]; }); }) };
}
function dynNext(j, resource) { var n = j && j['@odata.nextLink']; return typeof n === 'string' && n.indexOf(resource + '/') === 0 ? n : ''; }   /* only follow links on the same Dynamics address */
function dynClip(rec) { var o = {}; Object.keys(rec || {}).slice(0, 60).forEach(function (k) { var v = rec[k]; o[k] = typeof v === 'object' && v !== null ? '(object)' : String(v == null ? '' : v).slice(0, 60); }); return o; }

function cfgOf(env) {
  const e = env || process.env, c = { tenant: String(e.PTF_DYN_TENANT || '').trim(), id: String(e.PTF_DYN_CLIENT_ID || '').trim(), secret: String(e.PTF_DYN_SECRET || ''), resource: String(e.PTF_DYN_RESOURCE || '').trim().replace(/\/+$/, ''), path: String(e.PTF_DYN_PATH || '/data/Workers?$top=5000').trim(), over: null, login: String(e.PTF_DYN_LOGIN_URL || 'https://login.microsoftonline.com').replace(/\/+$/, '') };
  try { c.over = JSON.parse(e.PTF_DYN_MAP || 'null'); } catch (x) {}
  if (!c.tenant || !c.id || !c.secret || !c.resource) return { error: 'Dynamics is not set up: set PTF_DYN_TENANT, PTF_DYN_CLIENT_ID, PTF_DYN_SECRET and PTF_DYN_RESOURCE on the server.' };
  if (!/^[0-9a-fA-F-]{36}$|^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(c.tenant)) return { error: 'PTF_DYN_TENANT must be the tenant ID (a GUID) or the tenant domain.' };
  if (!/^https:\/\//.test(c.resource) && !e.PTF_DYN_ALLOW_HTTP) return { error: 'PTF_DYN_RESOURCE must be the https address of your Dynamics environment.' };
  if (c.path.charAt(0) !== '/') c.path = '/' + c.path; return c;
}
async function pull(preview, env, fetchImpl) {
  const c = cfgOf(env); if (c.error) return c; const F = fetchImpl || fetch;
  let tj = {}, tr; try { tr = await F(c.login + '/' + encodeURIComponent(c.tenant) + '/oauth2/v2.0/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'client_credentials', client_id: c.id, client_secret: c.secret, scope: c.resource + '/.default' }).toString(), signal: AbortSignal.timeout(20000) }); tj = await tr.json(); } catch (e) { return { error: 'Dynamics sign-in failed: ' + String(e && e.message || e).slice(0, 160) }; }
  if (!tj.access_token) return { error: 'Dynamics sign-in failed: ' + String(tj.error_description || tj.error || tr.status).replace(/\s+/g, ' ').slice(0, 200) };
  let recs = [], url = c.resource + c.path, pages = 0;
  while (url && pages < MAXPAGES && recs.length < MAXROWS) {
    let r, j = {}; try { r = await F(url, { headers: { Authorization: 'Bearer ' + tj.access_token, Accept: 'application/json', 'OData-MaxVersion': '4.0', 'OData-Version': '4.0', Prefer: 'odata.maxpagesize=2000' }, signal: AbortSignal.timeout(30000) }); j = await r.json(); } catch (e) { return { error: 'Dynamics did not answer: ' + String(e && e.message || e).slice(0, 160) }; }
    if (r.status >= 300 || !Array.isArray(j.value)) return { error: 'Dynamics answered ' + r.status + ': ' + String((j.error && (j.error.message || j.error)) || 'no list of records').replace(/\s+/g, ' ').slice(0, 220) };
    recs = recs.concat(j.value); pages++; url = preview ? '' : dynNext(j, c.resource);
  }
  if (preview) return { ok: true, count: recs.length, keys: recs.length ? Object.keys(recs[0]).slice(0, 80) : [], sample: recs.slice(0, 3).map(dynClip), path: c.path };
  const b = dynBuild(recs, c.over, new Date().toISOString().slice(0, 10)); if (b.error) return b;
  return { ok: true, kind: 'rows', name: 'Microsoft Dynamics', modified: Date.now(), count: b.rows.length, data: [b.header].concat(b.rows) };
}
module.exports = { pull, cfgOf, dynBuild };
