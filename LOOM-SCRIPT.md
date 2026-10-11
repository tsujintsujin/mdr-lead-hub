# Loom script (about 6–8 minutes)

Before recording: run `start.cmd`, then (if you want a clean slate)
`node tools/reset-demo.mjs` and `node tools/seed-demo.mjs`. Have these tabs open:
Site A, Site B, CRM, Slack (#leads-healthcare), Asana board, the Sheet, n8n.

1. **The idea (20 s).** "MDR gets leads from forms on client and campaign sites.
   I built the system that catches them, works out which ones matter, and gets
   them to the right person in the tools the team already uses."

2. **Site A, live (1.5 min).** http://localhost:8081, open it with
   `?utm_source=google&utm_medium=cpc&gclid=test` so the source shows as Google
   Ads. Fill the checkup as a clinic (use one of your `+alias` emails). Submit
   and let the results page fill in: speed from a real Lighthouse run, Google
   basics, then the strategist's name.

3. **Site B, quickly (30 s).** http://localhost:8082. Point out it's a different
   design and a different builder (Elementor), but the same plugin and pipeline.
   Show one finished result with the stamp.

4. **n8n (1.5 min).** Open "MDR · Lead intake". Walk the five sticky-note
   stages left to right. Open the last execution and click the Ollama node to
   show the JSON the model returned. Mention: rules run first, the model only
   judges what's left, and it learns from corrections people make.

5. **Slack (45 s).** #leads-healthcare: the lead card with the AI's read and the
   opening line. Click **Mark contacted** and watch the card update.

6. **Asana (30 s).** The task moved to Contacted with a comment. Tick another
   lead's task and show it moving in the CRM.

7. **CRM (1.5 min).** http://localhost:3090. Triage strip, the roofer that used
   the clinic form and got routed to the home-services rep, the timeline across
   every tool. Correct a verdict with a reason ("the model reads this next
   time"). Mark one **Won** and switch to Asana to show the onboarding project
   that just appeared.

8. **Sheet + email (30 s).** The Leads tab updating; the Team tab that controls
   routing. One prospect email and one rep email in Gmail.

9. **Ops (30 s).** Run `curl "localhost:5678/webhook/mdr-followup-now?hours=0.05"`
   and show the alert in #mdr-ops. Mention the daily digest and the error
   alerts.

10. **Close (15 s).** "Everything runs locally: WordPress in Docker with MySQL,
    n8n, a local model, Lighthouse. The repo and a step-by-step build log are
    ready to share."
