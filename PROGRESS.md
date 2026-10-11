# Progress

- [x] Docker Desktop fixed (stale socket files; folders renamed aside).
- [x] 1 Setup — repo, compose, both WordPress installed (admin `mdradmin`, password in .env).
- [x] 2 Credentials — Asana PAT + project/sections, Slack app/channels, tunnel + DNS, Brevo, Sheet. All ids in .env. n8n credentials created (ids in .env).
  - TODO at end: delete temporary n8n workflow "MDR setup proxy (temporary)" (POFPjTikQqlhrgW6).
- [x] 3 WordPress sites — plugin, Site A (Gutenberg), Site B (Elementor). Headless shots desktop + 390px checked. Real-Chrome screenshots time out when the MCP tab is hidden; open a fresh tab (tabs_create_mcp) when that happens.
- [x] 4 n8n intake (W1) — runs end to end (test leads MDR-1001 clinic, MDR-1002 food bank). Lighthouse local (tools/lh.mjs) replaces PageSpeed (keyless quota exhausted).
  - TODO: visually confirm Slack message, Asana task, Gmail emails, Sheet row in Chrome.
- [ ] 5 CRM screens (crm/, Next.js, port 3090; dev server runs from start-crm-dev.cmd)
- [ ] 6 W2 Slack buttons, W3 Asana webhook, W4 CRM events, W5 follow-up watch, W6 digest, W7 roster; tunnel running
- [ ] 7 Final pass + reset demo data + docs + ship
