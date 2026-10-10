"""Builds demo/_lite-base.json: the demo company cut down to about 250 people (all shufflers, a sample of presenters, a few pit supervisors,
   the staff accounts). Every record about a removed person is removed too, so nothing points to somebody who is not there.
   Next steps (see the README): node demo/build-rotation-demo.js (rotation), python3 demo/add-chat-to-demo.py (chat)."""
import json, random, re
random.seed(11)
src = json.load(open('demo/PTF-demo-backup.json')); d = src['data']
J = lambda k: json.loads(d[k])
emps = J('employeeDataSource'); S = J('totSchedule')
by = {p['name'].lower(): p for p in S['roster']['people']}
# who stays: all shufflers (limited per shift and set), sampled presenters per shift/set/team, a few pit supervisors, and some non-active people (for the lifecycle records)
keep = set(); per = {}
people = list(S['roster']['people']); random.shuffle(people)
for p in people:
    k = (p.get('pos'), p.get('sh'), p.get('g'))
    cap = {'shuf': 8, 'pit': 2}.get(p.get('pos'), 8)
    if per.get(k, 0) < cap: per[k] = per.get(k, 0) + 1; keep.add(p['name'].lower())
inactive = [e for e in emps if str(e.get('status', '')).lower() in ('terminated', 'retired')][:14]
for e in inactive: keep.add(e['fullName'].lower())
newEmps = [e for e in emps if e['fullName'].lower() in keep]
removed = [e for e in emps if e['fullName'].lower() not in keep]
rn = set(e['fullName'] for e in removed); rw = set(str(e.get('workId')) for e in removed if e.get('workId'))
# also the new hires (N...) not kept are removed above; build one matcher
pat = re.compile('|'.join(re.escape(x) for x in sorted(rn | rw, key=len, reverse=True)))
mentions = lambda o: bool(pat.search(json.dumps(o, ensure_ascii=False)))
def prune(o, top=False):
    if isinstance(o, list): return [prune(x) for x in o if not mentions(x)]
    if isinstance(o, dict): return {k: prune(v) for k, v in o.items() if not (k in rn or k in rw or (isinstance(v, dict) and str(v.get('wid', '')) in rw))}
    return o
out = {}
for k, v in d.items():
    if k == 'employeeDataSource': out[k] = json.dumps(newEmps, ensure_ascii=False, separators=(',', ':')); continue
    if k in ('totSchedule', 'totAccessPolicy', 'totAccessGrants', 'totTrainerDisplayName'): out[k] = v; continue
    try: o = json.loads(v)
    except Exception: out[k] = v; continue
    o = prune(o)
    caps = {'totJournal': 260, 'evalResults': 140, 'totGameCounts': 400, 'totIncidents': 60, 'totTasks': 60, 'totBonusReviews': 60, 'totEmpRequests': 20, 'auditLog': 40}
    if k in caps and isinstance(o, list): o = o[-caps[k]:] if k in ('totJournal', 'auditLog') else o[:caps[k]]
    out[k] = json.dumps(o, ensure_ascii=False, separators=(',', ':'))
# evalShare must follow the evaluations that stayed
ids = set(x['id'] for x in json.loads(out['evalResults'])); es = json.loads(out['evalShare']); out['evalShare'] = json.dumps({k: v for k, v in es.items() if k in ids}, separators=(',', ':'))
# schedule: roster, month grid and profiles only for the people who stay
S['roster']['people'] = [p for p in S['roster']['people'] if p['name'].lower() in keep]
S['sched'] = {ym: {n: v for n, v in m.items() if n in keep} for ym, m in S['sched'].items()}
S['profiles'] = {k: v for k, v in S['profiles'].items() if k.lower() in keep} if isinstance(S['profiles'], dict) else S['profiles']
S['days'] = {}
out['totSchedule'] = json.dumps(S, ensure_ascii=False, separators=(',', ':'))
src['data'] = out; src['_meta']['note'] = 'lite base'
json.dump(src, open('demo/_lite-base.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(newEmps), 'people kept of', len(emps), '| roster', len(S['roster']['people']))
for k, v in sorted(out.items(), key=lambda x: -len(x[1]))[:8]: print(' ', k, len(v) // 1024, 'KB')
