# 08 · Brevo email (switched off)

**Connects to:** n8n only (see [00-how-it-all-connects.md](00-how-it-all-connects.md),
connection 17). **Right now nothing is sent.** Every email step in n8n is
disabled, and n8n no longer has a Brevo login.

---

## 1. What it is

**Brevo** (formerly Sendinblue) is an email-sending service. n8n was built to
send emails through Brevo's API: one to the prospect, one to the rep, and a
few to the manager.

| | |
|---|---|
| State | **Off since PR #5** ("Switch off all email: disable the 4 Brevo send steps, drop their credential") |
| Sender address | `justin.masiga.94@gmail.com` (verified in Brevo) |
| Sender name | "Marketing Done Right" (lead emails) or "MDR Lead Hub" (manager emails) |
| API address | `https://api.brevo.com/v3/smtp/email` |
| API key | `BREVO_API_KEY` in `.env` (kept; the n8n credential was deleted) |
| Where everyone's email goes | The reps' and manager's addresses are Gmail `+` aliases (e.g. `justin.masiga.94+ana@gmail.com`), so it would all land in your inbox |

---

## 2. Every link

| What | Link |
|---|---|
| Brevo dashboard | https://app.brevo.com/ |
| Senders (verified "from" addresses) | https://app.brevo.com/senders/list |
| API keys | https://app.brevo.com/settings/keys/api |
| Transactional email logs (what was sent, delivered, opened) | https://app.brevo.com/transactional/email/logs |
| Plan and sending limits | https://app.brevo.com/billing/account/plans |
| API reference: send an email | https://developers.brevo.com/reference/sendtransacemail |
| Brevo API getting started | https://developers.brevo.com/docs/getting-started |
| n8n credentials (where a Brevo login would go back) | http://localhost:5678/home/credentials |

Brevo's free plan allows up to 300 emails a day.

---

## 3. Which emails exist (and are off)

All text is in `n8n/lib/messages.js`.

| Email | To | When | Workflow → node (disabled) |
|---|---|---|---|
| **New lead for you** (`repEmail`) | The rep | A Hot, Warm or Needs a conversation lead is routed to them | Lead intake → **Brevo: send email** |
| **Your results** (`prospectEmail`) | The visitor (reply-to: the rep) | Every routed lead, including Not a fit | Same node |
| **Handed to you** | The new rep | A lead is reassigned | Sync a change everywhere → **Brevo: send email** |
| **Nobody has called X yet** | The manager | A lead waits over 24 h | Follow-up watch → **Brevo: email the manager** |
| **Leads yesterday: N in, M hot** | The manager | 8:00 every morning | Daily digest → **Brevo: email the manager** |

The emails are still **written** on every run (the **Write Slack, Asana and
email** and **Emails to send** nodes run); only the send step is skipped.

**Known wrong text:** because of that, the CRM timeline still says things like
"Posted to Slack, 1 email sent" (seen on MDR-1008, 4 Nov 2026). Nothing was
sent. The count comes from the emails that were written, not sent.

The visitor's results page also still promises "Carla will email you within
one business day". With email off, that only happens if a real person writes.

---

## 4. Switching email back on

Do this only if you want real emails (they go to your inbox through the `+`
aliases, and to whatever address a visitor types).

1. Check the sender is still verified: https://app.brevo.com/senders/list
2. In n8n, http://localhost:5678/home/credentials → **Create credential** →
   **Header Auth**, name it `MDR Brevo email`, header name `api-key`, value =
   `BREVO_API_KEY` from `.env`.
3. In `n8n/build.mjs`, undo what PR #5 did
   (https://github.com/tsujintsujin/mdr-lead-hub/pull/5/files):
   - put back `brevo: { httpHeaderAuth: { id: env.N8N_CRED_BREVO, name: 'MDR Brevo email' } }`
     in the `CRED` list, with the new credential's ID in `.env` as
     `N8N_CRED_BREVO` (and name the credential `MDR Brevo email`);
   - in the `http()` helper, put `brevo` back next to `crm` for header auth, and
     remove the line that gives Brevo nodes `disabled: true` instead of a
     credential.
4. `node n8n/test.js`, then `node n8n/build.mjs`.
5. Submit a test lead with your own `+` address and watch
   https://app.brevo.com/transactional/email/logs

## 5. Reading an email without sending it

1. Open any **MDR · Lead intake** run in http://localhost:5678/home/executions.
2. Click **Emails to send**: each item is a full email (to, subject,
   `htmlContent`). Copy the HTML into a file and open it in a browser to see it.

## 6. When something is wrong

| Symptom | Cause |
|---|---|
| No emails arrive | Expected: email is off |
| Timeline says "1 email sent" | Known wrong text (section 3) |
| After switching on: Brevo answers 401 | Wrong API key or header name (`api-key`) |
| After switching on: 400 "sender not valid" | The sender isn't verified in Brevo |
