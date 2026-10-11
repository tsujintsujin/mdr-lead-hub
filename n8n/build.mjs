// Builds the MDR Lead Hub n8n workflows and pushes them to the local n8n via its API.
//   node n8n/build.mjs            build + push + activate every workflow
//   node n8n/build.mjs --dry      only write n8n/workflows/*.json (secrets masked)
// Logic lives in n8n/lib/*.js (tested by n8n/test.js) and is pasted into the Code nodes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const env = Object.fromEntries(fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const N8N = 'http://localhost:5678';
const N8N_KEY = fs.readFileSync(path.resolve(root, '../../Credentials/n8n/api-key.txt'), 'utf8').trim();
const DRY = process.argv.includes('--dry');

const LIB_INTAKE = fs.readFileSync(path.join(here, 'lib/intake.js'), 'utf8').replace(/\nif \(typeof module[^\n]*\n?/, '\n');
const LIB_MSG = fs.readFileSync(path.join(here, 'lib/messages.js'), 'utf8').replace(/\nif \(typeof module[^\n]*\n?/, '\n');

// Settings the Code nodes need. Secrets are injected at push time and masked in the saved JSON.
const CFG = {
  crm: 'http://localhost:3090', crmPublic: 'http://localhost:3090',
  ollama: 'http://127.0.0.1:11434/api/chat', model: 'qwen2.5:7b',
  sender: env.BREVO_SENDER, sheetId: env.SHEET_ID, sheetUrl: `https://docs.google.com/spreadsheets/d/${env.SHEET_ID}/edit`,
  asanaProject: env.ASANA_PROJECT, asanaUser: env.ASANA_USER, asanaWorkspace: env.ASANA_WORKSPACE,
  asanaSections: { hot: env.ASANA_SEC_HOT, talk: env.ASANA_SEC_TALK, contacted: env.ASANA_SEC_CONTACTED, booked: env.ASANA_SEC_BOOKED },
  slackTeam: env.SLACK_TEAM_ID, opsChannel: 'mdr-ops', dailyChannel: 'mdr-daily',
  siteNames: { 'site-a': 'Practice Growth Check', 'site-b': 'Grant Ready' },
};
const SECRETS = { MDR_HMAC_SECRET: env.MDR_HMAC_SECRET, SLACK_SIGNING_SECRET: env.SLACK_SIGNING_SECRET, CRM_API_KEY: env.CRM_API_KEY };

const CRED = {
  crm: { httpHeaderAuth: { id: env.N8N_CRED_CRM, name: 'MDR CRM API' } },
  brevo: { httpHeaderAuth: { id: env.N8N_CRED_BREVO, name: 'MDR Brevo email' } },
  slack: { slackApi: { id: env.N8N_CRED_SLACK, name: 'MDR Slack bot' } },
  asana: { asanaApi: { id: env.N8N_CRED_ASANA, name: 'MDR Asana' } },
  sheets: { googleSheetsOAuth2Api: { id: env.N8N_CRED_SHEETS, name: 'Google Sheets TheJobStash' } },
};

/* ---------- node helpers ---------- */
const uuid = (s) => { const h = crypto.createHash('md5').update(s).digest('hex'); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`; };
let wfName = '';
const node = (name, type, typeVersion, parameters, pos, extra = {}) => ({ id: uuid(wfName + name), name, type, typeVersion, position: pos, parameters, ...extra });
const code = (name, body, pos, { lib = false, msg = false, secrets = false, each = false } = {}) => node(name, 'n8n-nodes-base.code', 2, {
  ...(each ? { mode: 'runOnceForEachItem' } : {}),
  jsCode: [
    lib ? LIB_INTAKE : '', msg ? LIB_MSG : '',
    `const CFG = ${JSON.stringify(CFG)};`,
    secrets ? `const SECRET = { hmac: '{{MDR_HMAC_SECRET}}', slack: '{{SLACK_SIGNING_SECRET}}', crm: '{{CRM_API_KEY}}' };` : '',
    body,
  ].filter(Boolean).join('\n'),
}, pos);
const http = (name, pos, o) => node(name, 'n8n-nodes-base.httpRequest', 4.2, {
  method: o.method || 'GET', url: o.url,
  ...(o.cred === 'crm' || o.cred === 'brevo' ? { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' } : {}),
  ...(o.cred === 'slack' ? { authentication: 'predefinedCredentialType', nodeCredentialType: 'slackApi' } : {}),
  ...(o.cred === 'asana' ? { authentication: 'predefinedCredentialType', nodeCredentialType: 'asanaApi' } : {}),
  ...(o.query ? { sendQuery: true, queryParameters: { parameters: Object.entries(o.query).map(([name, value]) => ({ name, value })) } } : {}),
  ...(o.headers ? { sendHeaders: true, headerParameters: { parameters: Object.entries(o.headers).map(([name, value]) => ({ name, value })) } } : {}),
  ...(o.json ? { sendBody: true, specifyBody: 'json', jsonBody: o.json } : {}),
  ...(o.raw ? { sendBody: true, contentType: 'raw', rawContentType: 'application/json', body: o.raw } : {}),
  options: { timeout: o.timeout || 30000, ...(o.neverError ? { response: { response: { neverError: true } } } : {}) },
}, pos, { ...(o.cred ? { credentials: CRED[o.cred] } : {}), ...(o.continueOnFail ? { onError: 'continueRegularOutput' } : {}), ...(o.always ? { alwaysOutputData: true } : {}) });
const iff = (name, expr, pos) => node(name, 'n8n-nodes-base.if', 2.2, {
  conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 }, conditions: [{ id: uuid(name + 'c'), leftValue: expr, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' },
  options: {},
}, pos);
const webhook = (name, pathName, pos, { method = 'POST', respond = 'responseNode', raw = false } = {}) =>
  node(name, 'n8n-nodes-base.webhook', 2.1, { httpMethod: method, path: pathName, responseMode: respond, options: raw ? { rawBody: true } : {} }, pos, { webhookId: uuid('hook-' + pathName) });
const respond = (name, pos, { code: rc = 200, body = '={{ JSON.stringify($json.response || {ok:true}) }}', headers } = {}) => node(name, 'n8n-nodes-base.respondToWebhook', 1.5, {
  respondWith: 'text', responseBody: body,
  options: { responseCode: rc, ...(headers ? { responseHeaders: { entries: headers } } : {}) },
}, pos);
const sheetRead = (name, gid, pos) => node(name, 'n8n-nodes-base.googleSheets', 4.7, {
  documentId: { __rl: true, value: CFG.sheetId, mode: 'id' }, sheetName: { __rl: true, value: gid, mode: 'id' }, options: {},
}, pos, { credentials: CRED.sheets, alwaysOutputData: true });
const sheetUpsert = (name, gid, pos) => node(name, 'n8n-nodes-base.googleSheets', 4.7, {
  operation: 'appendOrUpdate', documentId: { __rl: true, value: CFG.sheetId, mode: 'id' }, sheetName: { __rl: true, value: gid, mode: 'id' },
  columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: ['Lead ID'], schema: [] }, options: {},
}, pos, { credentials: CRED.sheets });
const schedule = (name, rule, pos) => node(name, 'n8n-nodes-base.scheduleTrigger', 1.2, { rule }, pos);

/** connections from a compact list: [from, to] or [from, to, outputIndex] */
function wire(pairs) {
  const c = {};
  for (const [from, to, out = 0] of pairs) {
    c[from] ||= { main: [] };
    while (c[from].main.length <= out) c[from].main.push([]);
    c[from].main[out].push({ node: to, type: 'main', index: 0 });
  }
  return c;
}
const row = (x, y = 0) => [x * 240, y * 200];

/* ---------- shared code snippets ---------- */
const SIGN = `
const crypto = require('crypto');
function signed(obj) { const body = JSON.stringify(obj); const ts = Math.floor(Date.now() / 1000); return { body_str: body, ts: String(ts), sig: crypto.createHmac('sha256', SECRET.hmac).update(ts + '.' + body).digest('hex') }; }`;

/* =====================================================================
   W1  MDR · Lead intake
   ===================================================================== */
function intake() {
  wfName = 'MDR · Lead intake';
  const nodes = [
    webhook('WordPress form in', 'mdr-intake', row(0), { raw: true }),
    code('Check signature', `${SIGN.replace("function signed", "function _unused")}
const item = $input.first();
let raw;
try { raw = await this.helpers.getBinaryDataBuffer(0, 'data'); }
catch (e) { raw = Buffer.from((item.binary && item.binary.data && item.binary.data.data) || '', 'base64'); }
const h = item.json.headers || {};
const ts = parseInt(h['x-mdr-timestamp'] || '0', 10);
const want = crypto.createHmac('sha256', SECRET.hmac).update(ts + '.' + raw.toString('utf8')).digest('hex');
const got = String(h['x-mdr-signature'] || '');
const fresh = Math.abs(Date.now() / 1000 - ts) < 300;
const ok = fresh && got.length === want.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
let payload = null;
if (ok) { try { payload = JSON.parse(raw.toString('utf8')); } catch (e) {} }
return [{ json: { ok: !!payload, payload, response: payload ? { ok: true, received: payload.token } : { ok: false, error: 'bad signature' } } }];`, row(1), { secrets: true }),
    iff('Signed by WordPress?', '={{ $json.ok }}', row(2)),
    respond('Reply 202', row(3, -1), { code: 202 }),
    respond('Reply 401', row(3, 1), { code: 401 }),
    code('Tidy the submission', `
const p = $('Check signature').first().json.payload;
const f = p.fields || {};
const variant = p.variant === 'grant' ? 'grant' : 'practice';
const website = String(f.website || '').trim();
return [{ json: {
  token: p.token, site: p.site, variant, callback_url: p.callback_url, submitted_at: p.submitted_at, fields: f, tracking: p.tracking || {},
  business: variant === 'grant' ? f.org_name : f.business, website, email: String(f.email || '').toLowerCase(),
  source: LIB.classifySource(p.tracking || {}), site_name: CFG.siteNames[p.site] || p.site,
} }];`, row(4, -1), { lib: true }),
    http('CRM: seen them before?', row(5, -1), { url: `${CFG.crm}/api/lookup`, cred: 'crm', query: { email: '={{ $json.email }}', website: '={{ $json.website }}' }, neverError: true }),
    code('Open their website', `
const t = $('Tidy the submission').first().json;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36 MDRLeadHub/1.0';
async function get(url) {
  const t0 = Date.now();
  try {
    const r = await this.helpers.httpRequest({ url, method: 'GET', returnFullResponse: true, ignoreHttpStatusErrors: true, timeout: 15000, headers: { 'User-Agent': UA, Accept: 'text/html' } });
    return { ok: r.statusCode >= 200 && r.statusCode < 400, status: r.statusCode, html: typeof r.body === 'string' ? r.body : '', ms: Date.now() - t0, url };
  } catch (e) { return { ok: false, status: 0, html: '', ms: Date.now() - t0, url, error: e.message }; }
}
let url = /^https?:\\/\\//i.test(t.website) ? t.website : 'https://' + t.website;
let r = await get.call(this, url.replace(/^http:/i, 'https:'));
if (!r.ok) { const r2 = await get.call(this, url.replace(/^https:/i, 'http:')); if (r2.ok) r = r2; }
const site = LIB.readWebsite(r.html.slice(0, 800000), { ok: r.ok, status: r.status, finalUrl: r.url, ms: r.ms });
const dupes = ($('CRM: seen them before?').first().json.duplicates || []);
return [{ json: { site, duplicate: dupes[0] ? { id: dupes[0].id, assignee: dupes[0].assignee, assignee_email: dupes[0].assignee_email, slack_channel: dupes[0].slack_channel, slack_ts: dupes[0].slack_ts, created_at: dupes[0].created_at } : null } }];`, row(6, -1), { lib: true }),
    code('Lighthouse address', `
const site = $('Open their website').first().json.site;
const t = $('Tidy the submission').first().json;
const url = site.reachable ? (site.final_url || t.website) : '';
return [{ json: { b64: url ? Buffer.from(url).toString('base64url') : '', skip: !url } }];`, row(7, -1)),
    node('Lighthouse (mobile, on this PC)', 'n8n-nodes-base.executeCommand', 1, { command: `={{ $json.skip ? 'echo skipped' : 'node "${root.replace(/\\/g, '/')}/tools/lh.mjs" ' + $json.b64 }}` }, row(8, -1), { onError: 'continueRegularOutput', alwaysOutputData: true }),
    iff('Nonprofit form?', "={{ $('Tidy the submission').first().json.variant === 'grant' }}", row(9, -1)),
    code('IRS lookup (ProPublica)', `
const f = $('Tidy the submission').first().json.fields;
const base = 'https://projects.propublica.org/nonprofits/api/v2';
const norm = (s) => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]/g, ' ').replace(/\\b(inc|incorporated|the|of|corp|corporation|org|foundation)\\b/g, ' ').replace(/\\s+/g, ' ').trim();
let irs = { found: false };
try {
  const ein = String(f.ein || '').replace(/\\D/g, '');
  if (ein.length === 9) {
    const r = await this.helpers.httpRequest({ url: base + '/organizations/' + ein + '.json', json: true, timeout: 15000 });
    const o = r && r.organization;
    if (o) irs = { found: true, name: o.name, city: o.city, state: o.state, ein: String(o.ein).replace(/^(\\d{2})/, '$1-'), subsection: o.subsection_code, via: 'ein' };
  } else {
    const r = await this.helpers.httpRequest({ url: base + '/search.json', qs: { q: f.org_name, 'state[id]': f.state }, json: true, timeout: 15000 });
    const want = norm(f.org_name);
    const best = (r.organizations || []).find((o) => norm(o.name) === want) || (r.organizations || []).find((o) => norm(o.name).includes(want) || want.includes(norm(o.name)));
    if (best) irs = { found: true, name: best.name, city: best.city, state: best.state, ein: String(best.ein).padStart(9, '0').replace(/^(\\d{2})/, '$1-'), via: 'name' };
  }
} catch (e) { irs = { found: false, error: e.message }; }
return [{ json: { irs } }];`, row(9, -2)),
    code('Score the website', `
const t = $('Tidy the submission').first().json;
const site = $('Open their website').first().json.site;
let psi = null;
try { psi = JSON.parse(String($('Lighthouse (mobile, on this PC)').first().json.stdout || '').trim().split(String.fromCharCode(10)).pop()); } catch (e) {}
let irs = null;
try { irs = $('IRS lookup (ProPublica)').first().json.irs; } catch (e) {}
const speed = LIB.speedFrom(psi, site);
const audit = LIB.buildAudit(t.variant, t.fields, site, speed, irs);
const pub = LIB.publicResult(t.variant, t.fields, audit);
${SIGN}
return [{ json: { audit, ...signed({ token: t.token, stage: 'audit', public: pub }) } }];`, row(10, -1), { lib: true, secrets: true }),
    http('WordPress: show results', row(11, -1), {
      method: 'POST', url: "={{ $('Tidy the submission').first().json.callback_url }}", raw: '={{ $json.body_str }}',
      headers: { 'X-MDR-Timestamp': '={{ $json.ts }}', 'X-MDR-Signature': '={{ $json.sig }}' }, neverError: true, continueOnFail: true,
    }),
    code('Rules first', `
const t = $('Tidy the submission').first().json;
const audit = $('Score the website').first().json.audit;
const rule = LIB.rules(t.variant, t.fields, audit);
return [{ json: { rule, ask_ai: rule.hard !== 'spam' } }];`, row(12, -1), { lib: true }),
    iff('Worth asking the AI?', '={{ $json.ask_ai }}', row(13, -1)),
    http('CRM: past corrections', row(14, -2), { url: `${CFG.crm}/api/examples`, cred: 'crm', query: { limit: '5' }, neverError: true }),
    code('Write the prompt', `
const t = $('Tidy the submission').first().json;
const audit = $('Score the website').first().json.audit;
const site = $('Open their website').first().json.site;
const ex = $input.first().json.examples || [];
const pr = LIB.buildPrompt(t.variant, t.fields, audit, t.source, site.excerpt, ex);
return [{ json: { body: { model: CFG.model, stream: false, format: pr.schema, options: { temperature: 0.2, num_ctx: 4096 },
  messages: [{ role: 'system', content: pr.system }, { role: 'user', content: pr.user }] } } }];`, row(15, -2), { lib: true }),
    http('Ollama qwen2.5:7b', row(16, -2), { method: 'POST', url: CFG.ollama, json: '={{ JSON.stringify($json.body) }}', timeout: 240000, neverError: true, continueOnFail: true }),
    code('Decide the verdict', `
const t = $('Tidy the submission').first().json;
const rule = $('Rules first').first().json.rule;
let ai = null, raw = null;
try { raw = $('Ollama qwen2.5:7b').first().json; ai = LIB.parseAi(raw && raw.message && raw.message.content); } catch (e) {}
const d = LIB.decide(t.variant, t.fields, rule, ai);
const size = ai ? ai.size : null;
return [{ json: { decision: d, ai: ai ? { ...ai, model: CFG.model, rule_points: rule.points, rule_notes: rule.notes } : { rule_points: rule.points, rule_notes: rule.notes, summary: '' } } }];`, row(17, -1), { lib: true }),
    sheetRead('Sheet: team roster', '1123782870', row(18, -1)),
    http('CRM: open leads per rep', row(19, -1), { url: `${CFG.crm}/api/workload`, cred: 'crm', neverError: true }),
    code('Pick the rep', `
const t = $('Tidy the submission').first().json;
const { decision: d, ai } = $('Decide the verdict').first().json;
const audit = $('Score the website').first().json.audit;
const dup = $('Open their website').first().json.duplicate;
const roster = LIB.parseRoster($('Sheet: team roster').all().map((i) => i.json));
const open = $input.first().json.open || {};
let rep = d.verdict === 'spam' ? null : LIB.pickRep(roster, d.segment, open);
if (dup && dup.assignee) rep = roster.find((r) => r.name === dup.assignee) || rep;
const f = t.fields;
const lead = {
  site: t.site, variant: t.variant, token: t.token, business: t.business, contact_name: f.name, email: t.email, phone: f.phone || null,
  website: t.website, location: t.variant === 'grant' ? f.state : f.zip, segment: d.segment, size: ai.size || null,
  interest: f.goals || [], fields: f, tracking: t.tracking, source: t.source, audit, ai: { ...ai, reasons: d.why }, score: d.score,
  verdict: d.verdict, verdict_by: d.by, assignee: rep ? rep.name : null, assignee_email: rep ? rep.email : null,
  slack_channel: rep ? rep.channel : null, duplicate_of: dup ? dup.id : null, created_at: t.submitted_at,
  event: { type: 'scored', actor: d.by === 'rules' ? 'n8n rules' : 'n8n + ' + CFG.model, detail: { verdict: d.verdict, score: d.score, segment: d.segment, assignee: rep && rep.name } },
};
return [{ json: { lead, rep, dup, roster } }];`, row(20, -1), { lib: true }),
    http('CRM: save the lead', row(21, -1), { method: 'POST', url: `${CFG.crm}/api/leads`, cred: 'crm', json: '={{ JSON.stringify($json.lead) }}' }),
    code('Write Slack, Asana and email', `
const { rep, dup, roster } = $('Pick the rep').first().json;
const saved = $input.first().json.lead;
const why = (saved.ai && saved.ai.reasons) || [];
const L = { ...saved, why };
const crmUrl = CFG.crmPublic + '/leads/' + saved.id;
const t = $('Tidy the submission').first().json;
const out = { id: saved.id, verdict: saved.verdict, crmUrl, rep, spam: saved.verdict === 'spam', dup: !!dup };
if (!out.spam) {
  if (dup && dup.slack_ts) {
    out.slack = { channel: dup.slack_channel, thread_ts: dup.slack_ts, text: 'Same people again, ' + new Date(t.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', through ' + t.site_name + '. Nothing new got routed. <' + crmUrl + '|' + saved.id + '>' };
  } else {
    const m = MSG.slackLead(L, { lib: LIB, crmUrl, rep });
    out.slack = { channel: rep ? rep.channel : CFG.opsChannel, text: m.text, blocks: m.blocks, unfurl_links: false };
  }
  const needsTask = !dup && (saved.verdict === 'hot' || saved.verdict === 'talk');
  const due = new Date(Date.now() + (saved.verdict === 'hot' ? 24 : 48) * 3600e3);
  out.asanaDue = needsTask ? due.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET' : null;
  if (needsTask) {
    const f = saved.fields;
    out.asana = { data: {
      name: (saved.verdict === 'hot' ? 'Call ' : 'Talk to ') + (f.name || '') + ' at ' + saved.business + ' (' + (rep ? rep.name : 'unassigned') + ')',
      html_notes: '<body><strong>' + MSG.esc(LIB.VERDICT_LABEL[saved.verdict]) + ', score ' + saved.score + '.</strong> ' + MSG.esc((saved.ai && saved.ai.summary) || '') +
        '<ul>' + why.map((w) => '<li>' + MSG.esc(w) + '</li>').join('') + '</ul>' +
        (saved.ai && saved.ai.opening_line ? '<em>Opening line: ' + MSG.esc(saved.ai.opening_line) + '</em>\\n' : '') +
        'Contact: ' + MSG.esc(f.name) + ', ' + MSG.esc(f.email) + (f.phone ? ', ' + MSG.esc(f.phone) : '') + '\\n<a href="' + crmUrl + '">' + saved.id + ' in the CRM</a></body>',
      assignee: CFG.asanaUser, due_at: due.toISOString(),
      projects: [CFG.asanaProject],
    } };
    out.asanaSection = saved.verdict === 'hot' ? CFG.asanaSections.hot : CFG.asanaSections.talk;
  }
  const emails = [];
  if (rep && !dup && ['hot', 'warm', 'talk'].includes(saved.verdict)) {
    const e = MSG.repEmail(L, { lib: LIB, rep, crmUrl, siteName: t.site_name, asanaDue: out.asanaDue });
    emails.push({ to: [{ email: rep.email, name: rep.name }], subject: e.subject, htmlContent: e.html, tags: ['mdr-rep'] });
  }
  const pe = MSG.prospectEmail(L, { lib: LIB, rep });
  emails.push({ to: [{ email: saved.email, name: saved.contact_name || '' }], subject: pe.subject, htmlContent: pe.html, replyTo: rep ? { email: rep.email, name: rep.name } : undefined, tags: ['mdr-prospect'] });
  out.emails = emails.map((e) => ({ sender: { name: 'Marketing Done Right', email: CFG.sender }, ...e }));
}
return [{ json: out }];`, row(22, -1), { lib: true, msg: true }),
    iff('Real lead?', '={{ !$json.spam }}', row(23, -1)),
    http('Slack: post to the rep’s channel', row(24, -2), { method: 'POST', url: 'https://slack.com/api/chat.postMessage', cred: 'slack', json: '={{ JSON.stringify($json.slack) }}' }),
    iff('Needs an Asana task?', "={{ !!$('Write Slack, Asana and email').first().json.asana }}", row(25, -2)),
    http('Asana: create follow-up task', row(26, -3), { method: 'POST', url: 'https://app.asana.com/api/1.0/tasks', cred: 'asana', json: "={{ JSON.stringify($('Write Slack, Asana and email').first().json.asana) }}" }),
    http('Asana: put it in the right column', row(27, -3), { method: 'POST', url: "={{ 'https://app.asana.com/api/1.0/sections/' + $('Write Slack, Asana and email').first().json.asanaSection + '/addTask' }}", cred: 'asana', json: "={{ JSON.stringify({ data: { task: $json.data.gid } }) }}" }),
    code('Emails to send', `
const m = $('Write Slack, Asana and email').first().json;
return (m.emails || []).map((e) => ({ json: e }));`, row(27, -2)),
    http('Brevo: send email', row(28, -2), { method: 'POST', url: 'https://api.brevo.com/v3/smtp/email', cred: 'brevo', json: '={{ JSON.stringify($json) }}', neverError: true }),
    code('Gather the links', `
const m = $('Write Slack, Asana and email').first().json;
const slack = $('Slack: post to the rep’s channel').first().json;
let asana = null;
try { asana = $('Asana: create follow-up task').first().json.data; } catch (e) {}
const mails = $('Brevo: send email').all().map((i) => i.json.messageId || i.json.message || 'sent');
const lead = $('CRM: save the lead').first().json.lead;
const slackOk = slack && slack.ok;
const patch = {
  slack_ts: slackOk && !m.dup ? slack.ts : undefined, slack_channel: slackOk && !m.dup ? slack.channel : undefined,
  asana_task_gid: asana ? asana.gid : undefined, asana_project_gid: asana ? CFG.asanaProject : undefined,
  event: { type: 'routed', actor: 'n8n', detail: { slack: slackOk ? (m.dup ? 'thread reply' : 'posted') : (slack && slack.error) || 'failed', asana: asana ? asana.permalink_url : null, emails: mails.length, rep: m.rep && m.rep.name } },
};
const sheetRow = {
  'Lead ID': lead.id, Received: new Date(lead.created_at).toLocaleString('en-US', { timeZone: 'America/New_York' }), Site: CFG.siteNames[lead.site],
  Business: lead.business, Contact: lead.contact_name, Email: lead.email, Phone: lead.phone || '', Website: lead.website,
  Segment: LIB.SEGMENT_LABEL[lead.segment] || lead.segment, Verdict: LIB.VERDICT_LABEL[lead.verdict], Score: lead.score,
  'Assigned to': lead.assignee || '', Stage: 'New', Source: lead.source, Summary: (lead.ai && lead.ai.summary) || '', CRM: m.crmUrl,
  Updated: new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }),
};
return [{ json: { patch, sheetRow, id: lead.id } }];`, row(29, -1), { lib: true }),
    http('CRM: add Slack and Asana links', row(30, -1), { method: 'PATCH', url: `={{ '${CFG.crm}/api/leads/' + $json.id }}`, cred: 'crm', json: '={{ JSON.stringify($json.patch) }}' }),
    code('Sheet row', `return [{ json: $('Gather the links').first().json.sheetRow }];`, row(31, -1)),
    sheetUpsert('Sheet: log the lead', '1670369092', row(32, -1)),
    code('Tell the visitor who’s calling', `
const t = $('Tidy the submission').first().json;
let rep = null, id = null, verdict = null;
try { const m = $('Write Slack, Asana and email').first().json; rep = m.rep; id = m.id; verdict = m.verdict; } catch (e) {}
const pub = rep && verdict !== 'spam' ? { rep: { name: rep.name, first: LIB.firstName(rep.name), role: rep.role } } : {};
${SIGN}
return [{ json: signed({ token: t.token, stage: 'routed', public: pub, lead_id: id, verdict }) }];`, row(33, -1), { lib: true, secrets: true }),
    http('WordPress: name the strategist', row(34, -1), {
      method: 'POST', url: "={{ $('Tidy the submission').first().json.callback_url }}", raw: '={{ $json.body_str }}',
      headers: { 'X-MDR-Timestamp': '={{ $json.ts }}', 'X-MDR-Signature': '={{ $json.sig }}' }, neverError: true,
    }),
  ];
  const connections = wire([
    ['WordPress form in', 'Check signature'], ['Check signature', 'Signed by WordPress?'],
    ['Signed by WordPress?', 'Reply 202', 0], ['Signed by WordPress?', 'Reply 401', 1],
    ['Reply 202', 'Tidy the submission'], ['Tidy the submission', 'CRM: seen them before?'], ['CRM: seen them before?', 'Open their website'],
    ['Open their website', 'Lighthouse address'], ['Lighthouse address', 'Lighthouse (mobile, on this PC)'], ['Lighthouse (mobile, on this PC)', 'Nonprofit form?'],
    ['Nonprofit form?', 'IRS lookup (ProPublica)', 0], ['Nonprofit form?', 'Score the website', 1], ['IRS lookup (ProPublica)', 'Score the website'],
    ['Score the website', 'WordPress: show results'], ['WordPress: show results', 'Rules first'], ['Rules first', 'Worth asking the AI?'],
    ['Worth asking the AI?', 'CRM: past corrections', 0], ['Worth asking the AI?', 'Decide the verdict', 1],
    ['CRM: past corrections', 'Write the prompt'], ['Write the prompt', 'Ollama qwen2.5:7b'], ['Ollama qwen2.5:7b', 'Decide the verdict'],
    ['Decide the verdict', 'Sheet: team roster'], ['Sheet: team roster', 'CRM: open leads per rep'], ['CRM: open leads per rep', 'Pick the rep'],
    ['Pick the rep', 'CRM: save the lead'], ['CRM: save the lead', 'Write Slack, Asana and email'], ['Write Slack, Asana and email', 'Real lead?'],
    ['Real lead?', 'Slack: post to the rep’s channel', 0], ['Real lead?', 'Tell the visitor who’s calling', 1],
    ['Slack: post to the rep’s channel', 'Needs an Asana task?'], ['Needs an Asana task?', 'Asana: create follow-up task', 0], ['Needs an Asana task?', 'Emails to send', 1],
    ['Asana: create follow-up task', 'Asana: put it in the right column'], ['Asana: put it in the right column', 'Emails to send'], ['Emails to send', 'Brevo: send email'], ['Brevo: send email', 'Gather the links'],
    ['Gather the links', 'CRM: add Slack and Asana links'], ['CRM: add Slack and Asana links', 'Sheet row'], ['Sheet row', 'Sheet: log the lead'],
    ['Sheet: log the lead', 'Tell the visitor who’s calling'], ['Tell the visitor who’s calling', 'WordPress: name the strategist'],
  ]);
  return { name: wfName, nodes, connections };
}

/* =====================================================================
   W8  MDR · Error alerts
   ===================================================================== */
function errors() {
  wfName = 'MDR · Error alerts';
  return {
    name: wfName,
    nodes: [
      node('When an MDR workflow fails', 'n8n-nodes-base.errorTrigger', 1, {}, row(0)),
      code('Write the alert', `
const e = $input.first().json;
const wf = (e.workflow && e.workflow.name) || 'A workflow';
const node = (e.execution && e.execution.lastNodeExecuted) || 'unknown step';
const msg = (e.execution && e.execution.error && e.execution.error.message) || 'no message';
const url = e.execution && e.execution.url;
return [{ json: { channel: CFG.opsChannel, text: ':rotating_light: ' + wf + ' failed at "' + node + '": ' + String(msg).slice(0, 300) + (url ? ' <' + url + '|Open the run>' : ''), unfurl_links: false } }];`, row(1)),
      http('Slack: post to #mdr-ops', row(2), { method: 'POST', url: 'https://slack.com/api/chat.postMessage', cred: 'slack', json: '={{ JSON.stringify($json) }}' }),
    ],
    connections: wire([['When an MDR workflow fails', 'Write the alert'], ['Write the alert', 'Slack: post to #mdr-ops']]),
  };
}

/* shared: check the CRM's key on an internal webhook */
const KEY_CHECK = (extra = '') => `
const crypto = require('crypto');
const h = $input.first().json.headers || {};
const got = String(h['x-mdr-key'] || '');
const ok = got.length === SECRET.crm.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(SECRET.crm));
${extra}
return [{ json: { ok, body: $input.first().json.body || {}, query: $input.first().json.query || {}, response: ok ? { ok: true } : { ok: false, error: 'bad key' } } }];`;

/* =====================================================================
   W7  MDR · Roster (the CRM's Team page reads the Sheet through this)
   ===================================================================== */
function rosterWf() {
  wfName = 'MDR · Roster';
  return {
    name: wfName,
    nodes: [
      webhook('CRM asks for the roster', 'mdr-roster', row(0), { method: 'GET' }),
      code('Check the CRM key', KEY_CHECK(), row(1), { secrets: true }),
      iff('From the CRM?', '={{ $json.ok }}', row(2)),
      sheetRead('Sheet: team roster', '1123782870', row(3, -1)),
      code('Shape the roster', `
const reps = $input.all().map((i) => i.json).filter((r) => r.Rep).map((r) => ({
  name: String(r.Rep).trim(), email: String(r.Email || '').trim(), role: String(r.Role || '').trim(),
  covers: String(r.Covers || '').split(',').map((s) => s.trim()).filter(Boolean), channel: String(r['Slack channel'] || '').replace(/^#/, ''),
  active: String(r.Active || '').toLowerCase().startsWith('y'),
}));
return [{ json: { response: { reps } } }];`, row(4, -1)),
      respond('Send it back', row(5, -1)),
      respond('Reply 401', row(3, 1), { code: 401 }),
    ],
    connections: wire([
      ['CRM asks for the roster', 'Check the CRM key'], ['Check the CRM key', 'From the CRM?'], ['From the CRM?', 'Sheet: team roster', 0], ['From the CRM?', 'Reply 401', 1],
      ['Sheet: team roster', 'Shape the roster'], ['Shape the roster', 'Send it back'],
    ]),
  };
}

/* =====================================================================
   W4  MDR · Sync a change everywhere
   Called by the CRM (a person clicked something), by W2 (Slack button) and W3 (Asana).
   The CRM database is already updated; this brings Slack, Asana, the Sheet and email in line.
   ===================================================================== */
function sync() {
  wfName = 'MDR · Sync a change everywhere';
  const nodes = [
    webhook('A lead changed', 'mdr-crm-event', row(0)),
    code('Check the CRM key', KEY_CHECK(), row(1), { secrets: true }),
    iff('Trusted caller?', '={{ $json.ok }}', row(2)),
    respond('Reply 200', row(3, -1)),
    respond('Reply 401', row(3, 1), { code: 401 }),
    http('CRM: load the lead', row(4, -1), { url: `={{ '${CFG.crm}/api/leads/' + $('Check the CRM key').first().json.body.lead_id }}`, cred: 'crm' }),
    sheetRead('Sheet: team roster', '1123782870', row(5, -1)),
    code('Plan the updates', `
const ev = $('Check the CRM key').first().json.body;           // { action, lead_id, from, to, note, by, origin }
const lead = $('CRM: load the lead').first().json.lead;
const roster = LIB.parseRoster($('Sheet: team roster').all().map((i) => i.json));
const crmUrl = CFG.crmPublic + '/leads/' + lead.id;
const stamp = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
const by = ev.by || 'Someone';
const where = ev.origin === 'slack' ? 'in Slack' : ev.origin === 'asana' ? 'in Asana' : 'in the CRM';
const STAGE = { new: 'New', contacted: 'Contacted', booked: 'Booked', won: 'Won', lost: 'Lost' };
const plan = { lead, crmUrl, asana: [], emails: [], onboarding: false, log: [] };
let status = '', thread = '';
if (ev.action === 'stage') {
  const icon = { contacted: '📞', booked: '📅', won: '🏆', lost: '🪦', new: '↩️' }[ev.to] || '•';
  status = icon + ' ' + STAGE[ev.to] + ', by ' + by + ' ' + where + ', ' + stamp;
  thread = by + ' moved this from ' + STAGE[ev.from] + ' to ' + STAGE[ev.to] + ' ' + where + '.';
  if (lead.asana_task_gid && ev.origin !== 'asana') {
    const t = lead.asana_task_gid;
    if (ev.to === 'contacted') plan.asana.push({ method: 'POST', url: 'https://app.asana.com/api/1.0/sections/' + CFG.asanaSections.contacted + '/addTask', body: { data: { task: t } } });
    if (ev.to === 'booked') plan.asana.push({ method: 'POST', url: 'https://app.asana.com/api/1.0/sections/' + CFG.asanaSections.booked + '/addTask', body: { data: { task: t } } });
    if (ev.to === 'won' || ev.to === 'lost') plan.asana.push({ method: 'PUT', url: 'https://app.asana.com/api/1.0/tasks/' + t, body: { data: { completed: true } } });
    plan.asana.push({ method: 'POST', url: 'https://app.asana.com/api/1.0/tasks/' + t + '/stories', body: { data: { text: thread + ' ' + crmUrl } } });
  }
  if (ev.to === 'won') plan.onboarding = true;
  plan.log.push(STAGE[ev.to] + ' in Slack, Asana and the Sheet');
}
if (ev.action === 'override') {
  status = '✏️ ' + by + ' changed the verdict to ' + LIB.VERDICT_LABEL[ev.to] + ' ' + where + (ev.note ? ': “' + ev.note + '”' : '') + ', ' + stamp;
  thread = by + ' changed the AI’s verdict from ' + LIB.VERDICT_LABEL[ev.from] + ' to ' + LIB.VERDICT_LABEL[ev.to] + (ev.note ? ' because: ' + ev.note : '') + '. Saved as an example for the model.';
  if (lead.asana_task_gid && ['not_fit', 'spam'].includes(ev.to) && ev.origin !== 'asana') {
    plan.asana.push({ method: 'PUT', url: 'https://app.asana.com/api/1.0/tasks/' + lead.asana_task_gid, body: { data: { completed: true } } });
    plan.asana.push({ method: 'POST', url: 'https://app.asana.com/api/1.0/tasks/' + lead.asana_task_gid + '/stories', body: { data: { text: thread } } });
  }
  plan.log.push('Verdict change pushed to Slack, Asana and the Sheet');
}
if (ev.action === 'reassign') {
  const rep = roster.find((r) => r.name === ev.to);
  status = '🔁 Handed to ' + ev.to + ' by ' + by + ', ' + stamp;
  thread = by + ' handed this lead to ' + ev.to + (ev.from ? ' (was ' + ev.from + ')' : '') + '.';
  if (rep && rep.email) {
    const e = MSG.repEmail({ ...lead, why: (lead.ai && lead.ai.reasons) || [] }, { lib: LIB, rep, crmUrl, siteName: CFG.siteNames[lead.site] });
    plan.emails.push({ sender: { name: 'Marketing Done Right', email: CFG.sender }, to: [{ email: rep.email, name: rep.name }], subject: 'Handed to you: ' + e.subject.replace(/^.*?lead for you: /, ''), htmlContent: e.html });
  }
  if (lead.asana_task_gid) plan.asana.push({ method: 'POST', url: 'https://app.asana.com/api/1.0/tasks/' + lead.asana_task_gid + '/stories', body: { data: { text: thread } } });
  plan.log.push('Handover sent to ' + ev.to);
}
const rep = roster.find((r) => r.name === lead.assignee) || null;
if (lead.slack_ts && lead.slack_channel) {
  const m = MSG.slackLead({ ...lead, why: (lead.ai && lead.ai.reasons) || [] }, { lib: LIB, crmUrl, rep, status });
  plan.slackUpdate = { channel: lead.slack_channel, ts: lead.slack_ts, text: m.text, blocks: m.blocks };
  plan.slackThread = { channel: lead.slack_channel, thread_ts: lead.slack_ts, text: thread, unfurl_links: false };
}
plan.sheetRow = {
  'Lead ID': lead.id, Verdict: LIB.VERDICT_LABEL[lead.verdict] || '', Stage: STAGE[lead.stage] || lead.stage, 'Assigned to': lead.assignee || '',
  Updated: new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }),
};
if (plan.onboarding) {
  const f = lead.fields || {};
  const day = (n) => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);
  plan.project = { data: { name: 'Onboarding: ' + lead.business, workspace: CFG.asanaWorkspace, default_view: 'list', notes: 'Won ' + stamp + ' by ' + (lead.assignee || by) + '. Lead ' + lead.id + ': ' + crmUrl } };
  plan.projectTasks = (lead.variant === 'grant' ? [
    ['Kickoff call with ' + (f.name || 'the contact'), 1], ['Confirm 501(c)(3) letter and Google for Nonprofits account', 2], ['Apply for (or take over) the Ad Grants account', 4],
    ['Build mission-focused campaigns and conversion tracking', 7], ['Compliance check: 5% CTR, conversions, account structure', 14], ['First monthly report to ' + (f.name || 'the client'), 30],
  ] : [
    ['Kickoff call with ' + (f.name || 'the contact'), 1], ['Get access: website, Google Business Profile, Analytics, Search Console', 2], ['Full SEO and speed audit of ' + (lead.website || 'the site'), 5],
    ['Fix the checkup issues (speed, titles, local schema)', 10], ['Set up Google Ads and call tracking', 10], ['30-day results review', 30],
  ]).map(([name, d]) => ({ name, due_on: day(d) }));
}
return [{ json: plan }];`, row(6, -1), { lib: true, msg: true }),
    iff('Slack message to update?', '={{ !!$json.slackUpdate }}', row(7, -1)),
    http('Slack: refresh the lead message', row(8, -2), { method: 'POST', url: 'https://slack.com/api/chat.update', cred: 'slack', json: "={{ JSON.stringify($('Plan the updates').first().json.slackUpdate) }}" }),
    http('Slack: note it in the thread', row(9, -2), { method: 'POST', url: 'https://slack.com/api/chat.postMessage', cred: 'slack', json: "={{ JSON.stringify($('Plan the updates').first().json.slackThread) }}" }),
    iff('Asana changes?', "={{ $('Plan the updates').first().json.asana.length > 0 }}", row(10, -1)),
    code('Asana steps', `return $('Plan the updates').first().json.asana.map((a) => ({ json: a }));`, row(11, -2)),
    http('Asana: apply', row(12, -2), { method: '={{ $json.method }}', url: '={{ $json.url }}', cred: 'asana', json: '={{ JSON.stringify($json.body) }}', neverError: true }),
    code('Asana done', `return [{ json: { asana: $input.all().length } }];`, row(13, -2)),
    iff('Won? Start onboarding', "={{ $('Plan the updates').first().json.onboarding }}", row(14, -1)),
    http('Asana: create onboarding project', row(15, -2), { method: 'POST', url: 'https://app.asana.com/api/1.0/projects', cred: 'asana', json: "={{ JSON.stringify($('Plan the updates').first().json.project) }}" }),
    code('Onboarding tasks', `
const p = $input.first().json.data;
return $('Plan the updates').first().json.projectTasks.map((t) => ({ json: { data: { name: t.name, due_on: t.due_on, projects: [p.gid], assignee: CFG.asanaUser } } }));`, row(16, -2)),
    http('Asana: add onboarding task', row(17, -2), { method: 'POST', url: 'https://app.asana.com/api/1.0/tasks', cred: 'asana', json: '={{ JSON.stringify($json) }}' }),
    code('Onboarding done', `
const p = $('Asana: create onboarding project').first().json.data;
return [{ json: { project: p.gid, url: p.permalink_url, tasks: $input.all().length } }];`, row(18, -2)),
    code('Sheet update', `return [{ json: $('Plan the updates').first().json.sheetRow }];`, row(19, -1)),
    sheetUpsert('Sheet: update the row', '1670369092', row(20, -1)),
    code('Emails to send', `return ($('Plan the updates').first().json.emails || []).map((e) => ({ json: e }));`, row(21, -1), { }),
    http('Brevo: send email', row(22, -1), { method: 'POST', url: 'https://api.brevo.com/v3/smtp/email', cred: 'brevo', json: '={{ JSON.stringify($json) }}', neverError: true }),
    code('What happened', `
const plan = $('Plan the updates').first().json;
let onboarding = null;
try { onboarding = $('Onboarding done').first().json; } catch (e) {}
const events = [{ type: 'synced', actor: 'n8n', detail: { what: plan.log.join('. ') } }];
if (onboarding) events.push({ type: 'onboarding', actor: 'n8n', detail: { url: onboarding.url, tasks: onboarding.tasks } });
return events.map((e) => ({ json: { id: plan.lead.id, ...e } }));`, row(23, -1)),
    http('CRM: log it on the timeline', row(24, -1), { method: 'POST', url: `={{ '${CFG.crm}/api/leads/' + $json.id + '/events' }}`, cred: 'crm', json: '={{ JSON.stringify({ type: $json.type, actor: $json.actor, detail: $json.detail }) }}' }),
  ];
  nodes.find((n) => n.name === 'Emails to send').alwaysOutputData = false;
  const connections = wire([
    ['A lead changed', 'Check the CRM key'], ['Check the CRM key', 'Trusted caller?'], ['Trusted caller?', 'Reply 200', 0], ['Trusted caller?', 'Reply 401', 1],
    ['Reply 200', 'CRM: load the lead'], ['CRM: load the lead', 'Sheet: team roster'], ['Sheet: team roster', 'Plan the updates'], ['Plan the updates', 'Slack message to update?'],
    ['Slack message to update?', 'Slack: refresh the lead message', 0], ['Slack message to update?', 'Asana changes?', 1],
    ['Slack: refresh the lead message', 'Slack: note it in the thread'], ['Slack: note it in the thread', 'Asana changes?'],
    ['Asana changes?', 'Asana steps', 0], ['Asana changes?', 'Won? Start onboarding', 1], ['Asana steps', 'Asana: apply'], ['Asana: apply', 'Asana done'], ['Asana done', 'Won? Start onboarding'],
    ['Won? Start onboarding', 'Asana: create onboarding project', 0], ['Won? Start onboarding', 'Sheet update', 1],
    ['Asana: create onboarding project', 'Onboarding tasks'], ['Onboarding tasks', 'Asana: add onboarding task'], ['Asana: add onboarding task', 'Onboarding done'], ['Onboarding done', 'Sheet update'],
    ['Sheet update', 'Sheet: update the row'], ['Sheet: update the row', 'Emails to send'], ['Emails to send', 'Brevo: send email'],
    ['What happened', 'CRM: log it on the timeline'],
  ]);
  // No emails is the usual case: let the log step run anyway.
  connections['Sheet: update the row'].main[0].push({ node: 'What happened', type: 'main', index: 0 });
  return { name: wfName, nodes, connections };
}

/* =====================================================================
   W2  MDR · Slack buttons  (public, through the tunnel)
   ===================================================================== */
function slackButtons() {
  wfName = 'MDR · Slack buttons';
  const nodes = [
    webhook('Slack button clicked', 'mdr-slack', row(0), { raw: true }),
    code('Check it came from Slack', `
const crypto = require('crypto');
const item = $input.first();
let raw;
try { raw = await this.helpers.getBinaryDataBuffer(0, 'data'); }
catch (e) { raw = Buffer.from((item.binary && item.binary.data && item.binary.data.data) || '', 'base64'); }
const h = item.json.headers || {};
const ts = String(h['x-slack-request-timestamp'] || '');
const want = 'v0=' + crypto.createHmac('sha256', SECRET.slack).update('v0:' + ts + ':' + raw.toString('utf8')).digest('hex');
const got = String(h['x-slack-signature'] || '');
const fresh = Math.abs(Date.now() / 1000 - Number(ts)) < 300;
const ok = fresh && got.length === want.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
let p = null;
if (ok) { try { p = JSON.parse((item.json.body && item.json.body.payload) || '{}'); } catch (e) {} }   // n8n already decoded the form body
const a = p && p.actions && p.actions[0];
const map = { mdr_contacted: { action: 'stage', to: 'contacted' }, mdr_booked: { action: 'stage', to: 'booked' }, mdr_not_fit: { action: 'override', to: 'not_fit' } };
const todo = a && map[a.action_id] ? { ...map[a.action_id], lead_id: a.value, user_id: p.user && p.user.id, by: (p.user && (p.user.name || p.user.username)) || 'Someone', origin: 'slack' } : null;
return [{ json: { ok: !!p, todo, response: {}} }];`, row(1), { secrets: true }),
    iff('Signed by Slack?', '={{ $json.ok }}', row(2)),
    respond('Ack within 3 seconds', row(3, -1), { body: '' }),
    respond('Reply 401', row(3, 1), { code: 401 }),
    iff('A button that changes something?', "={{ !!$('Check it came from Slack').first().json.todo }}", row(4, -1)),
    http('Slack: who clicked?', row(5, -3), { url: 'https://slack.com/api/users.info', cred: 'slack', query: { user: "={{ $('Check it came from Slack').first().json.todo.user_id }}" }, neverError: true }),
    http('CRM: load the lead', row(5, -2), { url: `={{ '${CFG.crm}/api/leads/' + $('Check it came from Slack').first().json.todo.lead_id }}`, cred: 'crm' }),
    code('Work out the change', `
const t = { ...$('Check it came from Slack').first().json.todo };
try { const u = $('Slack: who clicked?').first().json.user; if (u) t.by = (u.profile && u.profile.real_name) || u.real_name || t.by; } catch (e) {}
const lead = $input.first().json.lead;
const who = 'Slack: ' + t.by;
let patch = null, ev = null;
if (t.action === 'stage' && lead.stage !== t.to) {
  patch = { stage: t.to, ...(lead.first_contact_at ? {} : { first_contact_at: new Date().toISOString() }), event: { type: 'stage', actor: who, detail: { from: lead.stage, to: t.to } } };
  ev = { action: 'stage', lead_id: lead.id, from: lead.stage, to: t.to, by: t.by, origin: 'slack' };
}
if (t.action === 'override' && lead.verdict !== t.to) {
  const note = 'Marked not a fit from Slack';
  patch = { verdict: t.to, verdict_by: 'person', correction: { from: lead.verdict, to: t.to, note, by: t.by }, event: { type: 'override', actor: who, detail: { from: lead.verdict, to: t.to, note } } };
  ev = { action: 'override', lead_id: lead.id, from: lead.verdict, to: t.to, note, by: t.by, origin: 'slack' };
}
return patch ? [{ json: { id: lead.id, patch, ev } }] : [];`, row(6, -2)),
    http('CRM: save it', row(7, -2), { method: 'PATCH', url: `={{ '${CFG.crm}/api/leads/' + $json.id }}`, cred: 'crm', json: '={{ JSON.stringify($json.patch) }}' }),
    http('Sync everywhere else', row(8, -2), { method: 'POST', url: 'http://127.0.0.1:5678/webhook/mdr-crm-event', headers: { 'X-MDR-Key': '{{CRM_API_KEY}}' }, json: "={{ JSON.stringify($('Work out the change').first().json.ev) }}" }),
  ];
  return {
    name: wfName, nodes,
    connections: wire([
      ['Slack button clicked', 'Check it came from Slack'], ['Check it came from Slack', 'Signed by Slack?'], ['Signed by Slack?', 'Ack within 3 seconds', 0], ['Signed by Slack?', 'Reply 401', 1],
      ['Ack within 3 seconds', 'A button that changes something?'], ['A button that changes something?', 'Slack: who clicked?', 0], ['Slack: who clicked?', 'CRM: load the lead'], ['CRM: load the lead', 'Work out the change'],
      ['Work out the change', 'CRM: save it'], ['CRM: save it', 'Sync everywhere else'],
    ]),
  };
}

/* =====================================================================
   W3  MDR · Asana updates  (public, through the tunnel)
   Ticking off the follow-up task, or dragging it to Contacted/Booked, moves the lead.
   ===================================================================== */
function asanaEvents() {
  wfName = 'MDR · Asana updates';
  const nodes = [
    webhook('Asana event', 'mdr-asana', row(0), { raw: true }),
    code('Handshake or verify', `
const crypto = require('crypto');
const item = $input.first();
const h = item.json.headers || {};
const store = $getWorkflowStaticData('global');
if (h['x-hook-secret']) {                          // Asana's first call when the webhook is created
  store.secret = h['x-hook-secret'];
  return [{ json: { handshake: true, secret: h['x-hook-secret'], events: [] } }];
}
let raw;
try { raw = await this.helpers.getBinaryDataBuffer(0, 'data'); }
catch (e) { raw = Buffer.from((item.binary && item.binary.data && item.binary.data.data) || '', 'base64'); }
const want = store.secret ? crypto.createHmac('sha256', store.secret).update(raw).digest('hex') : '';
const got = String(h['x-hook-signature'] || '');
const ok = !!want && got.length === want.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
let events = [];
if (ok) { try { events = JSON.parse(raw.toString('utf8')).events || []; } catch (e) {} }
return [{ json: { handshake: false, ok, events } }];`, row(1)),
    iff('Handshake?', '={{ $json.handshake }}', row(2)),
    respond('Echo the secret', row(3, -1), { body: '', headers: [{ name: 'X-Hook-Secret', value: '={{ $json.secret }}' }] }),
    respond('Ack', row(3, 1), { body: '' }),
    code('Task changes we care about', `
const SECTION_TO_STAGE = { [CFG.asanaSections.contacted]: 'contacted', [CFG.asanaSections.booked]: 'booked' };
const out = [];
for (const e of $('Handshake or verify').first().json.events || []) {
  if (!e.resource || e.resource.resource_type !== 'task') continue;
  const who = (e.user && e.user.gid) || '';
  if (e.action === 'changed' && e.change && e.change.field === 'completed') out.push({ task: e.resource.gid, kind: 'completed' });
  if (e.action === 'added' && e.parent && e.parent.resource_type === 'section' && SECTION_TO_STAGE[e.parent.gid]) out.push({ task: e.resource.gid, kind: 'section', to: SECTION_TO_STAGE[e.parent.gid] });
}
const seen = new Set();
return out.filter((o) => { const k = o.task + o.kind + (o.to || ''); if (seen.has(k)) return false; seen.add(k); return true; }).map((o) => ({ json: o }));`, row(4, 1)),
    http('Asana: is it done?', row(5, 1), { url: "={{ 'https://app.asana.com/api/1.0/tasks/' + $json.task + '?opt_fields=completed,name' }}", cred: 'asana', neverError: true }),
    http('CRM: which lead?', row(6, 1), { url: `${CFG.crm}/api/lookup`, cred: 'crm', query: { asana_task: "={{ $('Task changes we care about').item.json.task }}" } }),
    code('Work out the change', `
const out = [];
$input.all().forEach((it, i) => {
  const lead = it.json.lead;
  const c = $('Task changes we care about').all()[i].json;
  const task = $('Asana: is it done?').all()[i].json.data || {};
  if (!lead) return;
  let to = null;
  if (c.kind === 'section') to = c.to;
  if (c.kind === 'completed' && task.completed && lead.stage === 'new') to = 'contacted';
  const order = ['new', 'contacted', 'booked', 'won', 'lost'];
  if (!to || order.indexOf(to) <= order.indexOf(lead.stage)) return;   // never move a lead backwards, and ignore our own echoes
  out.push({ json: { id: lead.id, patch: { stage: to, ...(lead.first_contact_at ? {} : { first_contact_at: new Date().toISOString() }), event: { type: 'stage', actor: 'Asana: Justin Masiga', detail: { from: lead.stage, to } } },
    ev: { action: 'stage', lead_id: lead.id, from: lead.stage, to, by: 'Justin Masiga', origin: 'asana' } } });
});
return out;`, row(7, 1)),
    http('CRM: save it', row(8, 1), { method: 'PATCH', url: `={{ '${CFG.crm}/api/leads/' + $json.id }}`, cred: 'crm', json: '={{ JSON.stringify($json.patch) }}' }),
    http('Sync everywhere else', row(9, 1), { method: 'POST', url: 'http://127.0.0.1:5678/webhook/mdr-crm-event', headers: { 'X-MDR-Key': '{{CRM_API_KEY}}' }, json: "={{ JSON.stringify($('Work out the change').item.json.ev) }}" }),
  ];
  return {
    name: wfName, nodes,
    connections: wire([
      ['Asana event', 'Handshake or verify'], ['Handshake or verify', 'Handshake?'], ['Handshake?', 'Echo the secret', 0], ['Handshake?', 'Ack', 1],
      ['Ack', 'Task changes we care about'], ['Task changes we care about', 'Asana: is it done?'], ['Asana: is it done?', 'CRM: which lead?'],
      ['CRM: which lead?', 'Work out the change'], ['Work out the change', 'CRM: save it'], ['CRM: save it', 'Sync everywhere else'],
    ]),
  };
}

/* =====================================================================
   W5  MDR · Follow-up watch   (hourly; also /webhook/mdr-followup-now?hours=0.05 for a demo)
   ===================================================================== */
function followup() {
  wfName = 'MDR · Follow-up watch';
  const nodes = [
    schedule('Every hour', { interval: [{ field: 'hours', hoursInterval: 1 }] }, row(0, -1)),
    webhook('Run it now (demo)', 'mdr-followup-now', row(0, 1), { method: 'GET', respond: 'onReceived' }),
    code('How long is too long', `
let hours = 24;
try { const q = $('Run it now (demo)').first().json.query || {}; if (q.hours) hours = Math.max(0.01, Number(q.hours)); } catch (e) {}
return [{ json: { hours } }];`, row(1)),
    http('CRM: leads nobody has called', row(2), { url: `${CFG.crm}/api/leads`, cred: 'crm', query: { stale_hours: '={{ $json.hours }}' } }),
    sheetRead('Sheet: team roster', '1123782870', row(3)),
    code('One alert per lead', `
const hours = $('How long is too long').first().json.hours;
const roster = LIB.parseRoster($('Sheet: team roster').all().map((i) => i.json));
const boss = LIB.manager(roster);
const leads = ($('CRM: leads nobody has called').first().json.leads || []).filter((l) => !l.escalated_at && !l.duplicate_of);
return leads.map((l) => {
  const age = Math.round((Date.now() - new Date(l.created_at).getTime()) / 3600e3 * 10) / 10;
  const crmUrl = CFG.crmPublic + '/leads/' + l.id;
  const text = '⏰ ' + l.business + ' came in ' + age + ' hours ago as ' + LIB.VERDICT_LABEL[l.verdict].toLowerCase() + ', and nobody’s reached out yet. It’s ' + (l.assignee || 'unassigned') + '’s. <' + crmUrl + '|' + l.id + '>';
  return { json: {
    id: l.id, hours, age, ops: { channel: CFG.opsChannel, text, unfurl_links: false },
    thread: l.slack_ts ? { channel: l.slack_channel, thread_ts: l.slack_ts, text: '⏰ Still no first contact after ' + age + ' hours. Flagged to ' + (boss ? boss.name : 'the manager') + '.' } : null,
    email: boss ? { sender: { name: 'MDR Lead Hub', email: CFG.sender }, to: [{ email: boss.email, name: boss.name }], subject: 'Nobody has called ' + l.business + ' yet (' + age + ' h)',
      htmlContent: '<p>Hi ' + LIB.firstName(boss.name) + ',</p><p>' + MSG.esc(l.business) + ' came in ' + age + ' hours ago as <strong>' + LIB.VERDICT_LABEL[l.verdict] + '</strong> (score ' + l.score + ') and is still marked New. It belongs to ' + MSG.esc(l.assignee || 'nobody') + '.</p><p><a href="' + crmUrl + '">Open ' + l.id + ' in the CRM</a></p>' } : null,
    manager: boss ? boss.name : null,
  } };
});`, row(4), { lib: true, msg: true }),
    http('Slack: flag it in #mdr-ops', row(5), { method: 'POST', url: 'https://slack.com/api/chat.postMessage', cred: 'slack', json: '={{ JSON.stringify($json.ops) }}' }),
    http('Slack: nudge the lead thread', row(6), { method: 'POST', url: 'https://slack.com/api/chat.postMessage', cred: 'slack', json: "={{ JSON.stringify($('One alert per lead').item.json.thread || { channel: '" + CFG.opsChannel + "', text: '' }) }}", neverError: true }),
    http('Brevo: email the manager', row(7), { method: 'POST', url: 'https://api.brevo.com/v3/smtp/email', cred: 'brevo', json: "={{ JSON.stringify($('One alert per lead').item.json.email) }}", neverError: true }),
    http('CRM: mark it escalated', row(8), { method: 'PATCH', url: `={{ '${CFG.crm}/api/leads/' + $('One alert per lead').item.json.id }}`, cred: 'crm',
      json: "={{ JSON.stringify({ escalated_at: new Date().toISOString(), event: { type: 'escalated', actor: 'n8n', detail: { hours: $('One alert per lead').item.json.age, manager: $('One alert per lead').item.json.manager } } }) }}" }),
  ];
  return {
    name: wfName, nodes,
    connections: wire([
      ['Every hour', 'How long is too long'], ['Run it now (demo)', 'How long is too long'], ['How long is too long', 'CRM: leads nobody has called'],
      ['CRM: leads nobody has called', 'Sheet: team roster'], ['Sheet: team roster', 'One alert per lead'], ['One alert per lead', 'Slack: flag it in #mdr-ops'],
      ['Slack: flag it in #mdr-ops', 'Slack: nudge the lead thread'], ['Slack: nudge the lead thread', 'Brevo: email the manager'], ['Brevo: email the manager', 'CRM: mark it escalated'],
    ]),
  };
}

/* =====================================================================
   W6  MDR · Daily digest   (8:00 New York time; also /webhook/mdr-digest-now)
   ===================================================================== */
function digest() {
  wfName = 'MDR · Daily digest';
  const nodes = [
    schedule('Every morning at 8', { interval: [{ field: 'days', daysInterval: 1, triggerAtHour: 8, triggerAtMinute: 0 }] }, row(0, -1)),
    webhook('Run it now (demo)', 'mdr-digest-now', row(0, 1), { method: 'GET', respond: 'onReceived' }),
    http('CRM: the last 24 hours', row(1), { url: `${CFG.crm}/api/stats`, cred: 'crm', query: { since: "={{ new Date(Date.now() - 864e5).toISOString() }}" } }),
    http('CRM: still waiting', row(2), { url: `${CFG.crm}/api/leads`, cred: 'crm', query: { stale_hours: '24' } }),
    sheetRead('Sheet: team roster', '1123782870', row(3)),
    code('Write the digest', `
const s = $('CRM: the last 24 hours').first().json;
const stale = ($('CRM: still waiting').first().json.leads || []).length;
const n = (k) => Number((s.byVerdict.find((r) => r.k === k) || {}).n || 0);
const top = (s.bySource[0] || {}).k || 'nowhere yet';
const boss = LIB.manager(LIB.parseRoster($('Sheet: team roster').all().map((i) => i.json)));
const text = '☀️ Yesterday brought ' + s.total + ' lead' + (s.total === 1 ? '' : 's') + ': ' + n('hot') + ' hot, ' + n('warm') + ' warm, ' + n('talk') + ' that need a conversation' +
  (n('not_fit') ? ', ' + n('not_fit') + ' not a fit' : '') + (n('spam') ? ', ' + n('spam') + ' spam' : '') + '. Most came from ' + top + '. ' +
  (stale ? stale + ' still haven’t heard from anyone.' : 'Everyone who needed a call got one.') + ' <' + CFG.crmPublic + '/reports?days=7|Reports>';
const byRep = s.byAssignee.filter((r) => r.k).map((r) => '• ' + r.k + ': ' + r.n).join('\\n');
return [{ json: {
  slack: { channel: CFG.dailyChannel, text, blocks: [{ type: 'section', text: { type: 'mrkdwn', text } }].concat(byRep ? [{ type: 'context', elements: [{ type: 'mrkdwn', text: 'New leads by rep\\n' + byRep }] }] : []), unfurl_links: false },
  email: boss ? { sender: { name: 'MDR Lead Hub', email: CFG.sender }, to: [{ email: boss.email, name: boss.name }], subject: 'Leads yesterday: ' + s.total + ' in, ' + n('hot') + ' hot', htmlContent: '<p>' + MSG.esc(text.replace(/ <[^>]+>$/, '')) + '</p><p><a href="' + CFG.crmPublic + '/reports?days=7">Open the reports</a></p>' } : null,
} }];`, row(4), { lib: true, msg: true }),
    http('Slack: post to #mdr-daily', row(5), { method: 'POST', url: 'https://slack.com/api/chat.postMessage', cred: 'slack', json: '={{ JSON.stringify($json.slack) }}' }),
    http('Brevo: email the manager', row(6), { method: 'POST', url: 'https://api.brevo.com/v3/smtp/email', cred: 'brevo', json: "={{ JSON.stringify($('Write the digest').first().json.email) }}", neverError: true }),
  ];
  return {
    name: wfName, nodes,
    connections: wire([
      ['Every morning at 8', 'CRM: the last 24 hours'], ['Run it now (demo)', 'CRM: the last 24 hours'], ['CRM: the last 24 hours', 'CRM: still waiting'],
      ['CRM: still waiting', 'Sheet: team roster'], ['Sheet: team roster', 'Write the digest'], ['Write the digest', 'Slack: post to #mdr-daily'], ['Slack: post to #mdr-daily', 'Brevo: email the manager'],
    ]),
  };
}

/* ---------- push ---------- */
const WORKFLOWS = [errors, rosterWf, sync, slackButtons, asanaEvents, followup, digest, intake];
export { WORKFLOWS };

async function api(method, p, body) {
  const r = await fetch(N8N + '/api/v1' + p, { method, headers: { 'X-N8N-API-KEY': N8N_KEY, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${p} -> ${r.status} ${t.slice(0, 400)}`);
  return t ? JSON.parse(t) : {};
}
const inject = (s) => s.replace(/\{\{(MDR_HMAC_SECRET|SLACK_SIGNING_SECRET|CRM_API_KEY)\}\}/g, (_, k) => SECRETS[k]);

async function main() {
  fs.mkdirSync(path.join(here, 'workflows'), { recursive: true });
  const existing = DRY ? [] : (await api('GET', '/workflows?limit=250')).data;
  const ids = {};
  let errorId = existing.find((w) => w.name === 'MDR · Error alerts')?.id;
  for (const make of WORKFLOWS) {
    const wf = make();
    const file = path.join(here, 'workflows', wf.name.replace(/^MDR · /, 'mdr-').toLowerCase().replace(/[^a-z0-9-]+/g, '-') + '.json');
    fs.writeFileSync(file, JSON.stringify(wf, null, 2));
    if (DRY) { console.log('wrote', path.relative(root, file)); continue; }
    const body = JSON.parse(inject(JSON.stringify({ ...wf, settings: { executionOrder: 'v1', timezone: 'America/New_York', ...(errorId && wf.name !== 'MDR · Error alerts' ? { errorWorkflow: errorId } : {}) } })));
    const found = existing.find((w) => w.name === wf.name);
    let id;
    if (found) { await api('POST', `/workflows/${found.id}/deactivate`).catch(() => {}); await api('PUT', `/workflows/${found.id}`, body); id = found.id; }
    else { id = (await api('POST', '/workflows', body)).id; }
    if (wf.name === 'MDR · Error alerts') errorId = id;
    const activatable = wf.nodes.some((n) => /webhook|scheduleTrigger|errorTrigger/i.test(n.type) && !/errorTrigger/i.test(n.type));
    if (activatable) await api('POST', `/workflows/${id}/activate`);
    ids[wf.name] = id;
    console.log((found ? 'updated ' : 'created ') + wf.name + ' ' + id + (activatable ? ' (active)' : ''));
  }
  fs.writeFileSync(path.join(here, 'workflow-ids.json'), JSON.stringify(ids, null, 2));

  // Asana signs its events with a secret it hands over once, at webhook creation, and n8n keeps it in
  // the workflow's static data. A re-push can clear that, so re-register the webhook when it's gone.
  const w3 = ids['MDR · Asana updates'];
  if (w3) {
    const wf = await api('GET', `/workflows/${w3}`);
    if (!(wf.staticData && wf.staticData.global && wf.staticData.global.secret)) {
      const A = { Authorization: `Bearer ${env.ASANA_PAT}`, 'Content-Type': 'application/json' };
      const list = await (await fetch(`https://app.asana.com/api/1.0/webhooks?workspace=${env.ASANA_WORKSPACE}&resource=${env.ASANA_PROJECT}`, { headers: A })).json();
      for (const h of list.data || []) await fetch(`https://app.asana.com/api/1.0/webhooks/${h.gid}`, { method: 'DELETE', headers: A });
      const r = await (await fetch('https://app.asana.com/api/1.0/webhooks', { method: 'POST', headers: A, body: JSON.stringify({ data: {
        resource: env.ASANA_PROJECT, target: 'https://mdr-hooks.thejobstash.com/webhook/mdr-asana',
        filters: [{ resource_type: 'task', action: 'changed', fields: ['completed'] }, { resource_type: 'task', action: 'added' }] } }) })).json();
      console.log(r.data ? `Asana webhook re-registered (${r.data.gid})` : `Asana webhook NOT registered: ${JSON.stringify(r.errors)} (is the tunnel running?)`);
    }
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch((e) => { console.error(e.message); process.exit(1); });
