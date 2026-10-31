# CLAUDE.md — MDR Lead Hub (`MDRLeadHub/`)

A job-application demo for Marketing Done Right: two WordPress sites (Docker),
n8n workflows (all the logic), a Next.js + SQLite CRM, wired to Google Sheets,
Slack (workspace MDR Demo), Asana (Justin's personal workspace) and Brevo email.
Read `README.md` (how to run) and `BUILD-LOG.md` (every step and connection).

Rules for this project:
- **AI is local only**: Ollama `qwen2.5:7b`. Never a paid API.
- **n8n workflows are built from code.** Edit `n8n/build.mjs` / `n8n/lib/*`, run
  `node n8n/test.js`, then `node n8n/build.mjs`. Don't hand-edit workflows in the
  n8n editor; the next build overwrites them.
- **WP-CLI**: every command needs `WORDPRESS_DB_NAME=site_a|site_b` (the cli
  container sees both sites). Use `MSYS_NO_PATHCONV=1` from Git Bash.
- **n8n calling itself** uses `127.0.0.1:5678`, not `localhost` (IPv6 on Windows).
- **Visitor-facing text** (sites, emails, Slack) goes through `/humanize`.
- **Phone-width checks**: `node tools/mobile-shot.mjs <url> <out.png>` (real
  Chrome, device emulation). The attached Chrome window is maximized and
  ignores resizing.
- Secrets: `.env` here, source of truth `Credentials/MDR/.env`. Never commit.
- Long-running pieces run in their own windows via `start.cmd`, never as a
  Claude background task.
