# Pass to the Floor · Gunda

Two editions of the same tool. **Say which one when you ask for a change.**

| | **Single-file edition** | **Server Edition** (`ptf-gunda-server/`) |
|---|---|---|
| What it is | one HTML file (`tool/PTF-pass-to-floor-Gunda.html`) + a Google Apps Script (`tool/Code.gs`) + the employee page (`index.html`) | the same tool and the same permission rules, hosted on a server |
| For | up to a few hundred people, quick start, no IT needed | thousands of employees, hundreds of people at once, company security rules |
| Data | in each person's browser, shared through a file in Google Drive | in PostgreSQL; nothing on laptops |
| Sign-in | tool password; employees with Google | Microsoft Entra ID for everybody |
| Hosting | none (open the file) | Azure App Service + PostgreSQL + Front Door (a container, so other hosts work too) |
| Updated by | editing the single files | `ptf-gunda-server/` for server matters; features and rules are still written in the single-file edition and carried over by `npm run build` |

* Start here for the Server Edition: [`ptf-gunda-server/README.md`](ptf-gunda-server/README.md) and `ptf-gunda-server/docs/`.
* The single-file edition: [`tool/`](tool/), tests in [`tests/`](tests/), notes per version in [`docs/`](docs/), a demo company in [`demo/`](demo/).
