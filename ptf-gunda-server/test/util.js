'use strict';
let fails = 0, total = 0;
function ok(name, cond, extra) { total++; if (!cond) fails++; console.log((cond ? '  ✅ ' : '  ❌ ') + name + (extra !== undefined && (!cond || process.env.VERBOSE) ? '  → ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 300) : '')); }
function section(t) { console.log(t); }
function done(name) { console.log(name + ': ' + (fails ? fails + ' FAILED of ' + total : 'ALL ' + total + ' PASSED')); process.exit(fails ? 1 : 0); }
const now = Date.now(), P = (o, t) => ({ v: typeof o === 'string' ? o : JSON.stringify(o), t: t || now - 5000 });
const iso = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
/* a small company: one manager, one shift lead, three employees (one of them has no staff role) */
function sample() {
  const E = (id, name, email, wid, status) => ({ id, fullName: name, nickname: name.split(' ')[0], workId: wid, status: status || 'Employed', email, ext: { email, position: 'Game presenter' } });
  return {
    totAccessPolicy: P({ users: { 'mgr@x.com': { role: 'manager', name: 'Mia Manager', sites: ['main'] }, 'lead@x.com': { role: 'shift_lead', name: 'Leo Lead', sites: ['main'] }, 'fmd@x.com': { role: 'scheduling_coordinator', name: 'Fay Coordinator', sites: ['main'] } }, roles: {}, depts: {} }),
    totAccessGrants: P({ v: 1, on: false, byEmail: {} }),
    employeeDataSource: P([E('e1', 'Ana Beridze', 'ana@x.com', 'W1'), E('e2', 'Nika Gela', 'nika@x.com', 'W2'), E('e3', 'Mia Manager', 'mgr@x.com', 'W3'), E('e4', 'Leo Lead', 'lead@x.com', 'W4')]),
    totMySchedules: P({ byEmail: { 'ana@x.com': { sx: [{ d: iso(2), s: 'morning', f: 8, t: 16 }, { d: iso(3), s: 'afternoon', f: 14, t: 22 }], group: 'A', shift: 'morning' } }, sent: {} }),
    totAnnouncements: P([{ id: 'a1', title: 'Welcome', body: 'x', toRoles: [], fromName: 'Mia Manager', fromEmail: 'mgr@x.com', created: now, u: now }]),
    totBonusCfg: P({ programs: [{ id: 'bp1', name: 'Quality' }] }),
    totIntegrations: P({ flows: { url: 'https://flow.example/secret' } })
  };
}
module.exports = { ok, section, done, P, iso, sample, now, get fails() { return fails; } };
