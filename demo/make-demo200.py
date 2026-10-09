"""Builds demo/_d200-base.json: the demo company cut down to 200 people on the roster: 100 in Set 1 and 100 in Set 2 (3 days on, 3 days off),
   about 33 per shift and set (8 shufflers + the game presenters), plus a few former employees for the lifecycle records.
   - Shufflers get NO nickname (it is optional and not used for them).
   - Game presenters get a normal first name as nickname (not an internet handle); every nickname is used by one person only, and it is never
     the person's own first name or last name. The same person keeps the same nickname everywhere (employee list, onboarding groups).
   - Records about people who are not kept are removed; every department board keeps a few tickets in different stages.
   Next: node demo/build-rotation-demo.js (IN, OUT, DAYS), then python3 demo/add-chat-to-demo.py (IN, OUT, NOTE)."""
import json, random, re, collections
random.seed(2026)
src = json.load(open('demo/PTF-demo-backup.json')); d = src['data']
J = lambda k: json.loads(d[k])
emps = J('employeeDataSource'); S = J('totSchedule')
people = list(S['roster']['people']); random.shuffle(people)
# 1. who stays: per shift and set 33 or 34 people: 8 shufflers, the rest game presenters
groups = collections.defaultdict(list)
for p in people:
    if p.get('pos') == 'pit': continue
    groups[(p['sh'], p['g'])].append(p)
keep = set(); order = [('morning', 'A', 34), ('morning', 'B', 34), ('afternoon', 'A', 33), ('afternoon', 'B', 33), ('night', 'A', 33), ('night', 'B', 33)]
for sh, g, n in order:
    L = groups[(sh, g)]; shuf = [p for p in L if p.get('pos') == 'shuf'][:8]; gp = [p for p in L if p.get('pos') != 'shuf']
    pick = shuf + gp[:n - len(shuf)]
    assert len(pick) == n, (sh, g, len(pick))
    keep |= {p['name'].lower() for p in pick}
assert len(keep) == 200
inactive = [e for e in emps if str(e.get('status', '')).lower() in ('terminated', 'retired')][:6]
inactive_names = {e['fullName'].lower() for e in inactive}
newEmps = [e for e in emps if e['fullName'].lower() in keep or e['fullName'].lower() in inactive_names]
removed = [e for e in emps if e['fullName'].lower() not in keep and e['fullName'].lower() not in inactive_names]
rn = set(e['fullName'] for e in removed); rw = set(str(e.get('workId')) for e in removed if e.get('workId'))
pat = re.compile('|'.join(re.escape(x) for x in sorted(rn | rw, key=len, reverse=True)))
mentions = lambda o: bool(pat.search(json.dumps(o, ensure_ascii=False)))
def prune(o):
    if isinstance(o, list): return [prune(x) for x in o if not mentions(x)]
    if isinstance(o, dict): return {k: prune(v) for k, v in o.items() if not (k in rn or k in rw or (isinstance(v, dict) and str(v.get('wid', '')) in rw))}
    return o
out = {}
for k, v in d.items():
    if k == 'employeeDataSource': out[k] = json.dumps(newEmps, ensure_ascii=False); continue
    if k in ('totSchedule', 'totAccessPolicy', 'totAccessGrants', 'totTrainerDisplayName'): out[k] = v; continue
    try: o = json.loads(v)
    except Exception: out[k] = v; continue
    o = prune(o)
    caps = {'totJournal': 200, 'evalResults': 100, 'totGameCounts': 300, 'totIncidents': 40, 'totBonusReviews': 60, 'totEmpRequests': 20, 'auditLog': 40}
    if k in caps and isinstance(o, list): o = o[-caps[k]:] if k in ('totJournal', 'auditLog') else o[:caps[k]]
    if k == 'totTasks':   # every department board: a few tickets in different stages (to do, doing, waiting, done)
        by = collections.defaultdict(list)
        for t in o: by[t['toRole']].append(t)
        o = []
        for role, L in by.items():
            for st, n in (('todo', 2), ('doing', 2), ('waiting', 1), ('done', 2)): o += [t for t in L if t['status'] == st][:n]
    out[k] = json.dumps(o, ensure_ascii=False)
ids = set(x['id'] for x in json.loads(out['evalResults'])); es = json.loads(out['evalShare']); out['evalShare'] = json.dumps({k: v for k, v in es.items() if k in ids})
# 1b. every department board gets a few tickets in every stage (the ones that survived the cut are kept, the rest are written new about people who are on the roster)
TT = json.loads(out['totTasks']); roster_names = [p['name'] for p in S['roster']['people']]; staff = json.loads(d['totAccessPolicy'])['users']
byrole = collections.defaultdict(list)
for e, u in staff.items(): byrole[u['role']].append((e, u['name']))
WHO = {'access': 'manager', 'it': 'manager', 'hr': 'hr_recruiter', 'academy': 'training_coordinator', 'performance': 'shift_lead', 'fmd': 'shift_lead', 'service': 'manager', 'appearance': 'shift_lead'}
TITLES = {'access': ['Remove building access — {p}', 'Building access card for {p}', 'Locker key for {p}', 'Return access card — {p}', 'Visitor pass for the new group'],
 'it': ['Password reset for {p}', 'Laptop at the training room does not start', 'Screen in the lobby shows no picture', 'Install the tool on the new PC', 'Headset for {p} is broken'],
 'hr': ['Contract for {p}', 'Probation review for {p}', 'Holiday request check — {p}', 'Exit interview with {p}', 'Update address of {p}'],
 'academy': ['Exam retake for {p}', 'Mentor for {p}', 'Workshop attendance sheet', 'New group starts Monday', 'Game certificate for {p}'],
 'performance': ['Coaching session with {p}', 'Evaluation of {p} (Roulette)', 'Retraining plan for {p}', 'Review low scores of the week', 'Share evaluation with {p}'],
 'fmd': ['Swap shift: {p}', 'Zone rotation for the night shift', 'Table range of Team 2 is too small', 'Late start for {p} tomorrow', 'Lobby screen for Shufflers'],
 'service': ['Break room cleaning', 'Air conditioning on the floor', 'Coffee machine out of order', 'Chairs for the new tables', 'Water for the night shift'],
 'appearance': ['New jacket for {p}', 'Return uniform — {p}', 'Size change for {p}', 'Uniform stock check', 'Name badge for {p}']}
ST = [('todo', 'normal'), ('todo', 'high'), ('doing', 'normal'), ('doing', 'high'), ('waiting', 'normal'), ('done', 'normal'), ('done', 'low')]
nid = 3000; NOWMS = 1791466800000
for role, titles in TITLES.items():
    have = collections.Counter(t['status'] for t in TT if t['toRole'] == role)
    need = collections.Counter(st for st, _ in ST)
    for i, (st, pri) in enumerate(ST):
        if have[st] >= need[st]: continue
        have[st] += 1; nid += 1; person = random.choice(roster_names); em, nm = random.choice(byrole[WHO[role]]); days = random.randint(1, 9)
        created = NOWMS - days * 86400000; hist = [{'ts': created, 'who': nm, 'act': 'created'}]
        if st != 'todo': hist.append({'ts': created + 3600000 * 5, 'who': nm, 'act': 'status \u2192 ' + st})
        TT.append({'id': 'tk' + str(nid), 'num': 'TK-' + str(nid), 'title': titles[i % len(titles)].format(p=person), 'details': 'Created for the demo board.', 'toRole': role, 'toEmail': '', 'toName': '', 'fromName': nm, 'fromEmail': em, 'fromRole': WHO[role], 'pri': pri,
                   'due': '2026-10-' + str(min(28, 9 + random.randint(0, 12))).zfill(2), 'status': st, 'created': created, 'u': created + 3600000 * 5, 'hist': hist, 'rel': person, 'empId': '', 'caseId': '', 'caseTitle': ''})
out['totTasks'] = json.dumps(TT, ensure_ascii=False)
# 2. nicknames
POOL = """Alex Max Leo Mia Sophie Kate Nick Daniel Emma Lucas Oliver Chloe Ben Lily Sam Anna Jack Zoe Adam Ruby Ethan Grace Noah Ella Luke Hannah Jake Olivia Tom Eva Ryan Lena Dylan Nora Owen Clara Felix Ivy Hugo Alice Theo Maya Finn Sara Jonas Elsa Liam Julia Mark Rose Paul Jane Carl Beth Dean Amy Seth Ruth Neil Dina Ian Tess Troy Gina Kyle Jade Rex Faye Cole Iris Drew Wendy Glen Holly Vince Molly Brad Sue Gary Lucy Tim Cara Roy Pia Ned Kim Sean Meg Cody Rita Ross Nell Evan Tina Bruno Carla Dario Elena Fabio Greta Hans Ines Jorge Karin Lars Marta Nils Olga Pablo Rosa Stefan Tanya Vera Walter Xenia Ada Abel Alma Andre Aron Bella Cleo Dora Edgar Emil Enzo Fay Gabe Hazel Isla Ivan Jess Joel Kai Kira Lara Lola Luca Mila Nico Nina Omar Otto Pearl Quinn Rhea Rob Ron Sky Stella Tara Ugo Vic Willa Zara Abby Barry Cleo Daisy Eddie Fred Gus Hal Irma Jon Kurt Lou Mona Ned Opal Pete Rudy Sid Toby Una Val Wes Yara Zack Elias Marco Silvia Tobias Viktor Leona Martin Patrick Ronja Simon Tessa Ulla Vivian Warren Yvonne Bianca Caleb Denise Everett Fiona Gloria Harvey Imogen Jasper Kelsey Lorenzo Marlene Nathan Orla Percy Rafael Sabrina Terence Vanessa Winston Ximena Yael Zelda Arthur Bridget Conrad Diana Elliot Frances Gideon Heidi Isaac Joanna Kenneth Lydia Matilda Norman Odette Penelope Reuben Selma Timothy Ursula Valerie Wilma Xavier Yolanda Zachary""".split()
POOL = list(dict.fromkeys(POOL)); random.shuffle(POOL)
shufflers = {e['fullName'].lower() for e in newEmps if 'shuffler' in str(e['ext'].get('position', '')).lower()}
used, assigned, it = set(), {}, iter(POOL)
def nick_for(full):
    k = full.lower()
    if k in shufflers: return ''
    if k in assigned: return assigned[k]
    parts = re.sub(r'\s+\d+$', '', full).split(); bad = {parts[0].lower(), parts[-1].lower()}
    for c in it if False else POOL:
        if c.lower() in used or c.lower() in bad: continue
        used.add(c.lower()); assigned[k] = c; return c
    raise SystemExit('nickname pool is too small')
def walk(o, track=None):
    if isinstance(o, list): [walk(x, track) for x in o]
    elif isinstance(o, dict):
        t = o.get('track', track)
        if 'nickname' in o:
            full = o.get('fullName') or o.get('name') or ''
            o['nickname'] = '' if (t == 'SH' or str(full).lower() in shufflers) else (nick_for(full) if full else '')
        for v in o.values(): walk(v, t)
EO = json.loads(out['employeeDataSource']); walk(EO)
OB = json.loads(out['totOnboardingHier']); walk(OB)
out['employeeDataSource'] = json.dumps(EO, ensure_ascii=False, separators=(',', ':')); out['totOnboardingHier'] = json.dumps(OB, ensure_ascii=False, separators=(',', ':'))
# 3. schedule: roster, month grid and profiles only for the 200
S['roster']['people'] = [p for p in S['roster']['people'] if p['name'].lower() in keep]
S['sched'] = {ym: {n: v for n, v in m.items() if n in keep} for ym, m in S['sched'].items()}
if isinstance(S.get('profiles'), dict): S['profiles'] = {k: v for k, v in S['profiles'].items() if k.lower() in keep}
S['days'] = {}
out['totSchedule'] = json.dumps(S, ensure_ascii=False, separators=(',', ':'))
src['data'] = out; src['_meta']['note'] = 'base 200'
json.dump(src, open('demo/_d200-base.json', 'w'), ensure_ascii=False, separators=(',', ':'))
nk = [e['nickname'] for e in EO if e.get('nickname')]
print(len(S['roster']['people']), 'on the roster:', collections.Counter(p['g'] for p in S['roster']['people']), '| employee list', len(EO), '| nicknames', len(nk), 'unique', len(set(x.lower() for x in nk)))
print('shufflers with a nickname:', sum(1 for e in EO if e['fullName'].lower() in shufflers and e.get('nickname')))
print('tasks by department:', dict(collections.Counter(t['toRole'] for t in json.loads(out['totTasks']))))
for k, v in sorted(out.items(), key=lambda x: -len(x[1]))[:6]: print(' ', k, len(v) // 1024, 'KB')
