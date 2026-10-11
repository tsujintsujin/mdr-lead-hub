# MDR Lead Hub

A working sample built for **Marketing Done Right** (Cleveland) as part of a
Junior Full Stack Developer application: two WordPress lead-capture sites, an
n8n system that qualifies and routes every lead with a local AI model, and a
small CRM, wired into Google Sheets, Slack, Asana and email.

```
 Practice Growth Check (WordPress + Gutenberg)   Grant Ready (WordPress + Elementor)
            └──────────── signed form posts ────────────┘
                               ▼
   n8n  ── website check, Lighthouse, IRS lookup, rules, Ollama qwen2.5:7b,
           routing from the Sheet, Slack / Asana / email / Sheet fan-out
                               ▼
   CRM (Next.js + SQLite) ◄── changes flow both ways ──► Slack buttons, Asana tasks
```

## Run it

1. Docker Desktop and Ollama running (`ollama list` shows `qwen2.5:7b`).
2. Double-click **`start.cmd`**. It starts the WordPress containers, n8n (if it
   isn't running), the CRM and the tunnel, each in its own window.
3. Open:
   - Practice Growth Check: http://localhost:8081
   - Grant Ready: http://localhost:8082
   - CRM: http://localhost:3090
   - n8n: http://localhost:5678 (workflows named "MDR · …")
   - WordPress admin: `/wp-admin` on either site, user `mdradmin`, password in `.env`
   - Sheet: https://docs.google.com/spreadsheets/d/1LhsJq1Y20-sje6BJFhxoDYHf1d50lLUNhsjMWGxA6QU
   - Slack: workspace MDR Demo, channels `#leads-*`, `#mdr-ops`, `#mdr-daily`
   - Asana: project "MDR Lead Follow-ups"

## Useful commands

| Command | What it does |
|---|---|
| `node tools/reset-demo.mjs` | Empty everything (CRM, Sheet leads, Asana, WordPress submissions, Slack channels) for a clean take |
| `node tools/seed-demo.mjs` | Send five realistic leads through the real form endpoints (about 5 minutes) |
| `node n8n/build.mjs` | Rebuild and push all n8n workflows from code |
| `node n8n/test.js` | Self-check of the scoring, routing and message logic |
| `curl "localhost:5678/webhook/mdr-followup-now?hours=0.05"` | Run the follow-up watch now, treating anything older than 3 minutes as overdue |
| `curl localhost:5678/webhook/mdr-digest-now` | Post the daily digest now |
| `MSYS_NO_PATHCONV=1 docker compose run --rm cli sh /repo/setup.sh` | Rebuild both WordPress sites from scratch |

## Where things are

| Path | What |
|---|---|
| `wp/plugins/mdr-intake/` | The intake plugin both sites use (forms, REST, signing, retry queue, results page) |
| `wp/themes/practice/` | Site A's block theme |
| `wp/site-b/` | Site B's Elementor page builder script and CSS |
| `n8n/` | Workflow builder, logic, tests, saved workflow JSON |
| `crm/` | The CRM |
| `tools/` | Lighthouse runner, demo reset/seed, phone screenshot helper |
| `BUILD-LOG.md` | Every step, every technology, every connection |
| `LOOM-SCRIPT.md` | What to show, in order |

Secrets live in `.env` (never committed); the source of truth is
`D:\AIO Freelance\Credentials\MDR\.env`.
