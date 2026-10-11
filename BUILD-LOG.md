# MDR Lead Hub — build log

Step by step: what was done, which technology does what, and every connection.

## 1. Environment

1. **Docker Desktop repair.** Docker would not start: stale Unix-socket files
   (`sailor-ingest.sock`, `engine.sock`) under `%LOCALAPPDATA%\Docker\run` and
   `%LOCALAPPDATA%\docker-secrets-engine` could not be removed. Both folders
   were renamed aside (`*.stale-<timestamp>`) and Docker started clean.
2. **Git repo** in `Resumes/WP`, branch `claude/mdr-lead-hub`.
3. **Secrets** generated into `.env` (gitignored), copy in
   `Credentials/MDR/.env`: MySQL root password, `MDR_HMAC_SECRET` (signs
   WordPress → n8n), `CRM_API_KEY` (n8n ↔ CRM), WordPress admin login.
4. **Docker Compose** (`docker-compose.yml`): `mysql:8.4` (one server, two
   databases `site_a`, `site_b`), two `wordpress:6.8-php8.3-apache`
   containers (Site A on :8081, Site B on :8082), and a `wordpress:cli`
   container for WP-CLI. The plugin folder is bind-mounted into both sites,
   so one codebase serves both. Secrets reach WordPress as PHP constants via
   `WORDPRESS_CONFIG_EXTRA`.
5. **WordPress installed** on both with WP-CLI `wp core install`.

## 2. Accounts and connections

6. **Asana personal access token** "MDR Lead Hub n8n" created in Chrome at
   app.asana.com/0/my-apps (Justin's own workspace "My workspace",
   1219383696818202). Verified with `GET /users/me`.
7. **Asana project "MDR Lead Follow-ups"** (board view) created through the
   API, with sections *Hot - call within 24h*, *Needs a conversation*,
   *Contacted*, *Booked*. n8n files a task per lead that needs a person.
8. **Slack app "MDR Lead Hub"** (A0C8DB0RFMG) created from a JSON manifest in
   Chrome and installed into Justin's workspace *Group 10*. Bot scopes:
   `chat:write`, `chat:write.public`, `channels:manage`, `channels:read`,
   `channels:join`, `users:read`. Interactivity (button clicks) points to
   `https://mdr-hooks.thejobstash.com/webhook/mdr-slack`. Bot token and
   signing secret are in `.env`; the signing secret is what n8n uses to
   prove a button click really came from Slack.
9. **Slack channels** created by the bot and Justin invited: `#leads-healthcare`,
   `#leads-nonprofit`, `#leads-home-services`, `#leads-general` (one per
   rep's territory), `#mdr-ops` (alerts, errors), `#mdr-daily` (digest).
10. **Cloudflare Tunnel `mdr-hooks`** (`tunnel/cloudflared.yml`): the PC dials
    out to Cloudflare, so nothing opens a port. Only `/webhook/mdr-slack` and
    `/webhook/mdr-asana` pass; the n8n editor and every other webhook return
    404. Hostname `mdr-hooks.thejobstash.com` (the zone cloudflared's
    certificate can write; a first attempt on justin94.space left a harmless
    stray record `mdr-hooks.justin94.space.thejobstash.com` → 404).
11. **Email** goes through Brevo's API (sender justin.masiga.94@gmail.com,
    already verified there). The fake reps' addresses are Gmail plus-aliases
    (`justin.masiga.94+ana@gmail.com`), so every routed email lands in
    Justin's inbox for the Loom.
12. **Google Sheet "MDR Lead Hub"** created through n8n's existing Google
    credential: tab **Team** is the routing roster (rep, email, industries
    covered, Slack channel, role, active) that n8n reads for every lead —
    change routing here, no code; tab **Leads** is the live log n8n appends
    to and updates. https://docs.google.com/spreadsheets/d/1LhsJq1Y20-sje6BJFhxoDYHf1d50lLUNhsjMWGxA6QU
