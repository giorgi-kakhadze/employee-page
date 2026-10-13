#!/usr/bin/env python3
"""200 fictional game presenters and shufflers for trying the schedule and rotation.
   Upload demo/PTF-fake-employees-200.xlsx on Home -> Employee Data Source -> Import Excel / CSV.   python3 demo/make-fake-employees.py"""
import random, openpyxl
from openpyxl.styles import Font
random.seed(40)
first = "Giorgi Nino Luka Mariam Davit Tamar Nika Ana Sandro Eka Irakli Salome Levan Natia Zura Keti Tornike Nutsa Gela Lali Beka Mzia Otar Tinatin Shota Maka Vakhtang Dali Revaz Nana Archil Ketevan Lasha Diana Temur Elene Gocha Sopo".split()
last = "Beridze Kapanadze Gelashvili Maisuradze Lomidze Chkheidze Tsiklauri Mamaladze Bakradze Kvaratskhelia Gabunia Iashvili Javakhishvili Tabatadze Nozadze Sulaberidze Chikovani Gvenetadze Kobakhidze Gogoladze Khutsishvili Dolidze Jorjadze Meskhi Abashidze".split()
games = ["Blackjack", "Roulette", "Baccarat", "Game Show", "Poker"]
rows, used = [], set()
TN = {1: "Team One", 2: "Team Two", 3: "Team Three", 4: "Shufflers"}
def person(i, pos, badge, team, shift, st):
    while True:
        n = random.choice(first) + " " + random.choice(last)
        if n not in used: used.add(n); break
    f, l = n.split()
    wid = "E%d" % (20001 + i)
    return [n, f + " " + l[0] + ".", wid, wid, "Employed", pos, badge, TN[team], shift, st,
            "+995 5%02d %02d %02d %02d" % (random.randint(10, 99), *[random.randint(0, 99) for _ in range(3)]),
            "%s.%s%d@example.com" % (f.lower(), l.lower(), i), "%d-%02d-%02d" % (random.choice([2024, 2025, 2026]), random.randint(1, 9), random.randint(1, 28)),
            ", ".join(random.sample(games, 2)) if pos == "Game Presenter" else "", random.choice(["English", "English, Georgian", "English, Russian", "Georgian"]), random.choice(["Female", "Male"]), "Mariami Beridze" if team in (1, 4) else "Luka Chkheidze"]
i = 0
shifts = ["Morning", "Afternoon", "Night"]
# 150 game presenters: 3 shifts x 2 sets x 25; badges mixed; teams One, Two, Three rotate
badges = ["VIP"] * 12 + ["Premium"] * 30 + ["Beginner"] * 18 + [""] * 90; random.shuffle(badges)
for sh in shifts:
    for st in ["Set 1", "Set 2"]:
        for k in range(25):
            rows.append(person(i, "Game Presenter", badges[len(rows) if len(rows) < 150 else 0], 1 + (k % 3), sh, st)); i += 1
# 50 shufflers: team Shufflers (set up zones for this team), about 8 per shift and set (+2 extra)
for sh in shifts:
    for st in ["Set 1", "Set 2"]:
        for k in range(8):
            rows.append(person(i, "Shuffler", "", 4, sh, st)); i += 1
for k in range(2):
    rows.append(person(i, "Shuffler", "", 4, "Morning", "Set 1")); i += 1
random.shuffle(rows)
hdr = ["Full Name", "Screen Name", "Workday ID", "Barcode", "Status", "Position", "Badge", "Team", "Shift", "Set", "Phone", "Email", "Start Date", "Games", "Languages", "Gender", "Team Manager"]
wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Employees"; ws.append(hdr)
for c in ws[1]: c.font = Font(bold=True)
for r in rows: ws.append(r)
for col, w in zip("ABCDEFGHIJKLMNOPQ", [24, 16, 11, 11, 10, 16, 10, 8, 11, 7, 18, 34, 12, 22, 20, 8, 18]): ws.column_dimensions[col].width = w
ws.freeze_panes = "A2"; wb.save("demo/PTF-fake-employees-200.xlsx")
import csv
with open("demo/PTF-fake-employees-200.csv", "w", newline="", encoding="utf-8-sig") as f:
    w = csv.writer(f); w.writerow(hdr); w.writerows(rows)
print(len(rows), "people")
