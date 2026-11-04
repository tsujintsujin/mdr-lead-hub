# 07 · Asana (project MDR Lead Follow-ups)

**Connects to:** n8n, both ways. n8n creates and moves tasks through Asana's
API; Asana tells n8n about task changes through a webhook that comes in via
the Cloudflare Tunnel (see [00-how-it-all-connects.md](00-how-it-all-connects.md),
connections 14 and 15).

> **State on 4 Nov 2026: the Asana → n8n direction is broken.** Asana's list of
> webhooks for the project is empty, so ticking or dragging a task in Asana
> changes nothing in the CRM. n8n → Asana (creating, moving, completing tasks)
> still works. Asana deletes a webhook after its address keeps failing, which
> fits the tunnel having been off. Section 7 says how to register it again.

---

## 1. What it is

Your own Asana workspace, with one project the demo uses.

| | |
|---|---|
| Workspace | "My workspace", ID `1219383696818202` (yours) |
| Project | **MDR Lead Follow-ups**, ID `1219384275693582`, board view |
| Login n8n uses | Personal access token **MDR Lead Hub n8n** |
| Tasks are assigned to | You (`ASANA_USER`), because the reps are made up. The rep's name is in the task title |
| Webhook should point to | `https://mdr-hooks.thejobstash.com/webhook/mdr-asana` |

### The board's columns (sections)

| Column | ID | A task lands here when |
|---|---|---|
| Hot - call within 24h | `1219384088804374` | A **Hot** lead arrives |
| Needs a conversation | `1219384275704786` | A **Needs a conversation** lead arrives |
| Contacted | `1219384275661981` | The lead is marked Contacted anywhere |
| Booked | `1219384045822740` | The lead is marked Booked anywhere |

**Warm, Not a fit and Spam leads get no task.** Duplicates get no task either.

---

## 2. Every link

| What | Link |
|---|---|
| The board | https://app.asana.com/0/1219384275693582/board |
| The same as a list | https://app.asana.com/0/1219384275693582/list |
| Your tasks (everything assigned to you) | https://app.asana.com/0/my-tasks |
| Personal access tokens (where the n8n token was made) | https://app.asana.com/0/my-apps |
| All your projects | https://app.asana.com/0/projects |
| The n8n credential | http://localhost:5678/home/credentials → **MDR Asana** |
| Asana API docs | https://developers.asana.com/docs/overview |
| Tasks API | https://developers.asana.com/reference/tasks |
| Sections API (moving between columns) | https://developers.asana.com/reference/sections |
| Webhooks guide | https://developers.asana.com/docs/webhooks-guide |
| Personal access tokens | https://developers.asana.com/docs/personal-access-token |

Onboarding projects ("Onboarding: <business>") are created as separate projects
in the same workspace; find them under https://app.asana.com/0/projects, or
from the link on the CRM lead's timeline.

---

## 3. What n8n does in Asana

### When a lead arrives (MDR · Lead intake)

**Asana: create follow-up task**, then **Asana: put it in the right column**:

| Field | Value |
|---|---|
| Name | Hot: "Call <contact> at <business> (<rep>)". Needs a conversation: "Talk to <contact> at <business> (<rep>)" |
| Description | Verdict and score in bold, the AI summary, the reasons as a list, the opening line, contact details, a link to the lead in the CRM |
| Assignee | You |
| Due | 24 hours after arrival (Hot), 48 hours (Needs a conversation) |
| Column | Hot - call within 24h, or Needs a conversation |

The task's link is saved on the CRM lead (`asana_task_gid`) and appears on its
timeline.

### When a lead changes (MDR · Sync a change everywhere)

| Change (from the CRM, Slack or Asana) | In Asana |
|---|---|
| Stage → Contacted | Task moved to **Contacted** + a comment |
| Stage → Booked | Task moved to **Booked** + a comment |
| Stage → Won or Lost | Task ticked complete + a comment |
| Stage → **Won** | Also creates a new project **"Onboarding: <business>"** (list view) with 6 tasks (below) |
| Verdict → Not a fit or Spam | Task ticked complete + a comment saying why |
| Reassigned | A comment "X handed this lead to Y" |

### The 6 onboarding tasks (due N days after the win)

| Clinic (Site A) | Days | Nonprofit (Site B) | Days |
|---|---|---|---|
| Kickoff call with <contact> | 1 | Kickoff call with <contact> | 1 |
| Get access: website, Google Business Profile, Analytics, Search Console | 2 | Confirm 501(c)(3) letter and Google for Nonprofits account | 2 |
| Full SEO and speed audit of <website> | 5 | Apply for (or take over) the Ad Grants account | 4 |
| Fix the checkup issues (speed, titles, local schema) | 10 | Build mission-focused campaigns and conversion tracking | 7 |
| Set up Google Ads and call tracking | 10 | Compliance check: 5% CTR, conversions, account structure | 14 |
| 30-day results review | 30 | First monthly report to <contact> | 30 |

---

## 4. What Asana tells n8n (when the webhook exists)

The webhook watches the project for two things: a task's **completed** field
changing, and a task being **added** to a section (dragged to a column).

**MDR · Asana updates** (http://localhost:5678/workflow/qSUFvJaNexOMsA4r):

1. **Handshake.** When a webhook is first created, Asana sends a header
   `X-Hook-Secret`; n8n echoes it back and stores it. After that, every event
   carries `X-Hook-Signature` (HMAC with that secret), and n8n checks it.
2. **Task changes we care about:** dragged to Contacted → stage Contacted;
   dragged to Booked → stage Booked; ticked complete while the lead is still
   New → stage Contacted.
3. Finds the lead by its task (`/api/lookup?asana_task=`), saves the change in
   the CRM, and calls Sync, which updates Slack and the Sheet.

It never moves a lead **backwards** (dragging a Booked task back to Contacted
does nothing). That also stops loops: when n8n moves a task, Asana reports it,
and n8n sees the lead is already there.

---

## 5. The token

| | |
|---|---|
| Name in Asana | MDR Lead Hub n8n |
| Made at | https://app.asana.com/0/my-apps |
| In `.env` | `ASANA_PAT` |
| In n8n | Credential **MDR Asana** |
| Other IDs in `.env` (not secret) | `ASANA_WORKSPACE`, `ASANA_PROJECT`, `ASANA_USER`, `ASANA_SEC_HOT`, `ASANA_SEC_TALK`, `ASANA_SEC_CONTACTED`, `ASANA_SEC_BOOKED`, `ASANA_WEBHOOK` (the old webhook's ID, no longer valid) |

If you make a new token: update `.env`, the master copy in
`D:\AIO Freelance\Credentials\MDR\.env`, and the **MDR Asana** credential in
n8n.

---

## 6. Try it yourself

1. Open the board: https://app.asana.com/0/1219384275693582/board
2. Open a task. Read the description and follow its CRM link.
3. In the CRM, mark that lead **Contacted**: within seconds the task moves to
   the Contacted column and gets a comment.
4. Mark it **Won** in the CRM: an "Onboarding: ..." project appears with 6
   dated tasks.
5. (Once the webhook is back) drag a New lead's task to **Booked** in Asana:
   the CRM stage, the Slack card and the Sheet follow.

## 7. Registering the webhook again

The tunnel must be running first (Asana calls the address straight away and
won't create the webhook if nothing answers). Then one of:

- **The simple way:** `node n8n/build.mjs`. At the end it checks whether the
  **Asana updates** workflow still holds a webhook secret; if not, it deletes any
  old webhook and registers a new one. It only does this when the stored secret
  is missing, so if the secret is still stored but Asana deleted the webhook (as
  now), it won't notice. In that case:
- **Directly:** register a webhook on resource `1219384275693582` with target
  `https://mdr-hooks.thejobstash.com/webhook/mdr-asana` and filters
  `task changed completed` and `task added`, through
  `POST https://app.asana.com/api/1.0/webhooks` with the token (the exact call is
  in `n8n/build.mjs`, at the end).

Check it worked: `GET https://app.asana.com/api/1.0/webhooks?workspace=1219383696818202&resource=1219384275693582`
with the token should list one webhook with `active: true`.

## 8. When something is wrong

| Symptom | Cause | Fix |
|---|---|---|
| Ticking/dragging in Asana changes nothing in the CRM | No webhook (the case on 4 Nov 2026), tunnel off, or n8n off | Section 7 |
| No task for a new lead | It was Warm, Not a fit, Spam or a duplicate (by design) | Check the verdict in the CRM |
| Intake run fails at **Asana: create follow-up task** | Token revoked or expired | New token (section 5) |
| No onboarding project after Won | The Sync run failed at **Asana: create onboarding project** | Open the Sync execution in n8n |
