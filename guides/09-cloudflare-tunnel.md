# 09 · The Cloudflare Tunnel

**Connects:** Slack and Asana (on the internet) → n8n (on this PC). Nothing
else uses it. See [00-how-it-all-connects.md](00-how-it-all-connects.md),
connections 13 and 15.

---

## 1. What it is

n8n runs on your PC at `localhost:5678`, which the internet can't reach. Slack
(button clicks) and Asana (task changes) need to call n8n. A **Cloudflare
Tunnel** solves this without opening any port on your router: a small program,
`cloudflared`, runs on the PC and keeps an **outgoing** connection open to
Cloudflare. Cloudflare gives it a public address and passes requests down that
connection.

| | |
|---|---|
| Tunnel name | `mdr-hooks` |
| Tunnel ID | `0ce19fa5-3c29-46ea-a17c-1843ccc0d8d3` |
| Public address | `https://mdr-hooks.thejobstash.com` |
| Why that domain | `thejobstash.com` is the Cloudflare zone your `cloudflared` login can write DNS records to |
| Settings file | `tunnel/cloudflared.yml` |
| Credentials file | `C:\Users\justi\.cloudflared\0ce19fa5-3c29-46ea-a17c-1843ccc0d8d3.json` (secret, never commit) |
| Started by | `start-tunnel.cmd` (and `start.cmd`), in its own window titled "MDR tunnel" |

---

## 2. Only two paths get through

`tunnel/cloudflared.yml`:

```yaml
ingress:
  - hostname: mdr-hooks.thejobstash.com
    path: ^/webhook/mdr-(slack|asana)$
    service: http://localhost:5678
  - service: http_status:404
```

| Public address | Goes to | Used by |
|---|---|---|
| `https://mdr-hooks.thejobstash.com/webhook/mdr-slack` | n8n → **MDR · Slack buttons** | Slack app's Interactivity Request URL |
| `https://mdr-hooks.thejobstash.com/webhook/mdr-asana` | n8n → **MDR · Asana updates** | Asana webhook target |
| Anything else (the n8n editor, other webhooks, `/healthz`) | **404**, never reaches the PC | — |

So nobody on the internet can open your n8n editor, the CRM, the sites, or
any other workflow. And each of the two open paths checks a signature (Slack's
signing secret, Asana's hook secret) before doing anything.

Checked on 4 Nov 2026: an unsigned POST to `/webhook/mdr-slack` reached n8n
and was refused with 401; `/healthz` got 404 from Cloudflare.

---

## 3. Every link

| What | Link |
|---|---|
| Cloudflare dashboard | https://dash.cloudflare.com/ |
| Tunnels (Zero Trust → Networks → Tunnels) | https://one.dash.cloudflare.com/ → **Networks** → **Tunnels** |
| DNS records of thejobstash.com | https://dash.cloudflare.com/ → **thejobstash.com** → **DNS** → **Records** (look for `mdr-hooks`, a CNAME to `0ce19fa5-....cfargotunnel.com`) |
| Cloudflare Tunnel docs | https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/ |
| Config file (ingress rules) docs | https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/configure-tunnels/local-management/configuration-file/ |
| `cloudflared` download | https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ |

**Cleanup left to do:** a first attempt on justin94.space left a stray DNS
record `mdr-hooks.justin94.space.thejobstash.com` in the thejobstash.com zone.
It's harmless (answers 404); delete it in the DNS records page when convenient.

---

## 4. Commands

| Command | What it does |
|---|---|
| `cloudflared tunnel --config tunnel\cloudflared.yml run` | Runs the tunnel (what `start-tunnel.cmd` does) |
| `cloudflared tunnel list` | Your tunnels and whether they have connections |
| `cloudflared tunnel info mdr-hooks` | This tunnel's live connections |
| `cloudflared tunnel ingress validate --config tunnel\cloudflared.yml` | Checks the config file |
| `cloudflared tunnel ingress rule https://mdr-hooks.thejobstash.com/webhook/mdr-slack --config tunnel\cloudflared.yml` | Shows which rule a given address matches |
| `cloudflared --version` | Installed version |

Stop it by closing the "MDR tunnel" window (or Ctrl+C in it).

---

## 5. What depends on it

| Tunnel off → | Effect |
|---|---|
| Slack buttons | Clicks never reach n8n; nothing changes |
| Asana drags and ticks | Events never reach n8n. If it stays off long enough, **Asana deletes the webhook** (this is likely why there was no Asana webhook on 4 Nov 2026; see [07-asana.md](07-asana.md) section 7) |
| Everything else | Unaffected. Forms, scoring, CRM, posting to Slack/Asana/Sheet all happen inside the PC or as outgoing calls |

---

## 6. Try it yourself

1. With the tunnel running, open
   https://mdr-hooks.thejobstash.com/healthz in a browser: **404**. That's the
   catch-all rule working.
2. In the "MDR tunnel" window, read the log lines: "Registered tunnel
   connection" means it's connected (usually 4 connections).
3. Click a button on a Slack lead card, then look at
   http://localhost:5678/workflow/OtwtYOoOc3cPabd8/executions: a new run means
   the click came through the tunnel.

## 7. When something is wrong

| Symptom | Cause | Fix |
|---|---|---|
| Slack clicks do nothing | Tunnel window closed | `start-tunnel.cmd` |
| The window says "failed to dial to edge" | No internet, or a firewall blocks outgoing traffic | Check the connection |
| Every address answers 404, even `/webhook/mdr-slack` with POST | Wrong config file loaded | Run it with `--config tunnel\cloudflared.yml` |
| "credentials file not found" | The `.json` in `C:\Users\justi\.cloudflared\` is missing | Recreate the tunnel's credentials from the Cloudflare dashboard, or `cloudflared tunnel token` |
| Address doesn't resolve at all | The `mdr-hooks` DNS record was deleted | Re-add it: `cloudflared tunnel route dns mdr-hooks mdr-hooks.thejobstash.com` |
