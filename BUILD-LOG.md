# MDR Lead Hub — build log

Step by step: what was done, which technology does what, and every connection.
Built overnight 2026-10-11 → 2026-10-12.

## 1. Environment

1. **Docker Desktop repair.** Docker would not start: stale Unix-socket files
   (`sailor-ingest.sock`, `engine.sock`) under `%LOCALAPPDATA%\Docker\run` and
   `%LOCALAPPDATA%\docker-secrets-engine` could not be removed. Both folders
   were renamed aside (`*.stale-<timestamp>`) and Docker started clean.
2. **Git repo** in `Resumes/WP`, private GitHub repo `tsujintsujin/mdr-lead-hub`,
   work on branch `claude/mdr-lead-hub`.
3. **Secrets** generated into `.env` (gitignored), copy in
   `Credentials/MDR/.env`: MySQL root password, `MDR_HMAC_SECRET` (signs
   WordPress ↔ n8n), `CRM_API_KEY` (n8n ↔ CRM), WordPress admin login.
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
8. **Slack app "MDR Lead Hub"** (A0C8CP9GJB0) created from a JSON manifest in
   Chrome and installed into its own workspace **MDR Demo** (T0C88FA7FA7),
   created by Justin on 2026-10-12. (The first version lived in Justin's older
   workspace *Group 10*, which has other members; its channels were archived.) Bot scopes:
   `chat:write`, `chat:write.public`, `channels:manage`, `channels:read`,
   `channels:join`, `users:read`. Interactivity (button clicks) points to
   `https://mdr-hooks.thejobstash.com/webhook/mdr-slack`. The signing secret is
   what n8n uses to prove a button click really came from Slack.
9. **Slack channels** created by the bot, Justin invited: `#leads-healthcare`,
   `#leads-nonprofit`, `#leads-home-services`, `#leads-general` (one per rep's
   territory), `#mdr-ops` (alerts, errors), `#mdr-daily` (digest).
10. **Cloudflare Tunnel `mdr-hooks`** (`tunnel/cloudflared.yml`): the PC dials
    out to Cloudflare, so no port is opened. Only `/webhook/mdr-slack` and
    `/webhook/mdr-asana` pass; the n8n editor and every other webhook return
    404. Hostname `mdr-hooks.thejobstash.com` (the zone cloudflared's
    certificate can write). A first attempt on justin94.space left a harmless
    stray DNS record `mdr-hooks.justin94.space.thejobstash.com` (answers 404);
    delete it in the Cloudflare dashboard whenever convenient.
11. **Email** goes through Brevo's API (sender justin.masiga.94@gmail.com,
    already verified there). The fake reps' addresses are Gmail plus-aliases
    (`justin.masiga.94+ana@gmail.com`), so every routed email lands in
    Justin's inbox.
12. **Google Sheet "MDR Lead Hub"** created through n8n's existing Google
    credential: tab **Team** is the routing roster (rep, email, industries
    covered, Slack channel, role, active) that n8n reads for every lead, so
    routing changes are a spreadsheet edit; tab **Leads** is the live log n8n
    appends to and updates.
    https://docs.google.com/spreadsheets/d/1LhsJq1Y20-sje6BJFhxoDYHf1d50lLUNhsjMWGxA6QU

## 3. The two WordPress sites

13. **Design first.** Loaded the `frontend-design` skill and wrote a design plan
    per site before any code (palette, type, layout, the one memorable element),
    checked against the usual AI-generated looks and steered away from them.
14. **Copy through `/humanize`.** All visitor-facing text was drafted
    (`wp/copy-draft.md`), rewritten with the humanize skill (`wp/copy.md`), then
    used. Same for emails and Slack (`n8n/copy-draft.md` → `n8n/copy.md`).
15. **Plugin `mdr-intake`** (`wp/plugins/mdr-intake/`, one codebase mounted into
    both sites). PHP, WordPress hooks, a custom post type and REST routes:
    - `[mdr_intake variant="practice|grant"]` renders the 3-step form (vanilla JS,
      client-side checks, first-touch UTM / gclid / fbclid / referrer capture,
      honeypot, time trap).
    - `POST /wp-json/mdr/v1/submit` validates and sanitizes on the server (one
      field definition drives both the form and the checks), rate-limits by IP,
      stores the submission as a private post, and forwards it to n8n **signed
      with HMAC-SHA256** (`X-MDR-Timestamp`, `X-MDR-Signature`, 5-minute window).
    - If n8n is down, the submission stays **queued** and **WP-Cron retries every
      5 minutes** for about an hour. Nothing is lost.
    - `POST /wp-json/mdr/v1/result` accepts n8n's results (same signature check)
      and `GET /status/<token>` lets the results page poll.
    - wp-admin → **Intake** lists every submission with its status, verdict,
      source and the exact payload sent to n8n.
16. **Site A "Practice Growth Check"** (:8081): a custom **Gutenberg block theme**
    (`wp/themes/practice/`: `theme.json`, templates, parts), **written as code
    files**, not built in the WordPress editor. Its home page is the
    `front-page.html` template: normal blocks (4 headings, 4 paragraphs, a
    button, columns, groups) plus 2 Custom HTML blocks (the sample "vitals"
    card, the three checkup panels) and 1 Shortcode block (the form). Calm
    clinical look, Newsreader + Public Sans. The results page shows mobile
    speed and Google basics like a checkup chart.
17. **Site B "Grant Ready"** (:8082): **Elementor** on the Hello Elementor theme,
    but **the pages were generated by a script, not built in Elementor's
    editor.** `wp/site-b/build.php` writes Elementor's page data straight into
    the database so the whole site can be rebuilt with one command. Of the home
    page's 17 Elementor widgets, only 9 are ordinary editable ones (4 Heading,
    5 Text Editor). 7 are **HTML widgets with hand-written markup** (top bar,
    footer, label, button + checklist, sample report card, steps list, rules
    list) and 1 is the form shortcode. The results page is 2 HTML widgets + 1
    shortcode. All styling comes from `wp/site-b/site.css` in Additional CSS,
    not from Elementor's style controls, so it can't be restyled from
    Elementor's panels. The look was redesigned on 2026-10-12 (PR #2): navy and
    "funding green", Plus Jakarta Sans, a sample eligibility report in the
    hero, and a coloured badge on the results page (*Likely eligible*, *Almost
    there*, *Not eligible yet*).
    Both sites run only on this PC (Docker, `localhost`). Nothing is hosted
    online.
18. **One-command setup**: `wp/setup.sh` (WP-CLI): permalinks, plugin, themes,
    Elementor install, pages, front page. Lesson recorded in it: the CLI
    container needs `WORDPRESS_DB_NAME` per command or it writes to the wrong site.

## 4. n8n — where all the logic lives

Built from code: `n8n/build.mjs` generates every workflow and pushes it through
n8n's API (secrets injected at push time, masked in the saved JSON). The deciding
logic is plain JavaScript in `n8n/lib/` with a self-check (`node n8n/test.js`).

| Workflow | Trigger | What it does |
|---|---|---|
| **MDR · Lead intake** | `POST /webhook/mdr-intake` (from WordPress) | Verify signature → duplicate check (CRM) → open their website → **Lighthouse mobile run on this PC** (`tools/lh.mjs`) → **IRS lookup via ProPublica** for nonprofits → results back to WordPress (the visitor sees them) → **rules** (spam, excluded orgs, budget, service area) → **Ollama qwen2.5:7b** with a JSON schema, fed the latest human corrections → verdict, score, reasons, opening line → **routing from the Google Sheet roster** plus current workload from the CRM → save in CRM → Slack post with buttons → Asana task (hot / needs a conversation) → emails to rep and prospect (Brevo) → Sheet row → rep's name back to the visitor |
| **MDR · Sync a change everywhere** | `POST /webhook/mdr-crm-event` (CRM, Slack, Asana) | Refresh the Slack message and add a thread note, move or complete the Asana task, on **Won** create an **Asana onboarding project** with dated tasks, update the Sheet row, email a rep on handover, log it on the CRM timeline |
| **MDR · Slack buttons** | `POST /webhook/mdr-slack` (public, tunnel) | Verify Slack's signature, ack within 3 s, look up who clicked, update the CRM (Contacted / Booked / Not a fit; the last is saved as a correction for the model), then call the sync workflow |
| **MDR · Asana updates** | `POST /webhook/mdr-asana` (public, tunnel) | Asana handshake + signature check; ticking a task or dragging it to Contacted/Booked moves the lead in the CRM, then sync. Never moves a lead backwards, which also stops echo loops |
| **MDR · Follow-up watch** | hourly, or `GET /webhook/mdr-followup-now?hours=0.05` | Leads still New after 24 h: alert in #mdr-ops, nudge in the lead's thread, email the manager, mark escalated |
| **MDR · Daily digest** | 8:00 New York time, or `GET /webhook/mdr-digest-now` | Yesterday's numbers to #mdr-daily and the manager |
| **MDR · Roster** | `GET /webhook/mdr-roster` | The CRM's Team page reads the Sheet through this |
| **MDR · Sheet helper** | `POST /webhook/mdr-sheet-helper` (key, this spreadsheet only) | Used by `tools/reset-demo.mjs` |
| **MDR · Error alerts** | any MDR workflow failing | Posts the failure to #mdr-ops |

## 5. The CRM (not WordPress)

19. **Next.js 15 + Node's built-in SQLite** (`crm/`, port 3090). Thin on purpose:
    screens and a database. Every change a person makes is handed to n8n.
20. **API for n8n** (Bearer `CRM_API_KEY`): create/update leads, events,
    duplicate lookup, workload, correction examples, stats.
21. **Screens**: Leads (triage strip by verdict, filters), lead detail (the AI's
    read, reasons, opening line, website audit, a timeline across every tool,
    stage buttons, verdict correction, reassign, notes), Pipeline board (drag
    and drop), Team (live from the Sheet), Reports (source, verdict, segment,
    stage, rep, site; median time to first contact; how often people corrected
    the AI).

## 6. How each connection is secured

| From → to | How |
|---|---|
| WordPress → n8n | HMAC-SHA256 over timestamp + body, shared secret, 5-minute replay window |
| n8n → WordPress results | same HMAC, other direction |
| n8n ↔ CRM | Bearer key (n8n credential "MDR CRM API"); the CRM sends `X-MDR-Key` to n8n |
| Slack → n8n | Slack signing secret (v0 HMAC), checked in n8n |
| Asana → n8n | Asana's X-Hook-Secret handshake, then X-Hook-Signature HMAC |
| n8n → Slack / Asana / Sheets / Brevo | n8n credentials (bot token, PAT, Google OAuth, API key) |
| Internet → this PC | Cloudflare Tunnel, two exact paths only; everything else 404 |

## 7. Testing that was done

- `node n8n/test.js`: scoring, rules, routing, messages (no network).
- Both sites and the CRM checked at desktop width and at 390 px (headless
  Chrome with phone emulation for the narrow width, because the attached
  Chrome window is maximized and ignores resizing).
- A real form filled in Chrome on Site A, and the results page watched as it
  filled in.
- Five leads end to end: hot clinic (Ana), roofer on the clinic form (the AI
  moved it to home services → Ben), animal shelter (IRS match → Carla), school
  district (excluded by Google → not a fit, polite email), backlink seller
  (spam, nobody pinged).
- Real clicks: Slack "Mark contacted" and "Booked a call"; ticking a task in
  Asana; CRM Won (the onboarding project appeared with 6 tasks), verdict
  correction, reassign; follow-up escalation; daily digest; error alert.
- Emails checked in Gmail; Sheet rows checked in Google Sheets.

## 8. Things found and fixed along the way

- Docker socket files (see 1). WP-CLI writing to the wrong database (see 18).
- PageSpeed's keyless quota was exhausted, so speed now comes from a local
  Lighthouse run. When Lighthouse can't finish (some sites block it), the speed
  shows as not measured. No estimated numbers.
- n8n on Windows resolves `localhost` to IPv6, so its calls to itself use 127.0.0.1.
- Block themes render shortcodes before `wp_head`, so the plugin registers its
  scripts on `init`.
- Slack's form payload is read from n8n's parsed body (the Code sandbox has no
  `URLSearchParams`).
- Elementor 4 containers take `css_classes`; widgets take `_css_classes`.
- CRM production build: SQLite is opened lazily (parallel build workers locked it).
