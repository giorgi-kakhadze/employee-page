# PTF / Gunda v3.39: mass test and fixes

Files changed:
- `tool/PTF-pass-to-floor-Gunda.html`
- `tool/Code.gs`
- `index.html` (the employee page)
- `demo/employee-demo.html`
- `demo/README.md`
- tests:
  - new: `tests/hardening.test.js`, `tests/employee_page.test.js`, `tests/large_data.test.js`;
  - changed: version checks in `tests/ui_polish.test.js`, `tests/page_access.test.js` and `tests/community.test.js`.

## How it was tested
Three independent sweeps ran in parallel, and everything they confirmed was fixed:
- **Employee page:**
  - phone and laptop widths, with empty, error, offline, slow and very long-name states;
  - every request flow, with injection attempts in every text field;
  - attempts to read another employee's data;
  - the demo page over 400 random employees.
- **Server:**
  - every position, with random and hostile pushes: forged authorship, odd key names, malformed bodies;
  - 28,000 page-access checks against an independent model;
  - Community rules;
  - invariants over 30 random multi-user runs.
- **Tool screens:**
  - the admin and 5 positions, each at laptop and phone width;
  - every space, every menu item and tab, Projects, Community, the admin sections and Giorgi;
  - "view as" for all 8 positions;
  - timing with the 1,000-employee demo data.

Also checked directly: the demo backup restores completely (34 of 34 data sets), four devices posting in the same channel at once lose nothing, and the 76 scripts in the tool parse.

## Fixed: privacy and security (server)
| Finding | Fix |
|---|---|
| Two employees with the same name could see each other's retraining rows, remarks and incidents. | A record with a work ID belongs to that ID only. A name matches only when nobody else has it. |
| A terminated or retired employee still saw pay and evaluations and could send requests. | They get "This account is no longer active. Ask your manager." |
| Anyone who could see a ticket, announcement or comment could rewrite it, change its author and delete it. | The author is never changed. Announcements and comments are edited only by their author. A new record under another person's e-mail is refused. |
| Any project could e-mail any address typed into it (a mail relay). | Mail goes only to people in the access list. |
| Keys named `constructor`, `__proto__`, `toString` and so on crashed every read. | Such names are refused. |
| A malformed request returned an HTML error. | It always returns a JSON error. |
| Flow trigger URLs (`totIntegrations`) were sent to every position. | Only the admin reads them. |
| One staff account could create unlimited keys. | At most 1,200 keys. |
| The open "request access" action could flood the owner's mail and fill the list. | At most 30 requests per 10 minutes. Only waiting requests count towards the cap. |

## Fixed: Community
- **Dates:** a message cannot be dated in the future, so nobody can push older messages out of a channel.
- **Replies:** a reply needs a post in the same channel. This closes a bypass of "only managers start posts".
- **Archived channels:** they are read only, deletes included.
- **Saves:** one save adds at most 60 messages.

## Fixed: employee requests
- **Real dates only:** `2027-02-30` is refused.
- **Sick leave:** it can be reported from 14 days back up to tomorrow, not 400 days ahead.
- **Required text:** a swap needs a colleague and a pay question needs text, as the page already required.
- **Request types:** `constructor` and `toString` are no longer accepted as types.
- **Duplicates:**
  - a second pay question the same day is allowed when its text is different;
  - a swap with a different colleague is allowed;
  - a swap and a give-away for the same shift cannot both be open.
- **Notes:** they keep what was typed (`<3`, `x<y`). The pages already escape all text. They are cut on whole characters.
- **Several lists:** an e-mail on more than one employee list gets a clear message, the same in every action.

## Fixed: employee page (`index.html`)
- **Long names and e-mails** wrap, so the page no longer scrolls sideways and the buttons stay visible.
- **A failed Refresh** shows a message.
- **A half-written request** survives the 60-second refresh and tab changes. It clears after sending.
- **A finished shift** is no longer shown as the "Next shift" or offered for a swap.
- **The "Mistakes" tile label** says what it counts.
- **A partial pay record** no longer throws an error.
- **Odd request types** show "Request".

## Fixed: staff tool
- **Speed with 1,000 people:**

| Screen | Before | Now |
|---|---|---|
| Performance → Coach board | about 25 s | 0.14 s |
| FMD → Overview | about 4 s | 0.1 s |
| FMD → Bonuses & month | about 5 s | 1.6 s |

- **Escape** closes the top dialog (New ticket, View as and similar). The lock prompt is excluded.
- **The "synced" pill** moved into the header action row. It was clipped off-screen on laptop widths.

## Fixed: demo and documentation
- **Demo employee page:** request end dates are never before their start. Last-month hours never exceed 8 per shift. Today's shift agrees between the schedule and the pay list.
- **Demo README:** the employee list has 1,073 people (1,000 employees plus 73 recent hires), not 1,000.

## Known and left as is
- **Old clients:** a push without a version and with an older time is dropped without a message. The current tool always sends a version.
- **Access requests:** a wrong-password answer still reveals that an e-mail is registered. Fixing it would change what the sign-in screen can say.
- **Employee page sign-in:** the real Google token check could not be tested offline. A fake server accepted tokens of the form `gtok:<email>`.
- **Employee page timezones:** differences between the browser and the script were not tested.

## Setup
- **Deploy the new `Code.gs` as a new version.** The server fixes apply only after that.
- **No data change is needed.**
- **Terminated and retired employees** lose employee-page access immediately. Setting their status back to Employed in the employee list restores it.
