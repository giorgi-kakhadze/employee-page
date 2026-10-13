# Load test

**What this is:** the real server (separate process, PostgreSQL 16) filled with **5,365 fictional people on 4 locations** (one of 2,146, three of 1,073 — `scripts/scale-demo.js`, built from the demo company), and simulated users: staff who open the tool (full data), keep the live channel, pull after every notice, and save edits (35 % chat message, 25 % remark, 30 % ticket, 10 % schedule edit by coordinators, one save per person about every 45 s, which is **busier than real use**); and employees refreshing their own page every 40–80 s. Run it yourself: `node loadtest/run.js --staff 500 --employees 300 --ramp 240 --duration 120 --workers 2 --instances 1`.

**Read this first.** Everything ran on **one 4-core machine**: the server(s), PostgreSQL and two load-generator processes shared the same 4 cores. Latencies seen by the simulated users (client side) therefore include time the generators themselves waited for CPU; they are an upper bound. The *server-side* numbers (time from request arriving to answer sent) and the server's own CPU are the ones to plan from. I did **not** test on Azure hardware, a network, real browsers in numbers, or a second PostgreSQL node.

## Results

| | **A. steady, 1 instance** | **B. everybody at once, 2 instances** |
|---|---|---|
| staff online / employees | 500 / 300 | 500 / 300 |
| arrival | spread over 240 s, then 120 s steady | all within 60 s, then 90 s steady |
| server CPU (average, % of one core, incl. compression threads) | 73 % | 61 % and 44 % |
| memory (largest) | 1421 MB | 1284 MB per instance |
| event-loop delay, worst p99 over a 5 s window | 239 ms | 321 ms |
| **server-side: open the tool (full data, 4–9 MB)** p50 / p95 | 91.5 / 279 ms | 99.3 / 235 ms |
| server-side: what changed (pull) p50 / p95 | 158 / 472.4 ms | 289.6 / 542.5 ms |
| server-side: save p50 / p95 | 44.6 / 227.8 ms | 104.9 / 323.6 ms |
| server-side: employee page data p50 / p95 | 87.9 / 254.7 ms | 154 / 315.3 ms |
| client-side (upper bound): pull after a notice p50 / p95 | 235.8 / 2578.8 ms | 339.9 / 7471.1 ms |
| client-side: open the tool p50 / p95 | 56.7 / 1634.5 ms | 62.9 / 1776.6 ms |
| errors (failed requests) | 0 | 0 |
| saves that met a conflicting save and were merged and retried | 864 | 412 |

The permission rules themselves are cheap: median **0.7 ms** for a pull, **1.2 ms** for a save, **3 ms** for an employee page (95th percentile 2, 10 and 8 ms).

## What it means
* **500 people using the tool at once on 5,000 employees works** in this test, with no failed request and no lost update. One instance used about three quarters of one core on average. For production use at least two instances (availability, and headroom for the moment a whole shift opens the tool).
* **The heaviest thing is opening the tool** (everything the person may see: 4–9 MB, about 450 KB compressed). It is built once per person per page load, with a cap of 6 at a time; the others wait their turn. 500 people opening it in one minute (B) is the worst case and still finished, but the last ones waited seconds.
* **The heaviest thing afterwards is the monthly schedule** (2 MB per location): whenever a coordinator saves it, everybody on that location downloads the new version (about 250 KB compressed). This is the cost of keeping the tool's "one document per screen" storage. If coordinators edit all day, expect traffic from this; it is not a CPU problem at this size.
* **Messages in Community** work the same way (the whole channel list is one document up to 1,500 messages), so a very chatty workforce costs bandwidth. Teams is the better place for heavy chat.

## What changed because of the test
The first full-size run (500 staff on one instance) overloaded the server: pauses of 4–10 s and 3 GB of memory. Profiling showed three causes, all fixed: the access policy and lists were parsed again for every request (now once per version); big values were re-escaped and re-compressed for every person (now escaped once and pasted in); and every change made every user download every filtered list again (now only lists whose own data or whose dependencies changed, and only for the person's location). The employee page went from 78 ms to 3 ms per request. Notices to browsers are now per location.

## Limits of this test
No browsers (the cost of the tool's own screens on a laptop is not measured; the demo data renders in about a second), no Azure network, no PostgreSQL failover, no Front Door, a single data set shape (the demo company scaled up), and chat-heavy usage above real life. Repeat the test on the real hardware before the first day with all locations (`DEPLOYMENT-AZURE.md`, step 7).
