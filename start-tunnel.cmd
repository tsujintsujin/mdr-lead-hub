@echo off
title MDR tunnel (mdr-hooks.thejobstash.com -> n8n Slack/Asana webhooks only)
cd /d "%~dp0"
cloudflared tunnel --config tunnel\cloudflared.yml run
