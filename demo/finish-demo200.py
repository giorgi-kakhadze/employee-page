"""Last step for the 200-person demo: adds Community (via add-chat-to-demo.py), keeps the newest 150 journal lines and checks the result."""
import json, os, re, subprocess, collections
env = dict(os.environ, IN='demo/_d200-rot.json', OUT='demo/_d200-chat.json', NOTE='Demo company with 200 people on the roster (100 in Set 1, 100 in Set 2, 3 days on / 3 days off), all three shifts, a 6-day rotation (presenters on tables in a chain, shufflers on zones), Community channels and chats, tickets on every department board, onboarding, evaluations, pay, uniforms and more. Game presenters have unique first-name nicknames; shufflers have none.')
subprocess.check_call(['python3', 'demo/add-chat-to-demo.py'], env=env)
B = json.load(open('demo/_d200-chat.json')); j = B['data']
j['totJournal'] = json.dumps(json.loads(j['totJournal'])[-150:], ensure_ascii=False, separators=(',', ':')); B['_meta']['reason'] = 'demo-200'
raw = json.dumps(B, ensure_ascii=False, separators=(',', ':')); open('demo/PTF-demo-backup-200.json', 'w').write(raw); os.remove('demo/_d200-chat.json')
E_ = json.loads(j['employeeDataSource']); S = json.loads(j['totSchedule']); cfg = S['cfg']
shuf = {e['fullName'].lower() for e in E_ if 'shuffler' in e['ext']['position'].lower()}; nick = []
def walk(o):
    if isinstance(o, list): [walk(x) for x in o]
    elif isinstance(o, dict):
        if o.get('nickname'): nick.append(((o.get('fullName') or o.get('name') or '').lower(), o['nickname']))
        for v in o.values(): walk(v)
for v in j.values():
    try: walk(json.loads(v))
    except Exception: pass
pp = {}; [pp.setdefault(n, set()).add(k.lower()) for n, k in nick]
own = [n for n, ks in pp.items() if ks & {n.split()[0], n.split()[-1]}]; vals = [next(iter(k)) for k in pp.values()]
print('nicknames:', len(pp), 'people | one-nickname-one-person violations:', len(vals) - len(set(vals)), '| equal to own name:', len(own), '| shufflers with a nickname:', sum(1 for n in pp if n in shuf))
print('roster:', dict(collections.Counter(p['g'] for p in S['roster']['people'])), 'by shift', dict(collections.Counter(p['sh'] for p in S['roster']['people'])), 'teams', dict(collections.Counter(p['t'] for p in S['roster']['people'])))
bad = tot = 0
for dd, D in S['days'].items():
    for sk, sh in D['shifts'].items():
        teams = collections.defaultdict(list)
        for r in sh['rows']: teams[r['t']].append(r)
        for t, rows in teams.items():
            if t == 'sh': need = {'Z:' + z['n'] for z in (sh.get('zones') or cfg['zones'][sk]).get('sh', cfg['zones'][sk]['sh'])}
            else: T = cfg['tbl'][sk][t]; need = None
            for q in range(16):
                tot += 1
                if need is not None: bad += not need <= {r['cells'][q] for r in rows}
                else: bad += len(rows) >= len(T) and sorted(int(r['cells'][q]) for r in rows if r['cells'][q].isdigit()) != sorted(T)
print('rotation:', len(S['days']), 'days x 3 shifts; half-hour slots checked', tot, '| tables or zones left without a person', bad)
print('size', len(raw.encode()) // 1024, 'KB')
