# Department improvement plan

Classification used: **Working** · **Defective (fixed)** · **Partial** · **Missing, valuable** · **Not appropriate here** · **Depends on an outside system or a policy decision**.
Effort: S = up to 2 days, M = up to 2 weeks, L = more. Priority: P1 next release, P2 next quarter, P3 later.

## Operations and Game Operations
| Item | State | Value / risk | Effort | Priority |
|---|---|---|---|---|
| Shift handover kept, read by next shift | **Implemented in this audit** (Today screen) | Fewer "nobody told me"; traceable | — | done |
| Procedures (SOPs) with version, review date, read-and-confirm | **Implemented in this audit** (department documents) | Proof that staff saw the current version | — | done |
| Incident escalation | Working (Service incidents, tickets with priority and due date) | — | — | — |
| Daily table/studio readiness checklist | Missing, valuable | Catch faults before opening; needs the checklist content from Operations | M | P2 |
| Operational notices | Working (announcements, information board on TVs) | — | — | — |

## FMD, Scheduling, Attendance, Workforce
| Item | State | Notes | Effort | Priority |
|---|---|---|---|---|
| Schedules, rotations, zones, mentors, cover, swaps, open shifts, leave requests | Working (tested) | — | — | — |
| Absence wiping the rotation | Defective, fixed (E-01) | | — | done |
| Scheduled time vs actual attendance | Partial | The tool records what leads enter (absent, called in). It is **not** attendance evidence. | — | — |
| Door access / fingerprint data | Depends on outside system | Needs the access-control vendor's export or API, an owner in Security, and a data-protection decision. Not connected; nothing in the tool claims it is. | L | P3 |
| Overtime and pay | Depends on policy | The pay export uses the rates the company enters; the tool does not invent rules. | — | — |

## Academy, Training, Onboarding
| Item | State | Notes | Effort | Priority |
|---|---|---|---|---|
| Groups, workshops, exams, checklists, logbooks, ID cards, retraining | Working | — | — | — |
| Training-material versions | Partial | Documents now carry a version and confirmation; workshop material itself has no version history. | M | P2 |
| Trainer workload / room capacity view | Missing, valuable | Data exists (groups, trainers, dates); a capacity view is feasible. | M | P2 |

## Performance and Quality
| Item | State | Notes | Effort | Priority |
|---|---|---|---|---|
| Evaluations, coaching, follow-ups, remarks, bonuses | Working | Month counts fixed for local time (F-03) | — | done |
| Trend view per criterion (team level) | Missing, valuable | Must show criteria and counts, never a single opaque score | M | P2 |

## Human Resources
| Item | State | Notes | Effort | Priority |
|---|---|---|---|---|
| Lifecycle, requests, documents | Working | — | — | — |
| Policy acknowledgements | **Implemented in this audit** | Mark a document "staff must read and confirm" | — | done |
| HR master data | Depends on outside system | Microsoft Dynamics 365 import is built and needs company settings (see integration plan). The tool is **not** an HRIS. | S (config) | P1 |

## Recruiting
| Item | State | Notes | Effort | Priority |
|---|---|---|---|---|
| Candidate stages, workbooks | Working | — | — | — |
| Hand-off of hired candidates to Academy onboarding | Partial — not automatic; the hired person is added to an onboarding group by hand | Removes double entry | S | P2 |
| Retention rule for candidate data | Missing; depends on a policy decision | HR/Legal must set the period; then an "anonymise after N months" job is S | S | P1 once decided |

## Appearance and Uniforms
| Item | State | Notes | Effort | Priority |
|---|---|---|---|---|
| Stock by item/size, issue/return, history | Working | — | — | — |
| Automatic link to the schedule | Not implemented — and not claimed | | — | — |

## Finance and Payroll
| Item | State | Notes |
|---|---|---|
| Pay export for the payroll system | Working | Prepares data only; rates and rules come from Finance. |
| Payroll calculation rules | **Not appropriate here** | Stays in the approved payroll system. |

## IT and Technical Support
| Item | State | Notes | Effort | Priority |
|---|---|---|---|---|
| Ticket intake, priority, owner, due date, history, escalation | Working | — | — | — |
| Service targets (SLA timers) per work type | Partial | Due dates exist; per-type targets would be S–M | M | P2 |
| Jira sync | Depends on outside system | CSV import only today. Live sync needs a Jira API token owned by IT and the Server Edition. | M | P3 |

## Service Managers / Customer Support
| Item | State | Notes |
|---|---|---|
| Incidents, import, reports, ownership | Working | Player/customer personal data should **not** be entered; incidents hold operational facts. |
| Knowledge articles | Partial | Department documents with versions cover this now. |

## Management / Department Heads
| Item | State | Notes |
|---|---|---|
| Overview across departments (open, overdue, escalated, waiting, done in 7 days) | Working | Each number is a count of records you can open; definitions in `07-innovation-roadmap.md` § metrics. |
| Document confirmation status | **Implemented in this audit** ("x of y confirmed", "who has not") | |

## Junior and Senior Team Leaders
| Item | State |
|---|---|
| Today screen (who is where, gaps, breaks, absences, unconfirmed) | Working |
| Handover with read receipt | **Implemented in this audit** |
| Approval limits | Partial — positions decide what can be edited; there are no money/amount limits (not needed today). |

## Project Management
Working (projects, items, teams, approvals, board). Do **not** extend into a Jira replacement; link to Jira items instead.

## Cross-department workflows
| Workflow | State |
|---|---|
| Recruitment → onboarding | Partial (manual re-entry into an onboarding group) |
| Termination case → HR, Access, IT tickets | Working (case with linked tickets, tested in `sync_privacy`) |
| Schedule change → staffing cover | Working (cover planner, Today screen) |
| Procedure change → staff confirmation | **New** |
| Shift → next shift | **New** |
| Uniform issue → return | Working |
| Training → access approval | Partial — Academy result does not open an Access ticket automatically; S effort with work types | 
