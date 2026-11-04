# 00 · How it all connects

This is the map. Each part has its own guide (01 to 09). This one explains
who talks to whom, over which address, with what proof, and what happens
when one part is missing.

| # | Guide | Part |
|---|---|---|
| 01 | [01-wordpress-sites.md](01-wordpress-sites.md) | The two WordPress sites, the form plugin, Docker and MySQL |
| 02 | [02-n8n.md](02-n8n.md) | n8n and its 9 workflows (also Lighthouse and the IRS lookup) |
| 03 | [03-crm.md](03-crm.md) | The CRM (Next.js + SQLite) |
| 04 | [04-ollama.md](04-ollama.md) | Ollama and the qwen2.5:7b model |
| 05 | [05-google-sheet.md](05-google-sheet.md) | The Google Sheet (Team and Leads tabs) |
| 06 | [06-slack.md](06-slack.md) | Slack, workspace MDR Demo |
| 07 | [07-asana.md](07-asana.md) | Asana, project MDR Lead Follow-ups |
| 08 | [08-brevo-email.md](08-brevo-email.md) | Brevo email (switched off) |
| 09 | [09-cloudflare-tunnel.md](09-cloudflare-tunnel.md) | The Cloudflare Tunnel |
| 10 | [10-how-leads-are-rated.md](10-how-leads-are-rated.md) | How a lead is scored, graded and routed (n8n rules + Ollama) |

---

## The one rule that explains the whole design

**n8n is the only part that talks to everything.** Every other part talks to
n8n and nothing else (one exception: n8n also calls the CRM's API, and the CRM
calls n8n back). WordPress doesn't know Slack exists. Slack doesn't know the
CRM exists. When anything changes anywhere, it goes to n8n, and n8n tells the
rest.

```
                          ┌─────────────────────┐
   Site A :8081 ──┐       │                     │──► Slack API (post, update, thread)
                  ├─────► │        n8n          │──► Asana API (tasks, projects)
   Site B :8082 ──┘ ◄──── │    localhost:5678   │──► Google Sheets API (read Team, write Leads)
      (form + results)    │                     │──► Brevo API (email, switched off)
                          │                     │──► Ollama :11434 (the AI)
   CRM :3090  ◄─────────► │                     │──► Lighthouse (local Chrome)
                          │                     │──► ProPublica (IRS records)
                          └─────────────────────┘
                                    ▲
                                    │ only /webhook/mdr-slack and /webhook/mdr-asana
                          Cloudflare Tunnel (mdr-hooks.thejobstash.com)
                                    ▲
                          Slack button clicks, Asana task changes
```

---

## Every connection, one by one

Each row is a real call the system makes. "Proof" is how the receiver knows
the caller is who it claims to be.

| # | From → To | Address used | What travels | Proof |
|---|---|---|---|---|
| 1 | Visitor's browser → WordPress | `POST /wp-json/mdr/v1/submit` on 8081 or 8082 | The form answers | None (it's public), but rate-limited: 6 per IP per 10 min, honeypot field, and forms filled in under 2.5 s are silently dropped |
| 2 | WordPress → n8n | `http://host.docker.internal:5678/webhook/mdr-intake` | The submission + a callback address | HMAC-SHA256 signature with `MDR_HMAC_SECRET`, headers `X-MDR-Timestamp` and `X-MDR-Signature`, valid 5 minutes |
| 3 | n8n → WordPress | `http://localhost:808x/wp-json/mdr/v1/result` | Results for the visitor's page (twice: once after the website check, once with the rep's name) | The same HMAC, other direction |
| 4 | Visitor's browser → WordPress | `GET /wp-json/mdr/v1/status/<token>` | The results page asks "anything new?" every few seconds | The 32-character token only the visitor has |
| 5 | n8n → CRM | `http://localhost:3090/api/...` | Create lead, update lead, add timeline events, look up duplicates, workload, past corrections, stats | `Authorization: Bearer <CRM_API_KEY>` (n8n credential **MDR CRM API**) |
| 6 | CRM → n8n | `http://localhost:5678/webhook/mdr-crm-event` | "A person changed this lead" (stage, verdict, reassign) | Header `X-MDR-Key: <CRM_API_KEY>` |
| 7 | CRM → n8n | `http://localhost:5678/webhook/mdr-roster` | "Who's on the team?" (for the Team page) | Header `X-MDR-Key` |
| 8 | n8n → Ollama | `http://127.0.0.1:11434/api/chat` | The lead description, the past corrections, a JSON schema | None needed, it only listens on this PC |
| 9 | n8n → Lighthouse | runs `node tools/lh.mjs <address>` on this PC | The visitor's website address (base64, so it can't inject shell commands) | Local |
| 10 | n8n → ProPublica | `https://projects.propublica.org/nonprofits/api/v2` | The nonprofit's name and state | None, it's a free public API |
| 11 | n8n → Google Sheets | Google Sheets API | Read the Team tab, add/update rows in the Leads tab | Google OAuth (n8n credential **Google Sheets TheJobStash**) |
| 12 | n8n → Slack | `https://slack.com/api/chat.postMessage`, `chat.update`, `users.info` | Lead cards, thread notes, alerts, the daily summary | Bot token (n8n credential **MDR Slack bot**) |
| 13 | Slack → n8n | `https://mdr-hooks.thejobstash.com/webhook/mdr-slack` → tunnel → `localhost:5678` | A button click | Slack signing secret (HMAC `v0=` signature, 5-minute window) |
| 14 | n8n → Asana | `https://app.asana.com/api/1.0/...` | Create tasks, move them between columns, complete them, create onboarding projects | Personal access token (n8n credential **MDR Asana**) |
| 15 | Asana → n8n | `https://mdr-hooks.thejobstash.com/webhook/mdr-asana` → tunnel → `localhost:5678` | "A task changed" | Asana's `X-Hook-Secret` handshake, then `X-Hook-Signature` |
| 16 | n8n → n8n | `http://127.0.0.1:5678/webhook/mdr-crm-event` | Slack and Asana workflows hand changes to the sync workflow | `X-MDR-Key` |
| 17 | n8n → Brevo | `https://api.brevo.com/v3/smtp/email` | Emails | **Switched off.** The nodes are disabled |

Why `127.0.0.1` and not `localhost` for n8n calling itself: on Windows,
`localhost` can resolve to the IPv6 address first, and n8n only listens on
IPv4. Why `host.docker.internal` for WordPress: WordPress runs inside Docker,
where `localhost` means the container itself, not your PC.

---

## The three journeys

### Journey 1: a new lead (left to right)

1. Visitor fills in the form on Site A or B. **(01)**
2. The plugin saves it in WordPress, signs it, sends it to n8n. **(01 → 02)**
3. n8n checks the signature, asks the CRM "have we seen this email or website
   before?" **(02 → 03)**
4. n8n opens the visitor's website, runs Lighthouse, and for nonprofits looks
   them up at ProPublica. **(02)**
5. n8n sends these results back to WordPress; the visitor's results page fills
   in. **(02 → 01)**
6. n8n scores with fixed rules, then asks Ollama for its opinion, giving it the
   team's past corrections from the CRM. **(02 → 03, 02 → 04)**
7. n8n reads the Team tab of the Sheet and asks the CRM how many open leads each
   rep has, and picks the rep. **(02 → 05, 02 → 03)**
8. n8n saves the lead in the CRM. **(02 → 03)**
9. n8n posts it in the rep's Slack channel, creates an Asana task (Hot and
   Needs a conversation only), adds a row to the Sheet. **(02 → 06, 07, 05)**
10. n8n stores the Slack and Asana links on the CRM lead, and tells WordPress the
    rep's name so the visitor sees it. **(02 → 03, 02 → 01)**

### Journey 2: someone changes a lead (any direction)

Wherever the change starts, it ends in the **MDR · Sync a change everywhere**
workflow, which updates every other place.

| Change starts in | How it reaches n8n | What then gets updated |
|---|---|---|
| CRM (stage button, drag on Pipeline, correct verdict, reassign) | CRM saves it, then calls `mdr-crm-event` | Slack card + thread note, Asana task, Sheet row, CRM timeline |
| Slack (Mark contacted, Booked a call, Not a fit) | Slack → tunnel → `mdr-slack` → CRM saved → `mdr-crm-event` | Same as above |
| Asana (tick a task done, or drag it to Contacted / Booked) | Asana → tunnel → `mdr-asana` → CRM saved → `mdr-crm-event` | Same as above |

The CRM is always saved first. It is the record of truth; Slack, Asana and the
Sheet are copies. A lead is never moved backwards by an Asana event, which also
stops Asana and n8n from bouncing the same change back and forth.

When the stage becomes **Won**, the sync also creates a whole onboarding project
in Asana with 6 dated tasks.

### Journey 3: things that run on a clock

| When | Workflow | Reads from | Writes to |
|---|---|---|---|
| Every hour | MDR · Follow-up watch | CRM (Hot/Warm/Needs a conversation leads still New, nobody contacted, older than 24 h), Sheet (who the manager is) | Slack `#mdr-ops`, a nudge in the lead's Slack thread, CRM (marked escalated, so each lead is flagged once) |
| 8:00 every morning, New York time | MDR · Daily digest | CRM (last 24 h stats, leads still waiting), Sheet | Slack `#mdr-daily` |

Both have a "run it now" address (see [02-n8n.md](02-n8n.md)).

---

## What breaks when a part is missing

| If this is off | What still works | What stops |
|---|---|---|
| Docker (both sites) | CRM, Slack, Asana, Sheet, the clocks | No new leads at all. The forms don't exist |
| n8n | Sites show the form and accept it; CRM screens work | Nothing is scored or routed. Submissions wait in WordPress (state **Waiting to retry**) and are re-sent every 5 minutes, up to 12 tries (about an hour). After that they stay in WordPress until sent by hand. CRM changes don't reach Slack/Asana/Sheet (the lead's timeline shows **sync_failed**). The CRM Team page says it couldn't read the roster |
| CRM | Sites accept forms | n8n's intake fails at the duplicate check, so leads aren't routed; the clocks fail (this happened on 3 and 4 Nov 2026) |
| Ollama | Everything else | Leads are scored by rules only and every non-spam lead becomes **Needs a conversation**, with the reason "The AI step did not answer" |
| Google Sheet (or its login) | — | Routing can't read the Team tab, so intake fails at the routing step |
| Slack token | CRM, Asana, Sheet | No Slack posts. Slack answers "not ok" instead of an error, so the run carries on and the lead's CRM timeline records the Slack failure |
| Tunnel | Everything inside the PC | Slack button clicks and Asana changes don't come back. The CRM → Slack/Asana direction still works |
| Brevo | Everything | Already off, so nothing changes |

---

## Where each secret lives

Never paste the values anywhere. This is where to find them.

| Secret | Used by | Stored in |
|---|---|---|
| `MDR_HMAC_SECRET` | WordPress ↔ n8n signatures | `.env` (→ Docker → `wp-config.php` constant); injected into n8n Code nodes by `build.mjs` |
| `CRM_API_KEY` | n8n ↔ CRM | `.env`, `crm/.env.local`, n8n credential **MDR CRM API** |
| `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET` | n8n ↔ Slack | `.env`, n8n credential **MDR Slack bot**; signing secret injected by `build.mjs` |
| `ASANA_PAT` | n8n → Asana | `.env`, n8n credential **MDR Asana** |
| Google login | n8n → Sheets | n8n credential **Google Sheets TheJobStash** (OAuth, no file) |
| `BREVO_API_KEY` | n8n → Brevo | `.env` only (the n8n credential was removed when email was switched off) |
| Tunnel credentials | cloudflared | `C:\Users\justi\.cloudflared\0ce19fa5-3c29-46ea-a17c-1843ccc0d8d3.json` |
| WordPress admin password, MySQL root password | WordPress | `.env` |

Master copy of `.env`: `D:\AIO Freelance\Credentials\MDR\.env`.

---

## Starting and stopping

- **Start:** Docker Desktop running (start it with
  `C:\Users\justi\Scripts\start-docker.ps1`), Ollama running, then double-click
  `start.cmd`. It starts the sites and opens n8n, the CRM and the tunnel in their
  own windows.
- **Stop:** close the n8n, CRM and tunnel windows; `docker compose stop` in this
  folder stops the sites (the data stays).
- **Order matters only once:** start n8n and the CRM before submitting a form.
