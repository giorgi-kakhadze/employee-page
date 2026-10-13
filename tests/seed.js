/* Shared starting data: 5 people, admin-only mode off, a few tickets in different departments. */
module.exports = function (gas) {
  const now = Date.now(), P = (o) => ({ v: JSON.stringify(o), t: now - 1000 });
  const users = { 'hr@x.com': { role: 'hr_recruiter', name: 'Hana HR', sites: ['main'] }, 'lead@x.com': { role: 'shift_lead', name: 'Levan Lead', sites: ['main'] }, 'coach@x.com': { role: 'performance_coach', name: 'Cora Coach', sites: ['main'] }, 'mgr@x.com': { role: 'manager', name: 'Mia Manager', sites: ['main'] }, 'fmd@x.com': { role: 'scheduling_coordinator', name: 'Fred FMD', sites: ['main'] } };
  Object.keys(users).forEach(e => gas.addUser(e, 'pw-' + e, users[e].name));
  const T = (id, o) => Object.assign({ id, title: id, details: '', toEmail: '', toName: '', pri: 'normal', due: '', status: 'todo', created: now - 5000, u: now - 5000, hist: [] }, o);
  const tasks = [
    T('t-hr-term', { title: 'Termination: Ana — process', toRole: 'hr', fromName: 'Hana HR', fromEmail: 'hr@x.com', fromRole: 'hr_recruiter', caseId: 'c1', caseTitle: 'Termination: Ana' }),
    T('t-acc-term', { title: 'Termination: Ana — remove fingerprint', toRole: 'access', fromName: 'Hana HR', fromEmail: 'hr@x.com', fromRole: 'hr_recruiter', caseId: 'c1', caseTitle: 'Termination: Ana' }),
    T('t-perf', { title: 'Re-evaluation: Bob', toRole: 'performance', fromName: 'Levan Lead', fromEmail: 'lead@x.com', fromRole: 'shift_lead' }),
    T('t-fmd', { title: 'Schedule new hires', toRole: 'fmd', fromName: 'Mia Manager', fromEmail: 'mgr@x.com', fromRole: 'manager' }),
    T('t-legacy-role', { title: 'Old ticket addressed to a position', toRole: 'scheduling_coordinator', fromName: 'Someone', fromRole: 'senior' }),
    T('t-lead-to-it', { title: 'Laptop for Levan', toRole: 'it', fromName: 'Levan Lead', fromEmail: 'lead@x.com', fromRole: 'shift_lead' }),
    T('t-assigned-coach', { title: 'IT task given to Cora', toRole: 'it', toEmail: 'coach@x.com', toName: 'Cora Coach', fromName: 'Mia Manager', fromEmail: 'mgr@x.com', fromRole: 'manager' })
  ];
  const cases = [{ id: 'c1', kind: 'termination', title: 'Termination: Ana', empName: 'Ana', by: 'Hana HR', byEmail: 'hr@x.com', created: now, u: now }];
  const comments = [{ id: 'cm1', kind: 'task', ref: 't-hr-term', who: 'Hana HR', email: 'hr@x.com', ts: now, text: 'Confidential HR note' }, { id: 'cm2', kind: 'task', ref: 't-perf', who: 'Cora Coach', email: 'coach@x.com', ts: now, text: 'Will do Monday' }, { id: 'cm3', kind: 'ann', ref: 'a-hr', who: 'Hana HR', email: 'hr@x.com', ts: now, text: 'HR-only comment' }];
  const anns = [{ id: 'a-all', title: 'Welcome', body: 'x', toRoles: [], fromName: 'Mia Manager', fromEmail: 'mgr@x.com', created: now, u: now }, { id: 'a-hr', title: 'HR only memo', body: 'salary review', toRoles: ['hr'], fromName: 'Mia Manager', fromEmail: 'mgr@x.com', created: now, u: now }];
  const audit = [{ id: 'au1', ts: now, who: 'Hana HR', email: 'hr@x.com', act: 'Task "Termination: Ana — process" created' }, { id: 'au2', ts: now, who: 'Levan Lead', email: 'lead@x.com', act: 'Task "Laptop for Levan" created' }];
  gas.setData({ updatedAt: now, keys: { totAccessPolicy: P({ users, roles: {}, depts: {} }), totAccessGrants: P({ v: 1, on: false, byEmail: {} }), totTasks: P(tasks), totCases: P(cases), totComments: P(comments), totAnnouncements: P(anns), auditLog: P(audit) } });
  return users;
};
