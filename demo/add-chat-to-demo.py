"""Adds Community channels, threads, reactions, pins and direct/group chats to the rotation demo backup.
   python3 demo/add-chat-to-demo.py   ->  demo/PTF-demo-backup-full.json"""
import json, random, hashlib, os
random.seed(77)
src = json.load(open(os.environ.get('IN', 'demo/PTF-demo-backup-with-rotation.json')))
d = src['data']
users = json.loads(d['totAccessPolicy'])['users']
by = lambda role: [e for e, x in users.items() if x['role'] == role]
nm = lambda e: users[e]['name']
mgr, lead, trn, coach, sen, sch, hr, svc = [by(r) for r in ['manager', 'shift_lead', 'training_coordinator', 'performance_coach', 'senior', 'scheduling_coordinator', 'hr_recruiter', 'service_manager']]
NOW = 1791466800000  # 2026-10-08 ~13:00 UTC
H = 3600 * 1000
chs, msgs = [], []
def ch(id, name, icon, desc, owner, aud, mode='open', days=40, pins=()):
    c = dict(id=id, kind='ch', name=name, icon=icon, desc=desc, mode=mode, aud=aud, by=nm(owner), byEmail=owner, created=NOW - days * 24 * H, u=NOW - days * 24 * H, pins=list(pins), archived=False)
    chs.append(c); return c
n = [0]
def say(c, who, text, ago_h, ann=False, parent=None, reacts=()):
    n[0] += 1; i = 'm-%04d' % n[0]; ts = NOW - int(ago_h * H)
    m = dict(id=i, ch=c['id'], kind='msg', email=who, by=nm(who), ts=ts, u=ts, text=text)
    if ann: m['ann'] = True
    if parent: m['parent'] = parent
    msgs.append(m)
    for k, e in enumerate(reacts):
        for w in random.sample(list(users), random.randint(1, 4)):
            ts2 = ts + (k + 1) * 600000
            msgs.append(dict(id='rx-%s-%d-%s' % (i, k, w), ch=c['id'], kind='react', ref=i, emoji=e, email=w, by=nm(w), ts=ts2, u=ts2))
    return i
allp = list(users)
# --- channels
c1 = ch('ch-all', 'Company announcements', '📣', 'Official news for everybody', mgr[0], dict(all=True, depts=[], people=[]), 'announce', 60)
c2 = ch('ch-fmd', 'FMD · floor and rotation', '🎰', 'Rotation, zones, tables and shift changes', mgr[1], dict(all=False, depts=[], people=mgr + lead + sch + sen), 'open', 55)
c3 = ch('ch-shuf', 'Shufflers · zones', '🃏', 'Zone A / B / C questions and swaps', lead[0], dict(all=False, depts=[], people=lead + mgr[:2] + sch), 'open', 50)
c4 = ch('ch-train', 'Academy · trainers', '🎓', 'Groups, exams, onboarding', trn[0], dict(all=False, depts=[], people=trn + mgr[:2] + lead[:2]), 'open', 50)
c5 = ch('ch-perf', 'Performance · coaches', '📈', 'Evaluations, coaching, retraining', coach[0], dict(all=False, depts=[], people=coach + sen + mgr[:2] + lead), 'open', 45)
c6 = ch('ch-night', 'Night shift handover', '🌙', 'What the next shift must know', lead[2], dict(all=False, depts=[], people=lead + mgr[:2] + sch[:1]), 'open', 30)
c7 = ch('ch-hr', 'HR · recruiting', '🧑‍💼', 'Candidates, contracts, onboarding dates', hr[0], dict(all=False, depts=[], people=hr + mgr[:2] + trn[:2]), 'open', 40)
c8 = ch('ch-social', 'Random · coffee corner', '☕', 'Anything not about work', mgr[2], dict(all=True, depts=[], people=[]), 'open', 60)
# --- announcements
a1 = say(c1, mgr[0], 'Welcome to the new Community space. Channels are for teams and news, chats are private. Please use threads for answers so the channel stays readable.', 24 * 38, True, reacts=['👍', '🎉'])
say(c1, mgr[1], 'Reminder: new zone rotation for shufflers starts Monday. Each shuffler stays in one zone for one hour. Maps are on the lobby screens and in the tool.', 24 * 12, True, reacts=['👍', '👀'])
a3 = say(c1, mgr[0], 'Public holiday next week: floor stays fully staffed. Time-off requests must be approved by Friday.', 24 * 6, True, reacts=['👍'])
say(c1, sch[0], 'Question: do night-shift people also need to request holiday here? Yes, same place — Requests tab.', 24 * 6 - 1, parent=a3)
say(c1, mgr[0], 'Yes, the same rule for every shift. Thank you Ilia.', 24 * 6 - 2, parent=a3, reacts=['👍'])
say(c1, mgr[3], 'Lobby TV screens are now live: Team One, Team Two, Team Three and Shufflers each have their own screen.', 24 * 3, True, reacts=['🎉', '👀', '👍'])
chs[0]['pins'] = [a1]
# --- conversation generator
def convo(c, lines, start_h, gap=(0.1, 3.5)):
    h = start_h; ids = []
    for who, text, *r in lines:
        ids.append(say(c, who, text, h, reacts=(r[1] if len(r) > 1 else ()))); h -= random.uniform(*gap)
    return ids
convo(c2, [
 (sch[0], 'Good morning. Rotation for tomorrow is generated for all three shifts, please check the Team Two table ranges.', 24 * 9 + 5),
 (lead[0], 'Morning shift: we have two people off, can we cover Team Two tables 41–60 with Team Three?', 0, ('👀',)),
 (sch[1], 'Moved two presenters from Team Three, rotation regenerated. Breaks stay balanced.', 0, ('👍',)),
 (mgr[1], 'Great. Please keep break share around 20 percent for everyone.', 0, ('👍',)),
 (lead[1], 'Afternoon shift: table 17 has a dealer change at 16:30, rotation will skip it for one slot.', 0),
 (sen[0], 'I checked — no table clashes in tomorrow rotation. All zones covered.', 0, ('✅',)),
 (sch[0], 'Shufflers: 8 per set in the morning, 6 at night. Zones are A to H, five tables each.', 0, ('👍',)),
 (lead[3], 'Can someone export the rotation as a backup before I change the zones?', 0),
 (sch[1], 'Done, saved in Home → Backups. Name starts with rotation-.', 0, ('🙏',)),
], 24 * 9 + 4)
convo(c3, [
 (lead[0], 'Reminder: shufflers stay one hour in a zone. After the hour you move to the next zone, not the next table.', 24 * 8),
 (sch[0], 'Zone A to D are the VIP side this week.', 0),
 (lead[4], 'Two shufflers asked to swap zones B and E. OK?', 0, ('👀',)),
 (lead[0], 'Swaps are fine if both agree and I see it in the tool. Please do it as a day-only change.', 0, ('👍',)),
 (mgr[0], 'The lobby screen for Shufflers now shows all table numbers for each zone.', 0, ('🎉',)),
 (lead[1], 'Night: 7 shufflers tonight, so we use smaller zones of 4 tables for the day. The tool suggests it.', 0, ('👍',)),
 (sch[1], 'Yes — "Fit to N people" does exactly that, only for this day.', 0),
], 24 * 8 - 1)
convo(c4, [
 (trn[0], 'Exam group B starts Monday, 12 people. Please send the schedule to the shift leads.', 24 * 15),
 (trn[1], 'Done. Three people have no mentor yet.', 0),
 (trn[2], 'I take two of them, Salome can take one?', 0, ('👍',)),
 (trn[3], 'Yes, Salome takes one. Thank you all.', 0, ('👍',)),
 (trn[0], 'Reminder: workshop on game procedures on Thursday 11:00, please upload the attendance sheet after.', 24 * 4),
 (trn[4], 'Attendance uploaded. 14 present, 2 excused.', 24 * 3, ('✅',)),
], 24 * 15)
r1 = say(c5, coach[0], 'This week we evaluate 40 presenters. Priority: beginners and everybody with a retraining plan.', 24 * 10, reacts=['👍'])
say(c5, coach[1], 'I take the night shift. Two people had low scores on game procedures last month.', 24 * 10 - 1, parent=r1)
say(c5, coach[2], 'I take afternoon. Evaluations are saved in the tool, you see them under Performance.', 24 * 10 - 2, parent=r1, reacts=['👍'])
convo(c5, [
 (sen[0], 'Please remember to add a short comment to every low score, it helps the trainers.', 24 * 7),
 (coach[0], 'Will do. Coaching session list is updated.', 0, ('👍',)),
 (lead[2], 'Thanks. Two people from my shift are in retraining, please share the dates.', 0),
 (coach[1], 'Dates added to their profiles and to the shift calendar.', 0, ('🙏',)),
], 24 * 7)
convo(c6, [
 (lead[2], 'Handover: table 88 light is flickering, technician informed.', 14),
 (lead[3], 'Noted. Two shufflers are late tomorrow, medical visit. Rotation already adjusted.', 0),
 (lead[4], 'VIP guest at table 12 until 03:00, please keep the strongest presenter there.', 0, ('👀',)),
 (lead[0], 'Understood, I put Gela on that table with a break every 2 hours.', 0, ('👍',)),
 (lead[2], 'Quiet night otherwise. Cash desk closed 05:30.', 0),
], 40)
convo(c7, [
 (hr[0], 'Six candidates for the next group. Interviews Tuesday and Wednesday.', 24 * 14),
 (hr[1], 'Contracts for three are ready, start date the 15th.', 0, ('🎉',)),
 (trn[0], 'We have places for 12 in the next group, send me the final list when ready.', 0),
 (hr[0], 'Final list tomorrow noon.', 0, ('👍',)),
], 24 * 14)
convo(c8, [
 (mgr[2], 'Who wants to join a quiz night on Friday?', 24 * 5, ('🎉', '👍')),
 (lead[1], 'Count me in!', 0, ('😂',)),
 (coach[2], 'Only if there is no game-show category.', 0, ('😂',)),
 (svc[0], 'I bring the snacks.', 0, ('❤️',)),
 (sen[1], 'Photo from last quiz night, we won again.', 0, ('😂', '🎉')),
], 24 * 5)
# --- direct and group chats
def dm(id, members, lines, start_h, name=None, days=20):
    c = dict(id=id, kind='dm', members=members, by=nm(members[0]), byEmail=members[0], created=NOW - days * 24 * H, u=NOW - days * 24 * H)
    if name: c['name'] = name
    chs.append(c); convo(c, lines, start_h, (0.05, 2.0)); return c
dm('dm-1', [mgr[0], mgr[1]], [(mgr[0], 'Do you have the numbers for the monthly review?', 0), (mgr[1], 'Yes, sending after lunch. Bonuses are calculated.', 0), (mgr[0], 'Thanks.', 0, ('👍',))], 30)
dm('dm-2', [lead[0], sch[0]], [(lead[0], 'Can you swap Beka to the afternoon shift next week?', 0), (sch[0], 'Yes, I change the roster set and regenerate the rotation.', 0), (lead[0], 'Perfect, thank you.', 0, ('🙏',))], 52)
dm('dm-3', [coach[0], lead[1]], [(coach[0], 'I want to sit with your night team on Friday, is it ok?', 0), (lead[1], 'Sure, come at 22:00.', 0, ('👍',))], 70)
dm('dm-4', [trn[0], trn[1], trn[2]], [(trn[0], 'Plan for exam week: Monday theory, Tuesday practice, Wednesday retake.', 0), (trn[1], 'I prepare the question set.', 0, ('👍',)), (trn[2], 'I book the training room.', 0, ('👍',))], 100, 'Exam week')
dm('dm-5', [mgr[0], lead[0], lead[1], lead[2], sch[0]], [(mgr[0], 'Short meeting tomorrow 10:00 about the new lobby screens and the zone rotation.', 0), (lead[0], 'I will be there.', 0, ('👍',)), (lead[2], 'Night shift joins online.', 0), (sch[0], 'I will bring the zone maps.', 0, ('👍',))], 20, 'Leads · screens')
dm('dm-6', [hr[0], mgr[3]], [(hr[0], 'Two resignations this month, replacement planning needed.', 0), (mgr[3], 'Understood, lets talk Thursday.', 0)], 90)
dm('dm-7', [sen[0], coach[1]], [(sen[0], 'Please prepare the report on repeated low scores.', 0), (coach[1], 'Will have it on Monday.', 0, ('👍',))], 40)
dm('dm-8', [svc[0], svc[1], mgr[4]], [(svc[0], 'Two tickets about the break room are still open.', 0), (svc[1], 'Technician comes on Wednesday.', 0), (mgr[4], 'Thank you, keep me updated.', 0, ('👍',))], 160, 'Service')
msgs.sort(key=lambda m: m['ts'])
d['totChannels'] = json.dumps(chs, ensure_ascii=False, separators=(',', ':'))
d['totMessages'] = json.dumps(msgs, ensure_ascii=False, separators=(',', ':'))
src['_meta']['note'] = os.environ.get('NOTE') or 'Demo company: about 1000 staff and employees, a full week of rotation (presenters on tables, shufflers on zones, all three shifts), plus Community channels and chats.'
src['_meta']['reason'] = 'full-demo'
json.dump(src, open(os.environ.get('OUT', 'demo/PTF-demo-backup-full.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(chs), 'channels/chats', len([m for m in msgs if m['kind'] == 'msg']), 'messages', len([m for m in msgs if m['kind'] == 'react']), 'reactions')
