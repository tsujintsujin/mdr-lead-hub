// Wipes the demo back to empty so a Loom take starts clean.
//   node tools/reset-demo.mjs            (asks nothing; run start.cmd first so n8n + Docker are up)
// What it clears: the CRM database, the Sheet's Leads tab, every task in the Asana
// "MDR Lead Follow-ups" project, the "Onboarding: ..." Asana projects, the WordPress
// submissions on both sites, and the Slack lead channels (archived and recreated empty).
// What it can't clear: emails already delivered to Gmail.
// The CRM must be stopped first (its window holds the database open); this script stops it
// and starts it again at the end.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, '.env');
const env = Object.fromEntries(fs.readFileSync(envFile, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const log = (m) => console.log('• ' + m);

async function j(url, opt = {}) { const r = await fetch(url, opt); const t = await r.text(); try { return JSON.parse(t); } catch { return { raw: t, status: r.status }; } }

// 1. CRM database (stop the server, delete the file, start it again later)
try { execSync('powershell -NoProfile -Command "$p=(Get-NetTCPConnection -LocalPort 3090 -State Listen -ErrorAction SilentlyContinue).OwningProcess; if ($p) { Stop-Process -Id $p -Force }"'); } catch {}
await new Promise((r) => setTimeout(r, 1500));
for (const f of ['crm.db', 'crm.db-wal', 'crm.db-shm']) fs.rmSync(path.join(root, 'crm', 'data', f), { force: true });
log('CRM database cleared');

// 2. Sheet: Leads tab back to just the header
const sheet = await j('http://127.0.0.1:5678/webhook/mdr-sheet-helper', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-MDR-Key': env.CRM_API_KEY },
  body: JSON.stringify({ method: 'POST', url: `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEET_ID}/values/Leads!A2:Z2000:clear`, data: {} }) });
log(sheet.clearedRange ? `Sheet ${sheet.clearedRange} cleared` : `Sheet NOT cleared: ${JSON.stringify(sheet).slice(0, 200)}`);

// 3. Asana: follow-up tasks and onboarding projects
const A = { Authorization: `Bearer ${env.ASANA_PAT}`, 'Content-Type': 'application/json' };
const tasks = (await j(`https://app.asana.com/api/1.0/projects/${env.ASANA_PROJECT}/tasks?limit=100`, { headers: A })).data || [];
for (const t of tasks) await fetch(`https://app.asana.com/api/1.0/tasks/${t.gid}`, { method: 'DELETE', headers: A });
const projects = (await j(`https://app.asana.com/api/1.0/projects?workspace=${env.ASANA_WORKSPACE}&archived=false&limit=100`, { headers: A })).data || [];
const onboarding = projects.filter((p) => p.name.startsWith('Onboarding: '));
for (const p of onboarding) await fetch(`https://app.asana.com/api/1.0/projects/${p.gid}`, { method: 'DELETE', headers: A });
log(`Asana: ${tasks.length} follow-up task(s) and ${onboarding.length} onboarding project(s) removed (they sit in Asana's trash)`);

// 4. WordPress submissions
for (const s of ['a', 'b']) {
  try {
    execSync(`docker compose run --rm cli sh -c "ids=$(env WORDPRESS_DB_NAME=site_${s} wp --path=/sites/${s} post list --post_type=mdr_submission --post_status=any --format=ids); [ -n \\"$ids\\" ] && env WORDPRESS_DB_NAME=site_${s} wp --path=/sites/${s} post delete $ids --force || true"`, { cwd: root, stdio: 'ignore', env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
  } catch {}
}
log('WordPress submissions cleared on both sites');

// 5. Slack: archive the used channels and create empty ones with the same names
const S = { Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`, 'Content-Type': 'application/json; charset=utf-8' };
const slack = (m, b) => j(`https://slack.com/api/${m}`, { method: 'POST', headers: S, body: JSON.stringify(b) });
const stamp = new Date().toISOString().slice(5, 16).replace(/[-T:]/g, '');
const CH = { HEALTHCARE: 'leads-healthcare', NONPROFIT: 'leads-nonprofit', HOME_SERVICES: 'leads-home-services', GENERAL: 'leads-general', OPS: 'mdr-ops', DAILY: 'mdr-daily' };
let envText = fs.readFileSync(envFile, 'utf8');
for (const [k, name] of Object.entries(CH)) {
  const old = env['SLACK_CH_' + k];
  await slack('conversations.rename', { channel: old, name: `${name}-old-${stamp}` });
  await slack('conversations.archive', { channel: old });
  const c = await slack('conversations.create', { name });
  if (!c.ok) { log(`Slack #${name} NOT recreated: ${c.error}`); continue; }
  await slack('conversations.invite', { channel: c.channel.id, users: env.SLACK_JUSTIN_USER });
  envText = envText.replace(new RegExp(`^SLACK_CH_${k}=.*$`, 'm'), `SLACK_CH_${k}=${c.channel.id}`);
}
fs.writeFileSync(envFile, envText);
const cred = path.resolve(root, '../../Credentials/MDR/.env');
if (fs.existsSync(path.dirname(cred))) fs.copyFileSync(envFile, cred);
log('Slack lead channels recreated empty (old ones archived)');

// 6. CRM back up
execSync(`powershell -NoProfile -Command "Start-Process cmd -ArgumentList '/k','\"${path.join(root, 'start-crm.cmd')}\"' -WindowStyle Minimized"`);
log('CRM restarting on http://localhost:3090 (fresh, empty)');
console.log('Done. Submit a form on http://localhost:8081 or :8082 to start the demo.');
