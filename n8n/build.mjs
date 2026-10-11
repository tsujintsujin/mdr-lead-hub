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
const SECRETS = { MDR_HMAC_SECRET: env.MDR_HMAC_SECRET, SLACK_SIGNING_SECRET: env.SLACK_SIGNING_SECRET };

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
    secrets ? `const SECRET = { hmac: '{{MDR_HMAC_SECRET}}', slack: '{{SLACK_SIGNING_SECRET}}' };` : '',
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

/* ---------- push ---------- */
const WORKFLOWS = [errors, intake];
export { WORKFLOWS };

async function api(method, p, body) {
  const r = await fetch(N8N + '/api/v1' + p, { method, headers: { 'X-N8N-API-KEY': N8N_KEY, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${p} -> ${r.status} ${t.slice(0, 400)}`);
  return t ? JSON.parse(t) : {};
}
const inject = (s) => s.replace(/\{\{(MDR_HMAC_SECRET|SLACK_SIGNING_SECRET)\}\}/g, (_, k) => SECRETS[k]);

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
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch((e) => { console.error(e.message); process.exit(1); });
