# Innovation roadmap and metrics

Every idea below uses data the tool already has, unless stated. Nothing here scores employees, watches them, or lets an AI make decisions about people.

## A. Feasible pilots (data exists)

### 1. Handover quality loop
- **Problem:** information is lost between shifts.
- **Who benefits:** shift leads, managers, staff on the next shift.
- **Data:** `totHandover` (new) — written, read, and read time. Available now.
- **Benefit / measure:** share of shifts with a saved handover; median minutes from shift start to "read". Baseline: start counting from the first week after release (there is no earlier data).
- **Effort:** S (a small report in Today or Management overview).
- **Risks:** pressure on leads to write long notes. Keep it optional and short.
- **Pilot:** one studio, 4 weeks, two shift leads per shift.

### 2. Procedure confirmation campaigns
- **Problem:** procedure changes are announced but nobody knows who read them.
- **Data:** `totDeptDocs` + `totDocAcks` (new). Available now.
- **Measure:** % of the audience confirmed within 7 days of a new version.
- **Effort:** S (e-mail reminder for "who has not", reusing the existing reminder mailer).
- **Risks:** a click is not understanding. For critical procedures, add a short Academy check.
- **Pilot:** HR leave policy + one game procedure.

### 3. Coverage forecast for the next 7 days
- **Problem:** gaps are found on the day.
- **Data:** schedule, approved leave, absences, table/zone needs. Available.
- **Measure:** number of "not covered now" events on the Today screen per week (before vs after).
- **Effort:** M. **Risk:** low. **Pilot:** FMD for one month.

### 4. Bottleneck view for tickets
- **Problem:** work waits in "Waiting for department" without anyone noticing.
- **Data:** ticket status history (exists). **Measure:** median time in each column, per department.
- **Effort:** S–M. **Risk:** must not become a ranking of individuals — show per column and department only.

### 5. Retraining follow-through
- **Problem:** retraining targets are set but not closed.
- **Data:** retraining register, evaluations. **Measure:** % of retraining items closed within the target date.
- **Effort:** S. **Safeguard:** criteria shown in full; a person can see their own items.

## B. Speculative (needs outside data or decisions)

| Idea | Missing piece |
|---|---|
| Attendance check against door access | Vendor export/API, Security owner, data-protection approval |
| Search over approved procedures in plain language | Agreement on which documents are approved; an AI service approved by IT; must cite the document and version, never answer from memory |
| Live Jira link from Service incidents | Jira API token, Server Edition |
| Studio readiness from equipment sensors | No such data today |

## C. Metrics (definitions; no results are claimed)

| Metric | Source | Calculation | Period | Owner | Limits |
|---|---|---|---|---|---|
| Overdue tickets rate | `totTasks` | open tickets with due date < today ÷ open tickets | weekly | each department head | Only tickets that have a due date |
| Approval turnaround | `totEmpRequests` | decidedAt − created, median | monthly | FMD / HR | Requests decided outside the tool are missing |
| Handover read rate | `totHandover` | handovers with ackTs ÷ handovers saved | weekly | Operations | New in this release; no baseline before |
| Procedure confirmation | `totDocAcks` | confirmed people ÷ audience, per document version | per version | document owner | Audience = people with that department's positions in Access management |
| Schedule confirmation | `totScheduleAcks` | confirmed current version ÷ people sent | weekly | FMD | Only people with an e-mail in the employee list |
| Uncovered slots | Today screen model | half-hours with a table/zone uncovered | daily | shift leads | Depends on the rotation being kept up to date |
| Backup success | admin backup log | backups downloaded ÷ planned | monthly | admin | Manual download in the single-file edition |
| Data-quality errors | imports | rows refused ÷ rows read | per import | HR / FMD | |

Baselines must be recorded after release before any improvement is claimed.
