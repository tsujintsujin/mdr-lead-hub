# 06 · Slack (workspace MDR Demo)

**Connects to:** n8n, both ways. n8n posts and updates messages through
Slack's API; Slack sends button clicks back to n8n through the Cloudflare
Tunnel (see [00-how-it-all-connects.md](00-how-it-all-connects.md),
connections 12 and 13, and [09-cloudflare-tunnel.md](09-cloudflare-tunnel.md)).

---

## 1. What it is

A Slack workspace made for this demo, plus a Slack **app** (a bot) that n8n
uses to post.

| | |
|---|---|
| Workspace | **MDR Demo**, ID `T0C88FA7FA7`, created 12 Oct 2026 |
| Plan | A trial was running on 4 Nov 2026 ("6 days left in trial"). When it ends the workspace drops to Slack's free plan: posting, buttons and the bot keep working; messages older than 90 days are hidden |
| App | **MDR Lead Hub**, ID `A0C8CP9GJB0` |
| Bot can | `chat:write`, `chat:write.public`, `channels:manage`, `channels:read`, `channels:join`, `users:read` |
| Button clicks go to | `https://mdr-hooks.thejobstash.com/webhook/mdr-slack` |
| Old copy | An earlier version lived in your older workspace "Group 10" (app `A0C8DB0RFMG`); its channels were archived. The `G1_...` lines in `.env` belong to it and are not used |

---

## 2. Every link

### The workspace

| What | Link |
|---|---|
| Open MDR Demo | https://app.slack.com/client/T0C88FA7FA7 |
| `#leads-healthcare` (Ana) | https://app.slack.com/client/T0C88FA7FA7/C0C8GLYVB2M |
| `#leads-home-services` (Ben) | https://app.slack.com/client/T0C88FA7FA7/C0C8JDGM52Q |
| `#leads-nonprofit` (Carla) | https://app.slack.com/client/T0C88FA7FA7/C0C8JDHAYUC |
| `#leads-general` (Dana) | https://app.slack.com/client/T0C88FA7FA7/C0C8GLZHSP3 |
| `#mdr-ops` (alerts, errors, Marcus) | https://app.slack.com/client/T0C88FA7FA7/C0C88FRR2N7 |
| `#mdr-daily` (the morning summary) | https://app.slack.com/client/T0C88FA7FA7/C0C8GLZUCLR |
| Workspace settings | In Slack: click **MDR Demo** (top left) → **Tools & settings** → **Workspace settings** |
| Installed apps in the workspace | In Slack: **MDR Demo** → **Tools & settings** → **Manage apps** |

### The app's settings (api.slack.com)

| Page | Link | What's there |
|---|---|---|
| All your apps | https://api.slack.com/apps | |
| Basic Information | https://api.slack.com/apps/A0C8CP9GJB0/general | App ID, **Signing Secret** (n8n uses it to prove clicks are real) |
| OAuth & Permissions | https://api.slack.com/apps/A0C8CP9GJB0/oauth | **Bot User OAuth Token** (`xoxb-...`, what n8n posts with), scopes, reinstall button |
| Interactivity & Shortcuts | https://api.slack.com/apps/A0C8CP9GJB0/interactive-messages | The **Request URL** for button clicks |
| App Manifest | https://app.slack.com/app-settings/T0C88FA7FA7/A0C8CP9GJB0/app-manifest | The whole app setup as JSON/YAML |
| Install App | https://api.slack.com/apps/A0C8CP9GJB0/install-on-team | Reinstall after changing scopes |

### Learning

- Slack apps overview: https://api.slack.com/docs
- Block Kit (how the cards are built): https://api.slack.com/block-kit
- Block Kit Builder (design cards by hand): https://app.slack.com/block-kit-builder
- `chat.postMessage`: https://api.slack.com/methods/chat.postMessage
- `chat.update`: https://api.slack.com/methods/chat.update
- Button clicks (interactivity): https://api.slack.com/interactivity/handling
- Verifying requests from Slack: https://api.slack.com/authentication/verifying-requests-from-slack

---

## 3. Where each secret lives

| Secret | In `.env` | In n8n |
|---|---|---|
| Bot token | `SLACK_BOT_TOKEN` | Credential **MDR Slack bot** |
| Signing secret | `SLACK_SIGNING_SECRET` | Pasted into **MDR · Slack buttons** by `build.mjs` |
| Channel IDs | `SLACK_CH_*` | Not needed; n8n posts by channel name from the Team tab |

---

## 4. What gets posted, and by which workflow

| Message | Where | Workflow → node |
|---|---|---|
| **Lead card** (every lead except spam) | The rep's channel from the Team tab | Lead intake → **Slack: post to the rep's channel** |
| Duplicate ("Same people again ... Nothing new got routed") | As a reply in the original lead's thread | Same node |
| **Card refresh** after any change (stage, verdict, rep) | Edits the original card in place | Sync → **Slack: refresh the lead message** |
| Thread note ("Marked Contacted by Ana Reyes in the CRM") | The card's thread | Sync → **Slack: note it in the thread** |
| Overdue alert ("Nobody has called ... yet") | `#mdr-ops` | Follow-up watch → **Slack: flag it in #mdr-ops** |
| Overdue nudge | The lead card's thread | Follow-up watch → **Slack: nudge the lead thread** |
| Morning summary | `#mdr-daily` | Daily digest → **Slack: post to #mdr-daily** |
| Workflow error | `#mdr-ops` | Error alerts (switched off right now, see [02-n8n.md](02-n8n.md)) |

The text is written in `n8n/lib/messages.js` (`slackLead` and friends).

### The lead card, top to bottom

1. Verdict emoji and label + business (🔥 Hot, 🌤️ Warm, 💬 Needs a
   conversation, ❌ Not a fit).
2. Score, segment, source, and the lead ID linking to the CRM.
3. Contact and Assigned to, plus two answers: **Budget** and **Timing** (Site
   A), or **Status** (501(c)(3)) and **Ad Grants** (Site B).
4. **AI read:** the summary, then the reasons as bullets.
5. **Opening line:** what the rep should say first.
6. Buttons. Once a lead is **Won** or **Lost**, the card has no buttons.

### The buttons

| Button | Shown when | Click does |
|---|---|---|
| **Mark contacted** (green) | Stage is New | Stage → Contacted |
| **Booked a call** | Stage isn't Booked | Stage → Booked |
| **Not a fit** (red) | Verdict isn't already Not a fit | Asks "Mark as not a fit?" first, then verdict → Not a fit, saved as a correction the AI learns from |
| **Open in CRM** | Always | Opens the lead at localhost:3090 (works only on this PC) |

---

## 5. What happens when you click a button

1. Slack sends the click to the **Request URL**,
   `https://mdr-hooks.thejobstash.com/webhook/mdr-slack`.
2. Cloudflare passes it through the tunnel to n8n on this PC.
3. **MDR · Slack buttons** checks the signature (`v0=` HMAC with the signing
   secret, under 5 minutes old) and answers Slack **within 3 seconds** (or Slack
   shows an error to the person who clicked).
4. It asks Slack who clicked (`users.info`), loads the lead from the CRM,
   saves the change in the CRM, and calls **Sync a change everywhere**.
5. Sync refreshes the card (the buttons change), adds a thread note, moves the
   Asana task and updates the Sheet.

Known: the card can take 10–20 seconds to change, and sometimes only shows it
after you reload Slack. The change itself is saved at step 4.

If the tunnel is off, the click never reaches n8n and nothing changes.

---

## 6. Try it yourself

1. Open `#leads-nonprofit`: https://app.slack.com/client/T0C88FA7FA7/C0C8JDHAYUC
2. Find the **tapndine** card (from the 4 Nov test) and click **Mark contacted**.
3. Wait up to 20 seconds (reload if needed): the button disappears, the thread
   gets a note.
4. Open http://localhost:3090/leads/MDR-1008: the stage is Contacted and the
   timeline says "Slack: <your name>".
5. To see the raw request: http://localhost:5678/workflow/OtwtYOoOc3cPabd8/executions

## 7. Adding a rep's channel

1. In Slack: create the channel (e.g. `#leads-retail`).
2. In the channel: type `/invite @MDR Lead Hub`.
3. In the Sheet's Team tab: put `leads-retail` in that rep's **Slack channel**.

## 8. When something is wrong

| Symptom | Cause | Fix |
|---|---|---|
| No card for a new lead | It was spam (by design), or the bot isn't in that channel, or the token was revoked | CRM lead timeline shows the Slack result; invite the bot; check https://api.slack.com/apps/A0C8CP9GJB0/oauth |
| Clicking a button changes nothing, and no **MDR · Slack buttons** run appears | Tunnel off, or n8n off | Start them (`start.cmd`) |
| Card doesn't change after a click | Known delay | Reload Slack after 20 seconds; check the CRM, which is already right |
| "invalid_auth" in an n8n run | Bot token changed | Copy the new token into the **MDR Slack bot** credential and `.env` |
| Clicks rejected (401 in the Slack buttons run) | Signing secret changed | Update `SLACK_SIGNING_SECRET` in `.env`, run `node n8n/build.mjs` |
