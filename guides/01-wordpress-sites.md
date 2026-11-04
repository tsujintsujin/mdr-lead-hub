# 01 · The WordPress sites, the form plugin, Docker and MySQL

**Connects to:** n8n only (see [00-how-it-all-connects.md](00-how-it-all-connects.md),
connections 1 to 4). The sites never talk to Slack, Asana, the Sheet or the CRM.

---

## 1. What it is

Two separate WordPress websites, each with its own database, both running in
Docker on this PC. Both use the same form plugin, `mdr-intake`, written for this
project.

| | Site A | Site B |
|---|---|---|
| Name | Practice Growth Check | Grant Ready |
| For | Clinics: chiropractors, physical therapists, med spas, dental, wellness | Nonprofits |
| Offer | Free website checkup | Free Google Ad Grants eligibility check |
| Address | http://localhost:8081 | http://localhost:8082 |
| Theme | `practice` (custom block theme, written as code) | Hello Elementor 3.5.1 + Elementor 4.3.4 |
| Database | `site_a` | `site_b` |
| Form variant | `practice` | `grant` |

Only this PC can open them. Nothing is online.

---

## 2. Every link

### Site A, Practice Growth Check

| What | Link |
|---|---|
| Home page (the form) | http://localhost:8081 |
| Results page | http://localhost:8081/results/ (needs `?t=<token>` from a real submission) |
| Admin dashboard | http://localhost:8081/wp-admin/ |
| **Intake submissions** (every form ever sent) | http://localhost:8081/wp-admin/edit.php?post_type=mdr_submission |
| Site Editor (edit the home page template) | http://localhost:8081/wp-admin/site-editor.php |
| Pages | http://localhost:8081/wp-admin/edit.php?post_type=page |
| Edit the Results page (ID 4) | http://localhost:8081/wp-admin/post.php?post=4&action=edit |
| Themes | http://localhost:8081/wp-admin/themes.php |
| Plugins | http://localhost:8081/wp-admin/plugins.php |
| Permalinks | http://localhost:8081/wp-admin/options-permalink.php |
| General settings | http://localhost:8081/wp-admin/options-general.php |
| Scheduled jobs (no screen; see section 6) | — |
| REST routes of the plugin | http://localhost:8081/wp-json/mdr/v1 |

### Site B, Grant Ready

| What | Link |
|---|---|
| Home page (the form) | http://localhost:8082 |
| Results page | http://localhost:8082/results/ |
| Admin dashboard | http://localhost:8082/wp-admin/ |
| **Intake submissions** | http://localhost:8082/wp-admin/edit.php?post_type=mdr_submission |
| Pages | http://localhost:8082/wp-admin/edit.php?post_type=page |
| Edit Home in Elementor (ID 5) | http://localhost:8082/wp-admin/post.php?post=5&action=elementor |
| Edit Results in Elementor (ID 7) | http://localhost:8082/wp-admin/post.php?post=7&action=elementor |
| Elementor settings | http://localhost:8082/wp-admin/admin.php?page=elementor |
| Additional CSS (where the design lives) | http://localhost:8082/wp-admin/customize.php?autofocus[section]=custom_css |
| Themes | http://localhost:8082/wp-admin/themes.php |
| Plugins | http://localhost:8082/wp-admin/plugins.php |
| REST routes of the plugin | http://localhost:8082/wp-json/mdr/v1 |

**Login for both:** user `mdradmin`, password is `WP_ADMIN_PASSWORD` in `.env`.

### Outside links (to learn more)

- WordPress block themes: https://developer.wordpress.org/themes/block-themes/
- `theme.json` reference: https://developer.wordpress.org/block-editor/reference-guides/theme-json-reference/
- Shortcodes: https://developer.wordpress.org/plugins/shortcodes/
- REST API routes: https://developer.wordpress.org/rest-api/extending-the-rest-api/adding-custom-endpoints/
- Custom post types: https://developer.wordpress.org/plugins/post-types/
- WP-Cron: https://developer.wordpress.org/plugins/cron/
- WP-CLI commands: https://developer.wordpress.org/cli/commands/
- Elementor help: https://elementor.com/help/
- Docker Compose: https://docs.docker.com/compose/
- The official WordPress Docker image: https://hub.docker.com/_/wordpress

---

## 3. The files

| File / folder | What it is |
|---|---|
| `docker-compose.yml` | Defines the 4 containers (below) |
| `wp/initdb/01-dbs.sql` | Creates the two databases the first time MySQL starts |
| `wp/setup.sh` | Builds both sites from nothing with WP-CLI (install, plugin, theme, pages, Elementor) |
| `wp/plugins/mdr-intake/mdr-intake.php` | The plugin: storage, signing, REST routes, retry queue, admin list, shortcodes |
| `wp/plugins/mdr-intake/includes/fields.php` | The list of form fields and their checks (one list drives both the form and the server checks) |
| `wp/plugins/mdr-intake/templates/form-practice.php`, `form-grant.php` | The 3-step forms |
| `wp/plugins/mdr-intake/templates/results-practice.php`, `results-grant.php` | The results pages |
| `wp/plugins/mdr-intake/assets/intake.js` | Step-by-step form, browser checks, tracking capture, polling the results |
| `wp/plugins/mdr-intake/assets/intake.css` | Form and results styling |
| `wp/themes/practice/theme.json` | Site A's colours, fonts, spacing |
| `wp/themes/practice/templates/front-page.html` | Site A's home page |
| `wp/themes/practice/templates/page.html`, `index.html` | Other page layouts |
| `wp/themes/practice/parts/header.html`, `footer.html` | Header and footer |
| `wp/site-b/build.php` | Writes Site B's Elementor pages straight into the database |
| `wp/site-b/site.css` | Site B's whole design (goes into Additional CSS) |
| `wp/copy-draft.md` → `wp/copy.md` | The site text, before and after the humanize pass |

The plugin and theme folders are **mounted** into the containers: edit the file
on your PC and the site changes on the next page load. No upload, no restart.

---

## 4. Docker and MySQL

| Container | Image | Port | Job |
|---|---|---|---|
| `mdr-db-1` | `mysql:8.4` | none outside | One MySQL server holding `site_a` and `site_b` |
| `mdr-site-a-1` | `wordpress:6.8-php8.3-apache` | 8081 | Site A |
| `mdr-site-b-1` | `wordpress:6.8-php8.3-apache` | 8082 | Site B |
| `cli` | `wordpress:cli-php8.3` | — | Only runs when you call it, for WP-CLI commands |

The WordPress files and the database live in Docker **volumes** (`mdr_db`,
`mdr_site-a`, `mdr_site-b`), so they survive restarts. `docker compose down -v`
would delete them. Don't.

The secrets reach WordPress as PHP constants (`MDR_SITE`, `MDR_HMAC_SECRET`,
`MDR_N8N_INTAKE`) through `WORDPRESS_CONFIG_EXTRA` in `docker-compose.yml`.
`MDR_N8N_INTAKE` is `http://host.docker.internal:5678/webhook/mdr-intake`:
`host.docker.internal` is how a container reaches your PC.

**Commands** (in a terminal in the MDRLeadHub folder):

| Command | What it does |
|---|---|
| `docker compose up -d` | Start the sites |
| `docker compose stop` | Stop them (data kept) |
| `docker compose ps` | Which containers are running |
| `docker compose logs site-a --tail 50` | Last 50 log lines of Site A |
| `MSYS_NO_PATHCONV=1 docker compose run --rm -e WORDPRESS_DB_NAME=site_a cli wp --path=/sites/a plugin list` | Any WP-CLI command on Site A |
| same with `site_b` and `/sites/b` | Same on Site B |
| `MSYS_NO_PATHCONV=1 docker compose run --rm cli sh /repo/setup.sh` | Rebuild both sites from scratch |

**Always pass `WORDPRESS_DB_NAME`.** The CLI container can see both databases;
without it a command can land on the wrong site. `MSYS_NO_PATHCONV=1` stops
Git Bash from rewriting `/sites/a` into a Windows path.

Docker Desktop must be started with `C:\Users\justi\Scripts\start-docker.ps1`.
It needs CPU virtualization switched on in the BIOS.

---

## 5. How the form works, step by step

### In the visitor's browser (`intake.js`)

1. On the first page of the visit, it remembers (in the browser's session
   storage, so for that tab's session) where the visitor came from: `utm_source`,
   `utm_medium`, `utm_campaign`, `gclid` (Google Ads click), `fbclid` (Facebook
   click), the referrer and the landing page. n8n later turns this into the
   "Source" column (Google Ads, Organic search, Direct, ...).
2. Shows the form in 3 steps, checking each step before moving on.
3. Measures how long the visitor took (`elapsed_ms`, from when the page
   opened), and has a hidden trap field (`mdr_hp`) a person never sees. It is
   hidden with `display:none` so browser autofill skips it. (Until 4 Nov 2026 it
   was called `company_url` and only moved off-screen, and Chrome autofill
   filled it with the visitor's website, so real people were thrown away as
   bots. Fixed in PR #9.)
4. Sends everything to `POST /wp-json/mdr/v1/submit`.

### Fields

**Site A (practice):** business, website, practice type, ZIP, goals, number of
locations, monthly budget, timeline, message, name, email, phone, consent.

**Site B (grant):** organisation name, website, EIN (optional), state,
501(c)(3) status, mission, current Ad Grants status, staff size, goals,
message, name, role, email, phone, consent.

The exact list and every check is in `includes/fields.php`.

### On the server (`mdr-intake.php`, `mdr_rest_submit`)

1. **Bot check.** If the trap field is filled, or the form was sent under 2.5
   seconds after the page opened, it answers "OK" with the token
   `00000000000000000000000000000000` and does **not** send it to n8n. The bot
   thinks it worked. The try is kept in the Intake screen as **Blocked as bot**
   with the reason, so a person blocked by mistake can be found. Their results
   page says "We couldn't find that check".
2. **Rate limit.** More than 6 submissions from one IP in 10 minutes → "Too many
   tries".
3. **Field checks.** Every answer is cleaned and checked again on the server
   (never trust the browser). Errors go back to the form.
4. **Saves it** as a private post of type `mdr_submission`, with a random
   32-character token, the full payload, state `received`.
5. **Sends it to n8n** (`mdr_forward`), signed:
   - `X-MDR-Timestamp`: the current time
   - `X-MDR-Signature`: HMAC-SHA256 of `timestamp.body` with `MDR_HMAC_SECRET`
   - If n8n answers 2xx → state `forwarded`. Otherwise → state `queued`, and the
     error is saved.
6. Answers the browser with the token. The browser goes to `/results/?t=<token>`.

### The results page

`intake.js` asks `GET /wp-json/mdr/v1/status/<token>` every 1.5 seconds (every
5 seconds after 2 minutes, giving up after 10 minutes) and
fills in the page as results arrive. n8n posts results back to
`POST /wp-json/mdr/v1/result` (signed the same way) in two stages:

| Stage | When | What the visitor sees |
|---|---|---|
| `audit` | After the website check (Lighthouse, page basics, IRS lookup) | Site A: mobile speed, Google basics, booking button. Site B: eligibility badge (*Likely eligible*, *Almost there*, *Not eligible yet*) and the checks |
| `routed` | After scoring and routing | The name of the strategist who'll call |

Results are **merged**, never replaced, so the second stage doesn't wipe the
first.

**The waiting list is partly staged.** While it waits, the page shows four
lines with spinners (Site B: "Searching IRS nonprofit records", "Opening your
website", "Checking Google's rules", "Finding your specialist"; Site A has its
own wording).
- The first three start on a timer, 2.5 seconds apart (`markWait()` in
  `intake.js`). n8n doesn't report which of them it's on, and it actually does
  them in a different order (website, Lighthouse, then IRS).
- They all tick at the same moment: when the `audit` stage really arrives, and
  then the real results replace the list.
- The last line ("Finding your specialist") is real: it starts after the audit
  and ends only when n8n has routed the lead.

The work itself is real every time. Measured on 4 Nov 2026: website 1 s,
Lighthouse 57 s, IRS 0.5 s, AI 48 s.

### What Site B's four checks really test (`buildAudit()` in `n8n/lib/intake.js`)

| Line on the page | Actually checks |
|---|---|
| Found in IRS nonprofit records | A ProPublica match by EIN, or by name + state |
| Website loads on https | The home page loaded, over https |
| Enough about your mission on the site | **Only** that the home page has 300+ words. It doesn't read what they say |
| An organization type Google accepts | **Only** that the visitor didn't pick "Hospital, school or government" |

Badge: **Not eligible yet** if they answered 501(c)(3) "No" or picked hospital /
school / government, or fewer than 2 checks passed; **Likely eligible** if all 4
passed; otherwise **Almost there**. The Lighthouse speed is measured but only
shown in the CRM, not on Site B's page.

Example (4 Nov 2026): tapndine.online, a business, answered "No" → Not eligible
yet; IRS ✕; https ✓; mission ✓ (1,702 words); type ✓ ("Other mission").

---

## 6. The retry queue (when n8n is down)

- WordPress runs a job called `mdr_retry_queue` every 5 minutes (WP-Cron).
- It re-sends up to 20 submissions in state `queued`.
- Each submission gets at most **12 tries** (about an hour). After that it stays
  `queued` in WordPress and nothing re-sends it.
- WP-Cron only runs when someone loads a page of that site. On this demo,
  that's you.

To see the job:
`MSYS_NO_PATHCONV=1 docker compose run --rm -e WORDPRESS_DB_NAME=site_a cli wp --path=/sites/a cron event list`

To force a run now:
`MSYS_NO_PATHCONV=1 docker compose run --rm -e WORDPRESS_DB_NAME=site_a cli wp --path=/sites/a cron event run mdr_retry_queue`

---

## 7. The Intake screen in wp-admin

http://localhost:8081/wp-admin/edit.php?post_type=mdr_submission (and the same
on 8082).

| Column | Meaning |
|---|---|
| Submission | "Business — Contact name" |
| Status | Received → Sent to n8n → Audit done → Routed to a rep. Or **Waiting to retry** (with the error), **Blocked as bot** (with the reason), or Failed |
| Verdict | The verdict n8n sent back |
| Source | `utm_source`, or "google ads" if there was a `gclid`, or "direct" |
| Received | Date |

Open one to see **"What was sent to n8n"**: the exact payload, the number of
attempts, and the results n8n sent back. You can't create submissions here;
they only come from the form.

---

## 8. Site A in detail: the block theme

- `theme.json` sets the palette, the fonts (Newsreader for headings, Public
  Sans for text) and spacing.
- `templates/front-page.html` is the home page, made of normal blocks: 4
  headings, 4 paragraphs, 1 button, columns and groups, plus 2 **Custom HTML**
  blocks (the sample "vitals" card, the three checkup panels) and 1
  **Shortcode** block: `[mdr_intake variant="practice"]`.
- The Results page (ID 4) holds `[mdr_results variant="practice"]`.
- In the Site Editor you can change the normal blocks. Your changes are saved in
  the database and then override the file. To go back to the file version, use
  the Site Editor's "Reset" on that template.

## 9. Site B in detail: Elementor generated by a script

- `wp/site-b/build.php` writes Elementor's page data (`_elementor_data`) into
  the database for Home (ID 5) and Results (ID 7).
- Home has 17 widgets: 4 Heading, 5 Text Editor (editable normally), 7 HTML
  (hand-written markup: top bar, footer, label, button + checklist, sample
  report card, steps, rules list) and 1 Shortcode (`[mdr_intake variant="grant"]`).
- Results: 2 HTML widgets + `[mdr_results variant="grant"]`.
- All styling is in `wp/site-b/site.css`, pasted into Additional CSS. Elementor's
  own style controls won't change the look.
- Edits made in Elementor are lost the next time `build.php` runs.

---

## 10. Try it yourself

1. Open http://localhost:8081, fill in the form with a real clinic's website,
   submit.
2. Watch the results page fill in (Lighthouse can take up to a minute).
3. Open http://localhost:8081/wp-admin/edit.php?post_type=mdr_submission: your
   submission is there, status moving to **Routed to a rep**.
4. Open it and read "What was sent to n8n".
5. To see the retry queue: close the n8n window, submit again, see **Waiting to
   retry**; start n8n, load any page of the site after 5 minutes, see it go
   through.

## 11. When something is wrong

| Symptom | Cause | Fix |
|---|---|---|
| Site doesn't load | Docker not running | `start-docker.ps1`, then `docker compose up -d` |
| Form says it can't send | Plugin REST route blocked or rate limit | Wait 10 minutes; check `docker compose logs site-a` |
| Results page: "We couldn't find that check" | The form was rejected as a bot (URL ends in `?t=000...`) | Intake screen shows it as **Blocked as bot** with the reason |
| Submission stuck on **Waiting to retry** | n8n down or the signature rejected | Start n8n; check the error shown under the status |
| Results page never fills | n8n can't reach `localhost:808x/wp-json/mdr/v1/result` or Lighthouse is slow | Check the n8n execution of **MDR · Lead intake** |
| Site B shows "Loads without https" for a site that has it | Known bug with sites that redirect to `www.` | Not fixed |
| A WP-CLI command changed the wrong site | `WORDPRESS_DB_NAME` missing | Always pass it |
