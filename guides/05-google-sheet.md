# 05 · The Google Sheet

**Connects to:** n8n only (see [00-how-it-all-connects.md](00-how-it-all-connects.md),
connection 11). n8n reads the **Team** tab and writes the **Leads** tab. The
CRM never talks to Google; its Team page asks n8n, which reads the Sheet.

---

## 1. What it is

A normal Google spreadsheet called **MDR Lead Hub** with two tabs:

| Tab | Role | Who writes it |
|---|---|---|
| **Team** | The routing roster: who gets which kind of lead. **Changing a row here changes routing, no code needed** | You, by hand |
| **Leads** | A running log, one row per lead, kept up to date | n8n only |

---

## 2. Every link

| What | Link |
|---|---|
| The spreadsheet | https://docs.google.com/spreadsheets/d/1LhsJq1Y20-sje6BJFhxoDYHf1d50lLUNhsjMWGxA6QU/edit |
| Team tab | https://docs.google.com/spreadsheets/d/1LhsJq1Y20-sje6BJFhxoDYHf1d50lLUNhsjMWGxA6QU/edit#gid=1123782870 |
| Leads tab | https://docs.google.com/spreadsheets/d/1LhsJq1Y20-sje6BJFhxoDYHf1d50lLUNhsjMWGxA6QU/edit#gid=1670369092 |
| Version history (see or undo every change) | In the Sheet: **File → Version history → See version history** |
| Who it's shared with | In the Sheet: **Share** button, top right |
| The n8n credential that logs in | http://localhost:5678/home/credentials → **Google Sheets TheJobStash** |
| Google's app permissions (where you'd revoke n8n's access) | https://myaccount.google.com/connections |
| n8n Google Sheets node docs | https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.googlesheets/ |
| n8n Google login setup | https://docs.n8n.io/integrations/builtin/credentials/google/oauth-single-service/ |

IDs (not secret): spreadsheet `1LhsJq1Y20-sje6BJFhxoDYHf1d50lLUNhsjMWGxA6QU`,
Team tab `gid=1123782870`, Leads tab `gid=1670369092`. They're in `.env` as
`SHEET_ID`, `SHEET_TEAM_GID`, `SHEET_LEADS_GID`.

---

## 3. The Team tab

One row per person. n8n reads every row each time it needs the roster.

| Column | Meaning | Rules |
|---|---|---|
| **Rep** | Full name, as shown in the CRM and Slack | Required |
| **Email** | Where their emails would go (Gmail `+` aliases of your inbox) | |
| **Covers** | Which kinds of business they take, comma-separated | Use these exact codes: `healthcare_wellness`, `home_services`, `nonprofit`, `professional_services`, `retail_ecommerce`, `restaurant_hospitality`, `other`. `*` means **manager** (gets escalations, not normal leads) |
| **Slack channel** | Their channel, with or without `#` | Must exist in Slack and have the bot in it |
| **Role** | Shown in the CRM and on the visitor's results page | |
| **Active** | Anything starting with `y` (Yes) = taking leads | Anything else = skipped |

What's in it today (read live on 4 Nov 2026):

| Rep | Role | Covers | Slack channel |
|---|---|---|---|
| Ana Reyes | Account strategist | healthcare_wellness | #leads-healthcare |
| Ben Kowalski | Account strategist | home_services, retail_ecommerce | #leads-home-services |
| Carla Jimenez | Ad Grants specialist | nonprofit | #leads-nonprofit |
| Dana Price | Account strategist | professional_services, restaurant_hospitality, other | #leads-general |
| Marcus Hale | Sales manager | * | #mdr-ops |

**How routing reads it** (`pickRep()` in `n8n/lib/intake.js`):
1. Active reps (not the manager) whose Covers has the lead's segment.
2. If none: active reps covering `other`.
3. If none: the manager.
4. Of those, the one with the fewest open leads in the CRM (New, Contacted,
   Booked). On a tie, whoever is higher in the Sheet.

**Who reads the Team tab:**

| Workflow | Why |
|---|---|
| MDR · Lead intake | To route the lead |
| MDR · Sync a change everywhere | To find a rep's channel and email on reassign |
| MDR · Follow-up watch | To find the manager |
| MDR · Daily digest | To name people in the summary |
| MDR · Roster | For the CRM's Team page |

---

## 4. The Leads tab

One row per lead. n8n matches rows on **Lead ID**: a new ID adds a row, a known
ID updates it.

| Column | Filled from |
|---|---|
| Lead ID | CRM ID, e.g. MDR-1008 |
| Received | When the lead arrived, New York time |
| Site | Practice Growth Check or Grant Ready |
| Business, Contact, Email, Phone, Website | The form |
| Segment | Decided by the AI (or the form if the AI didn't answer) |
| Verdict, Score | n8n's decision |
| Assigned to | The rep |
| Stage | New, Contacted, Booked, Won, Lost (updated on every change) |
| Source | Google Ads, Organic search, Direct, ... |
| Summary | The AI's one-sentence summary |
| CRM | Link to the lead in the CRM (works only on this PC) |
| Updated | Last change, New York time |

**Written by:** **Sheet: log the lead** (Lead intake) and **Sheet: update the
row** (Sync a change everywhere). Don't type in this tab; your edits are
overwritten on the lead's next change.

---

## 5. How n8n logs in

n8n uses a Google OAuth credential named **Google Sheets TheJobStash**. It's the
same Google login your TheJobStash workflows use, which is why the name says
TheJobStash. There's no key file; Google gave n8n a refresh token when you
clicked "Sign in with Google" in n8n.

If Google ever asks you to sign in again (the token expired or was revoked):
1. Open http://localhost:5678/home/credentials.
2. Open **Google Sheets TheJobStash**.
3. Click **Sign in with Google** and accept.

The **MDR · Sheet helper** workflow lets `tools/reset-demo.mjs` clear the Leads
tab through this same login. It refuses any other spreadsheet.

---

## 6. Try it yourself

1. **Change routing without code.** In the Team tab, add `retail_ecommerce` to
   Dana Price's Covers and remove it from Ben Kowalski's. Open
   http://localhost:3090/team: the CRM now shows it. The next retail lead goes
   to Dana. (Change it back after.)
2. **Take someone off leads.** Set Ana Reyes's Active to `No`. A clinic lead now
   has no healthcare rep, so it goes to Dana (who covers `other`).
3. **Watch a row update.** Change a lead's stage in the CRM and watch the
   Leads tab's Stage and Updated cells change within a few seconds.

## 7. When something is wrong

| Symptom | Cause | Fix |
|---|---|---|
| Leads stop being routed; the intake run fails at **Sheet: team roster** | Google login expired | Reconnect the credential (section 5) |
| A rep never gets leads | Active isn't "Yes", Covers has a typo, or someone with fewer open leads covers the same segment | Check the row against section 3 |
| A lead goes to the manager | No active rep covers its segment or `other` | Add the segment to someone's Covers |
| Slack post fails for a rep | Their Slack channel is wrong or the bot isn't in it | Fix the column; invite the bot (see [06-slack.md](06-slack.md)) |
| The CRM Team page says it couldn't read the roster | n8n down, or **MDR · Roster** off | Start n8n; check the workflow |
