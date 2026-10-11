@echo off
title MDR CRM (port 3090)
cd /d "%~dp0crm"
if not exist ".next\BUILD_ID" call npm run build
npm run start
