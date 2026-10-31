# MDR Lead Hub — build plan

A job-application sample for **Marketing Done Right (MDR)**, Cleveland digital
agency (SEO, Google Ads incl. Ad Grants, social ads, web design; clients:
chiropractic/wellness, home services, nonprofits). Role: Junior Full Stack Dev
(WordPress, n8n, AI workflows, PageSpeed, Ubuntu/NGINX/MySQL, Git, Asana).

Justin records a Loom from the finished thing. Everything runs on his PC.

## The system

```
 Site A "Practice Growth Check"  (WordPress, Gutenberg block theme, :8081)
 Site B "Grant Ready"            (WordPress, Elementor, :8082)
        │  both: mdr-intake plugin → signed POST
        ▼
 n8n (localhost:5678)  ── all the logic ──
   W1 mdr-intake     verify → dedupe → enrich (site fetch, PageSpeed,
                     ProPublica 501c3 for site B) → results back to WP →
                     rules → Ollama qwen2.5:7b → verdict/score/reasons →
                     roster (Sheet) → assign rep → CRM → Slack → Asana →
                     email rep + prospect (Brevo) → Sheet log
   W2 mdr-slack      Slack buttons (Claim / Contacted / Not a fit)
   W3 mdr-asana      Asana webhook: task completed → CRM stage + Slack
   W4 mdr-crm-event  CRM actions: stage, override, reassign, Won → Asana
                     onboarding project, Sheet, Slack, email
   W5 mdr-followup   hourly: uncontacted > 24h → Slack + manager email
   W6 mdr-digest     daily summary → Slack + email
   W7 mdr-roster     GET roster for the CRM team page (reads Sheet)
   W8 mdr-error      any failure → Slack #mdr-ops
        ▼
 CRM (Next.js + node:sqlite, :3090) — thin: screens + DB + API
   Leads list, pipeline board, lead detail (AI reasons, audit, timeline),
   team (from Sheet), reports (source, segment, verdict, rep, overrides)
 Google Sheet "MDR Lead Hub": Team (routing roster) + Leads (log)
 Slack (Justin's workspace): #leads-<segment>, #mdr-ops, #mdr-daily
 Asana (Justin's workspace 1219383696818202): "MDR Lead Follow-ups" project,
   "Onboarding · <client>" projects on Won
 Tunnel mdr-hooks.justin94.space → only /webhook/mdr-slack, /webhook/mdr-asana
```

Decisions (from Justin, 2026-10-11): AI is local Ollama qwen2.5:7b only;
project lives in `MDRLeadHub/` (was `Resumes/WP` until 2026-10-31); repo `tsujintsujin/mdr-lead-hub` (private);
Slack + Asana are his personal empty accounts — Claude creates the app/token
in Chrome; Google Sheets reuses n8n credential "Google Sheets TheJobStash"
with a separate new spreadsheet; email via Brevo (sender
justin.masiga.94@gmail.com), reps are fake (Ana/Ben/Carla/Dana) with
`justin.masiga.94+<name>@gmail.com` addresses.

**Required by Justin:** load design skills (frontendskills → impeccable,
emil-design-eng, design-taste-frontend; frontend-design) before building
Site A, Site B and the CRM UI. Every user-facing text (site copy, emails,
Slack/Asana messages, results pages) goes through the `humanize` skill.

## Phases (each tested on 2–3 leads before the next)

1. Setup — git + GitHub, docker compose (MySQL + 2× WordPress), .env, Sheet.
2. Credentials — Asana PAT + Slack app (Chrome), n8n credentials via API,
   channels, Asana project, tunnel.
3. Plugin `mdr-intake` + Site A (Gutenberg) + Site B (Elementor). Chrome check
   desktop + 390px.
4. n8n W1 + lib tests; 3 fake leads (hot / not fit / needs talk), read verdicts.
5. CRM screens + API. Chrome check.
6. W2–W8; walk one lead through all 7 story steps across every tool.
7. Final end-to-end pass, README + CLAUDE.md, PR merged, report to Justin.

Progress lives in PROGRESS.md.

**Also required by Justin:** `BUILD-LOG.md` — a step-by-step record of what
was done, what each technology is used for, and every connection made
(who calls whom, how it is authenticated). Update it as each step lands.
