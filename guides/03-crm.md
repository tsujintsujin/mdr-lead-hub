# 03 · The CRM

**Connects to:** n8n only, both ways (see
[00-how-it-all-connects.md](00-how-it-all-connects.md), connections 5 to 7).
n8n writes leads into it; when a person changes something here, the CRM tells
n8n, and n8n updates Slack, Asana and the Sheet.

---

## 1. What it is

A small web app written for this project. It is **not** WordPress. It's the
screen the sales team works in.

| | |
|---|---|
| Address | http://localhost:3090 |
| Built with | Next.js 15 (React), TypeScript |
| Database | One SQLite file, `crm/data/crm.db` (Node's built-in `node:sqlite`, no extra library) |
| Login | None. "You are" at the bottom left picks whose name goes on your changes |
| Started by | `start-crm.cmd` (builds once if needed, then `npm run start` on port 3090) |
| Settings | `crm/.env.local` |

It is deliberately thin: screens and a database. All the "tell everyone"
work is done by n8n.

---

## 2. Every link

| Screen | Link | What you see |
|---|---|---|
| Leads | http://localhost:3090/ | Every lead. A coloured strip counts them by verdict. Filters: search (business, person, email), verdict, stage, segment, rep |
| One lead | http://localhost:3090/leads/MDR-1001 (any ID) | The full lead (section 4) |
| Pipeline | http://localhost:3090/board | Cards in columns New, Contacted, Booked, Won, Lost. **Drag a card** to change its stage. Spam and duplicates are left out |
| Team | http://localhost:3090/team | The reps, read live from the Sheet's Team tab, with each one's open leads and Slack channel |
| Reports | http://localhost:3090/reports | Last 7 / 30 / 90 days (`?days=7`) |

Sidebar links at the bottom go to the Google Sheet, Slack (MDR Demo), the
Asana board and n8n.

### Outside links

- Next.js docs: https://nextjs.org/docs
- Next.js App Router (how the `app/` folder becomes pages): https://nextjs.org/docs/app
- Server Actions (how the buttons save): https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations
- Route handlers (the `/api` routes): https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- Node's built-in SQLite: https://nodejs.org/api/sqlite.html
- To open the database file yourself: DB Browser for SQLite, https://sqlitebrowser.org/

---

## 3. The files

| File | What it does |
|---|---|
| `crm/app/page.tsx` | The Leads screen |
| `crm/app/leads/[id]/page.tsx` | One lead |
| `crm/app/leads/[id]/actions-panel.tsx` | The stage buttons, note box, correct-the-verdict and reassign forms |
| `crm/app/board/page.tsx`, `board.tsx` | Pipeline and its drag and drop |
| `crm/app/team/page.tsx` | Team |
| `crm/app/reports/page.tsx` | Reports |
| `crm/app/actions.ts` | What happens when you press a button: save, add to the timeline, tell n8n |
| `crm/app/layout.tsx`, `nav.tsx`, `me-switch.tsx` | Sidebar, menu, "You are" switch |
| `crm/app/api/...` | The API n8n uses (section 6) |
| `crm/lib/db.ts` | Opens the database and creates the tables |
| `crm/lib/leads.ts` | Every database query (list, create, update, workload, stats, corrections) |
| `crm/lib/labels.ts` | Display names for verdicts, stages, segments |
| `crm/lib/n8n.ts` | The two calls the CRM makes to n8n |
| `crm/lib/api.ts` | Checks the API key on calls from n8n |

---

## 4. One lead, section by section

Open any lead from the Leads screen.

| Section | Where it comes from |
|---|---|
| Header: business, ID, verdict, score, rep, stage | n8n, when it saved the lead |
| **What the AI made of it** | The model's summary, reasons, suggested opening line, red flags, confidence |
| **Everything that happened** | The timeline: received, scored, routed, Slack posted, Asana task, every stage change and who made it (from the CRM, Slack or Asana), notes, sync failures |
| **Contact** | Name, email, phone, website, **Came from** (the source n8n worked out), and when the visitor arrived from an ad: **Campaign** (`utm_campaign`), **Ad** (`utm_content`) and **Keyword** (`utm_term`), each only if present, then the rep |
| **Website checkup** (Site A) or **Eligibility check** (Site B) | Lighthouse speed, page basics, IRS lookup |
| **What they told us** | Every form answer |
| **Correct the AI or hand it over** | Stage buttons, a note box, correct the verdict, reassign |

---

## 5. What each action does

All of these are in `crm/app/actions.ts`. Each one saves to the database
**first**, adds a timeline entry with your "You are" name, then tells n8n
(`POST http://localhost:5678/webhook/mdr-crm-event`).

| You do | Saved in the CRM | n8n then |
|---|---|---|
| Press a stage button (New, Contacted, Booked, Won, Lost) or drag on Pipeline | Stage; first contact time if this is the first move out of New | Updates the Slack card and adds a thread note, moves the Asana task, updates the Sheet row. **Won** also creates an Asana onboarding project with 6 tasks |
| **Correct the verdict** (with a reason) | New verdict, marked "by a person"; a **correction** row with the old and new verdict and your reason | Same updates. The next 5 corrections are shown to the AI on every new lead, so it learns the team's judgement |
| **Reassign** | New rep | Updates Slack, Asana (assignee) and the Sheet |
| **Add note** | A timeline entry only | Nothing. Notes stay in the CRM |

If n8n doesn't answer, the change is still saved, and the timeline shows a
**sync_failed** entry. Slack, Asana and the Sheet stay out of date for that
change.

---

## 6. The API (what n8n calls)

Every call needs `Authorization: Bearer <CRM_API_KEY>`; without it the answer
is 401. You won't open these in a browser; they are here so you know what n8n
does.

| Method and path | Used by | Does |
|---|---|---|
| `GET /api/lookup?email=&website=` | Lead intake | Finds leads from the last **30 days** with the same email, or the same website (ignoring `https://` and `www.`). A match makes the new lead a **duplicate**: it's saved with `duplicate_of` set, gets no new Slack card (just a reply in the original's thread: "Same people again ... Nothing new got routed"), no Asana task, and is left off the Pipeline. Example: MDR-1009 duplicate of MDR-1008 (tapndine, 4 Nov 2026) |
| `GET /api/lookup?token=` / `?asana_task=` / `?slack_ts=` | Asana updates, Slack buttons | Finds the one lead linked to that WordPress token, Asana task or Slack message |
| `GET /api/examples?limit=5` | Lead intake | The latest verdict corrections, for the AI prompt |
| `GET /api/workload` | Lead intake | Open leads per rep (stage New, Contacted or Booked) |
| `POST /api/leads` | Lead intake | Creates a lead, gives it the next ID (MDR-1001, MDR-1002, ...) |
| `GET /api/leads?stale_hours=24` (and `verdict`, `stage`, `segment`, `assignee`, `q`, `limit`) | Follow-up watch, digest | Lists leads |
| `GET /api/leads/<id>` | Sync, Slack buttons | One lead with its timeline |
| `PATCH /api/leads/<id>` | Everyone | Changes fields; can add an event and a correction in the same call |
| `POST /api/leads/<id>/events` | Sync | Adds a timeline entry |
| `GET /api/stats?since=` | Daily digest | Counts for the digest and Reports |

And the two calls **the CRM makes** (`crm/lib/n8n.ts`), with header
`X-MDR-Key`:

| Call | When |
|---|---|
| `POST http://localhost:5678/webhook/mdr-crm-event` | After every stage change, verdict correction, reassign |
| `GET http://localhost:5678/webhook/mdr-roster` | When the Team page loads |

---

## 7. The database

`crm/data/crm.db`, three tables:

| Table | One row per | Main columns |
|---|---|---|
| `leads` | Lead | `id`, `business`, `contact_name`, `email`, `phone`, `website`, `segment`, `source`, `score`, `verdict` (hot, warm, talk, not_fit, spam), `verdict_by` (rules, ai, person), `assignee`, `stage` (new, contacted, booked, won, lost), `slack_channel` + `slack_ts` (which Slack message), `asana_task_gid`, `first_contact_at`, `escalated_at`, `duplicate_of`; plus JSON columns `fields` (form answers), `tracking`, `audit` (website check), `ai` (the model's answer) |
| `events` | Timeline entry | `lead_id`, `at`, `type`, `actor` ("n8n", "Slack: Ana Reyes", "CRM: Marcus Hale"), `detail` |
| `corrections` | Verdict a person changed | `lead_id`, `from_verdict`, `to_verdict`, `note`, `by` |

Don't edit it while the CRM is running. `node tools/reset-demo.mjs` empties it
(along with Slack, Asana, the Sheet and WordPress).

---

## 8. Settings (`crm/.env.local`)

| Name | Value / meaning |
|---|---|
| `CRM_API_KEY` | Shared key with n8n (secret) |
| `N8N_BASE` | `http://localhost:5678` |
| `CRM_PUBLIC_URL` | `http://localhost:3090` (used in links) |
| `SHEET_URL` | The Google Sheet, for the sidebar and Team page links |
| `SLACK_TEAM_ID` | `T0C88FA7FA7`, for the Slack link |
| `ASANA_PROJECT` | `1219384275693582`, for the Asana board link |

After changing it: close the CRM window and run `start-crm.cmd` again. After
changing the **code**, delete `crm/.next` first so it rebuilds (the script only
builds when `.next\BUILD_ID` is missing), or run `npm run build` in `crm/`.

For live reloading while you learn: close the CRM window, then in `crm/` run
`npx next dev -p 3090`.

---

## 9. The Reports screen

| Number | Meaning |
|---|---|
| leads in | All leads in the period |
| worth a rep's time | Hot + Warm + Needs a conversation |
| Median time to first contact | From received to first stage change out of New |
| verdicts a person corrected | Corrections ÷ leads scored |

Bars: where leads came from, verdicts, kind of business, stage, by rep, by
site. A line at the bottom counts leads still waiting on first contact after 24
hours.

---

## 10. Try it yourself

1. Open http://localhost:3090, pick **"You are: Carla Jimenez"** at the bottom
   left.
2. Open **Cleveland Animal Protective League** (MDR-1003, still New).
3. Press **Contacted**. The timeline gets "CRM: Carla Jimenez".
4. Open Slack `#leads-nonprofit`: the card now says Contacted, and the thread
   has a note. Open Asana: the task moved to Contacted. Open the Sheet: the
   row's Stage changed.
5. Back in the CRM, correct the verdict to **Warm** with a reason. That reason
   will appear in the AI's instructions for the next lead.
6. Go to **Pipeline** and drag the card to **Won**. An "Onboarding: Cleveland
   Animal Protective League" project appears in Asana.
7. Reset everything after: `node tools/reset-demo.mjs`, then
   `node tools/seed-demo.mjs` to get sample leads back (needs the sites running).
   The seed tool opens each site in real Chrome (hidden; add `--show` to watch),
   arriving with the lead's ad tags in the address, and types every answer and
   clicks Next and Submit like a visitor.

## 11. When something is wrong

| Symptom | Cause | Fix |
|---|---|---|
| http://localhost:3090 doesn't load | CRM window closed | Run `start-crm.cmd` |
| Team page: "Couldn't read the roster" | n8n down or **MDR · Roster** off | Start n8n; check the workflow is active |
| Timeline shows **sync_failed** | n8n didn't answer | Start n8n, then do the change again |
| My code change doesn't show | The CRM runs a production build | Delete `crm/.next` and restart, or use `npx next dev -p 3090` |
