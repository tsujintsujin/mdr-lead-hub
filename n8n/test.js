// node n8n/test.js : checks the deciding logic with no n8n, no network, no model.
const assert = require('node:assert/strict');
const L = require('./lib/intake.js');
const M = require('./lib/messages.js');

// where they came from
assert.equal(L.classifySource({ gclid: 'abc' }), 'Google Ads');
assert.equal(L.classifySource({ utm_source: 'google', utm_medium: 'cpc' }), 'Google Ads');
assert.equal(L.classifySource({ fbclid: 'x' }), 'Facebook/Instagram ads');
assert.equal(L.classifySource({ utm_source: 'gbp' }), 'Google Business Profile');
assert.equal(L.classifySource({ referrer: 'https://www.google.com/' }), 'Organic search');
assert.equal(L.classifySource({ referrer: 'https://yelp.com/biz/x' }), 'Referral');
assert.equal(L.classifySource({}), 'Direct');

// reading a website
const html = `<html><head><title>Lakeshore Spine & Wellness | Chiropractor in Euclid</title>
<meta name="description" content="Chiropractic care for back pain, sciatica and sports injuries in Euclid, Ohio. Same week appointments.">
<meta name="viewport" content="width=device-width"><script type="application/ld+json">{"@type":"Chiropractor"}</script>
<link href="/wp-content/x.css"></head><body><h1>Back pain?</h1><a href="tel:2165550100">Call</a> words ${'word '.repeat(400)}</body></html>`;
const site = L.readWebsite(html, { ok: true, status: 200, finalUrl: 'https://lakeshore.example', ms: 400 });
assert.equal(site.h1_count, 1); assert.ok(site.viewport); assert.ok(site.local_schema); assert.ok(site.booking_cta);
assert.equal(site.platform, 'WordPress'); assert.ok(site.https); assert.ok(site.words > 300);

// PageSpeed answer wins, estimate only when it's missing
assert.deepEqual(L.speedFrom({ lighthouseResult: { categories: { performance: { score: 0.41 } }, audits: { 'largest-contentful-paint': { numericValue: 5230 } } } }, site), { score: 41, lcp_s: 5.2, source: 'pagespeed' });
assert.equal(L.speedFrom(null, site).source, 'estimate');
assert.deepEqual(L.speedFrom({ ok: true, score: 62, lcp_s: 3.4 }, site), { score: 62, lcp_s: 3.4, source: 'lighthouse' });
assert.equal(L.speedFrom({ ok: false, error: 'timeout' }, site).source, 'estimate');
assert.equal(L.speedFrom(null, { reachable: false }).score, null);

// a strong clinic lead
const fHot = { business: 'Lakeshore Spine', name: 'Dana Ortiz', email: 'dana@lakeshore.example', zip: '44123', budget: '1500_5000', timeline: 'asap', practice_type: 'chiropractic', goals: ['new_patients'], message: 'Our new associate starts in March and the site is slow.' };
const slowAudit = L.buildAudit('practice', fHot, { ...site, description: '' }, { score: 38, source: 'pagespeed' }, null);
const r1 = L.rules('practice', fHot, slowAudit);
assert.equal(r1.hard, null); assert.ok(r1.points >= 55, 'strong fit scores high: ' + r1.points);
const ai1 = L.parseAi({ segment: 'healthcare_wellness', size: 'small', intent: 24, confidence: 0.85, vendor_pitch: false, summary: 's', reasons: ['a'], opening_line: 'o', red_flags: [] });
assert.equal(L.decide('practice', fHot, r1, ai1).verdict, 'hot');

// spam by rules
assert.equal(L.rules('practice', { ...fHot, message: 'We sell backlinks for your site http://a.com http://b.com' }, slowAudit).hard, 'spam');
assert.equal(L.rules('practice', { ...fHot, email: 'x@mailinator.com' }, slowAudit).hard, 'spam');
assert.equal(L.decide('practice', fHot, { hard: 'spam', points: 0, notes: [] }, ai1).verdict, 'spam');

// not a fit by rules
const rCheap = L.rules('practice', { ...fHot, budget: 'under_500', timeline: 'exploring' }, slowAudit);
assert.equal(rCheap.hard, 'not_fit');
assert.equal(L.decide('practice', fHot, rCheap, ai1).verdict, 'not_fit');

// a roofer on the clinic form goes to a person, and to the right segment
const aiRoof = L.parseAi({ ...ai1, segment: 'home_services', confidence: 0.8 });
const dRoof = L.decide('practice', fHot, r1, aiRoof);
assert.equal(dRoof.verdict, 'talk'); assert.equal(dRoof.segment, 'home_services');

// low confidence -> conversation; vendor pitch -> spam; model down -> rules + person
assert.equal(L.decide('practice', fHot, r1, { ...ai1, confidence: 0.3 }).verdict, 'talk');
assert.equal(L.decide('practice', fHot, r1, { ...ai1, vendor_pitch: true }).verdict, 'spam');
assert.equal(L.decide('practice', fHot, r1, null).verdict, 'talk');
assert.equal(L.parseAi('not json'), null);
assert.equal(L.parseAi({ segment: 'aliens', intent: 99 }).segment, 'other');
assert.equal(L.parseAi({ intent: 99 }).intent, 30);

// nonprofits
const fGrant = { org_name: 'Westside Food Pantry', name: 'Ruth Kim', email: 'ruth@pantry.example', state: 'OH', nonprofit_status: 'yes', mission: 'human_services', grant_status: 'underused', staff: '1_5', goals: ['donors'] };
const gAudit = L.buildAudit('grant', fGrant, site, { score: 70 }, { found: true, name: 'WESTSIDE FOOD PANTRY', city: 'Cleveland', state: 'OH' });
assert.equal(gAudit.public_verdict, 'likely');
assert.equal(L.rules('grant', { ...fGrant, mission: 'hospital_school_gov' }, gAudit).hard, 'not_fit');
assert.equal(L.rules('grant', { ...fGrant, nonprofit_status: 'no' }, gAudit).hard, 'not_fit');
assert.equal(L.buildAudit('grant', { ...fGrant, mission: 'hospital_school_gov' }, site, null, { found: true }).public_verdict, 'not_yet');
const pub = L.publicResult('grant', fGrant, gAudit);
assert.ok(!('speed' in pub), 'results page gets only what the visitor should see');

// routing: right territory, lightest load, manager as last resort
const roster = L.parseRoster([
  { Rep: 'Ana Reyes', Email: 'a@x', Covers: 'healthcare_wellness', 'Slack channel': 'leads-healthcare', Active: 'yes' },
  { Rep: 'Ana Two', Email: 'a2@x', Covers: 'healthcare_wellness', 'Slack channel': 'leads-healthcare', Active: 'yes' },
  { Rep: 'Ben K', Email: 'b@x', Covers: 'home_services, retail_ecommerce', 'Slack channel': 'leads-home-services', Active: 'yes' },
  { Rep: 'Off Duty', Email: 'o@x', Covers: 'nonprofit', 'Slack channel': 'leads-nonprofit', Active: 'no' },
  { Rep: 'Marcus', Email: 'm@x', Covers: '*', 'Slack channel': 'mdr-ops', Active: 'yes' },
]);
assert.equal(roster.length, 4);
assert.equal(L.pickRep(roster, 'healthcare_wellness', {}).name, 'Ana Reyes');
assert.equal(L.pickRep(roster, 'healthcare_wellness', { 'Ana Reyes': 3, 'Ana Two': 1 }).name, 'Ana Two');
assert.equal(L.pickRep(roster, 'home_services').name, 'Ben K');
assert.equal(L.pickRep(roster, 'nonprofit').name, 'Marcus', 'inactive rep skipped, manager catches it');
assert.equal(L.manager(roster).name, 'Marcus');

// prompt carries corrections; messages render
const pr = L.buildPrompt('practice', fHot, slowAudit, 'Google Ads', 'Back pain?', [{ business: 'X', segment: 'other', model_said: 'hot', person_said: 'not_fit', why: 'franchise, HQ decides' }]);
assert.ok(pr.user.includes('franchise, HQ decides'));
const lead = { id: 'MDR-1001', variant: 'practice', business: 'Lakeshore Spine', verdict: 'hot', score: 87, segment: 'healthcare_wellness', source: 'Google Ads', stage: 'new', fields: fHot, audit: slowAudit, ai: ai1, why: ['a', 'b'] };
const s = M.slackLead(lead, { lib: L, crmUrl: 'http://localhost:3090/leads/MDR-1001', rep: roster[0] });
assert.equal(s.blocks.find((b) => b.type === 'actions').elements.length, 4);
assert.equal(M.slackLead({ ...lead, stage: 'won' }, { lib: L, crmUrl: 'u', rep: roster[0] }).blocks.find((b) => b.type === 'actions'), undefined);
assert.ok(M.repEmail(lead, { lib: L, rep: roster[0], crmUrl: 'u', siteName: 'Practice Growth Check' }).subject.includes('Hot lead for you'));
assert.ok(M.prospectEmail({ ...lead, verdict: 'not_fit' }, { lib: L, rep: roster[0] }).html.includes('retainer'));
assert.ok(M.prospectEmail({ ...lead, variant: 'grant', fields: fGrant, audit: gAudit }, { lib: L, rep: roster[0] }).html.includes('likely eligible'));
assert.ok(!M.repEmail({ ...lead, business: '<script>' }, { lib: L, rep: roster[0], crmUrl: 'u', siteName: 's' }).html.includes('<script>'));

console.log('n8n logic: all checks passed');
