// Sends five realistic demo leads through the real WordPress forms, in real Chrome, one at a time:
// opens the site with the lead's ad tags in the address, types each answer step by step, clicks Next
// and submit like a visitor, then waits on the results page until n8n has routed it
// (about a minute each: Lighthouse + the local model).
//   node tools/seed-demo.mjs          (Chrome hidden)
//   node tools/seed-demo.mjs --show   (watch it fill the forms)
// Prospect emails go to Justin's Gmail plus-aliases, so they land in his inbox.
import puppeteer from 'puppeteer-core';

const LEADS = [
  { port: 8081, label: 'Franchise clinic, Google Ads click (expect hot, Ana)',
    fields: { business: 'The Joint Chiropractic (Mentor)', website: 'thejoint.com', practice_type: 'chiropractic', zip: '44060', goals: ['new_patients', 'rank_google', 'run_ads'], locations: '1', budget: '1500_5000', timeline: 'asap',
      message: "I own the Mentor franchise location. Corporate runs the main website, but I need more local patients finding us on Google Maps and I'm ready to put money into local ads. We just hired a second chiropractor and her schedule is half empty.",
      name: 'Megan Doyle', email: 'justin.masiga.94+megan.doyle@gmail.com', phone: '440-555-0187', consent: true },
    tracking: { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'chiro-northeast-ohio', utm_term: 'chiropractor mentor ohio', utm_content: 'maps-new-patients-ad', gclid: 'demo-click-1' } },
  { port: 8081, label: 'Roofer on the clinic form (expect a conversation, Ben)',
    fields: { business: 'Summit Roofing & Gutters', website: 'example.org', practice_type: 'other_health', zip: '44129', goals: ['rank_google', 'run_ads'], locations: '1', budget: '500_1500', timeline: 'quarter',
      message: 'Heads up, we are a roofing company in Parma, not a clinic. Your form was the only free check I found. We need more storm-damage leads from Google before spring.',
      name: 'Tony Russo', email: 'justin.masiga.94+tony.russo@gmail.com', phone: '216-555-0133', consent: true },
    referrer: 'https://www.bing.com/' },
  { port: 8082, label: 'Animal shelter, Facebook ad (expect hot, Carla)',
    fields: { org_name: 'Cleveland Animal Protective League', website: 'clevelandapl.org', state: 'OH', nonprofit_status: 'yes', mission: 'environment_animals', grant_status: 'no', staff: '26_plus', goals: ['donors', 'volunteers'],
      message: 'A board member mentioned Ad Grants last week. We have never applied and would love help getting set up before our spring adoption drive.',
      name: 'Laura Bennett', role: 'Marketing manager', email: 'justin.masiga.94+laura.bennett@gmail.com', consent: true },
    tracking: { utm_source: 'facebook', utm_medium: 'paid_social', utm_campaign: 'nonprofit-ad-grants', utm_content: 'adoption-drive-carousel', fbclid: 'demo-fb-1' } },
  { port: 8082, label: 'School district (expect not a fit: Google excludes them)',
    fields: { org_name: 'Westlake City Schools', website: 'wlcsd.org', state: 'OH', nonprofit_status: 'unsure', mission: 'hospital_school_gov', grant_status: 'no', staff: '26_plus', goals: ['awareness'],
      message: 'We are a public school district. Can we get the free Google ads for our levy campaign?',
      name: 'Paul Grant', role: 'Communications director', email: 'justin.masiga.94+paul.grant@gmail.com', consent: true },
    referrer: 'https://www.google.com/' },
  { port: 8081, label: 'Backlink seller (expect spam, nobody pinged)',
    fields: { business: 'RankBoost Digital', website: 'rankboostdigital.example', practice_type: 'other_health', zip: '10001', goals: ['rank_google'], locations: '1', budget: 'unsure', timeline: 'asap',
      message: 'Hi, we offer high DA backlinks and guest post placements for your clients. 200 links for $99, see http://rankboost.example and http://rankboost.example/prices',
      name: 'Steve', email: 'justin.masiga.94+steve.rb@gmail.com', consent: true } },
];

if (!(await fetch('http://localhost:3090/').then((r) => r.ok, () => false))) { console.log('The CRM is not running on :3090. Run start.cmd first.'); process.exit(1); }

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: process.argv.includes('--show') ? false : 'new', defaultViewport: { width: 1280, height: 900 },
});

/** Fill the fields of the step that's showing, the way a person would. */
async function fillStep(page, step, fields) {
  for (const key of await step.$$eval('[data-field]', (els) => els.map((e) => e.getAttribute('data-field')))) {
    const v = fields[key];
    if (v === undefined || v === '' || v === false) continue;
    const box = await step.$(`[data-field="${key}"]`);
    if (Array.isArray(v)) { for (const x of v) await box.$eval(`input[value="${x}"]`, (i) => i.click()); continue; }
    if (v === true) { await box.$eval('input[type=checkbox]', (i) => i.click()); continue; }
    const sel = await box.$('select');
    if (sel) { await sel.select(v); continue; }
    if (await box.$('input[type=radio]')) { await box.$eval(`input[value="${v}"]`, (i) => i.click()); continue; }
    await (await box.$('input, textarea')).type(String(v), { delay: 8 });
  }
}

for (const l of LEADS) {
  process.stdout.write(`${l.label}... `);
  const page = await browser.newPage();
  try {
    const qs = new URLSearchParams(l.tracking || {}).toString();
    // Chrome sends no referrer from an https search page to plain-http localhost, so a visitor "from Bing"
    // would arrive as Direct here. Set document.referrer in the page so the demo shows Organic search.
    if (l.referrer) await page.evaluateOnNewDocument((r) => Object.defineProperty(document, 'referrer', { get: () => r }), l.referrer);
    await page.goto(`http://localhost:${l.port}/${qs ? '?' + qs : ''}`, { waitUntil: 'networkidle2' });
    const steps = await page.$$('form[data-mdr-form] .mdr-step');
    for (const [i, step] of steps.entries()) {
      await fillStep(page, step, l.fields);
      if (i < steps.length - 1) { await step.$eval('[data-next]', (b) => b.click()); await page.waitForFunction((n) => !document.querySelectorAll('.mdr-step')[n].hidden, {}, i + 1); }
    }
    await Promise.all([page.waitForNavigation({ timeout: 30000 }), steps.at(-1).$eval('[data-submit]', (b) => b.click())]);
    const token = new URL(page.url()).searchParams.get('t') || '';
    if (!/^[a-f0-9]{32}$/.test(token) || /^0+$/.test(token)) { console.log(`NOT ACCEPTED (results page ${page.url()})`); continue; }
    let state = '';
    for (let i = 0; i < 80 && state !== 'routed'; i++) {
      await new Promise((res) => setTimeout(res, 3000));
      state = (await (await fetch(`http://localhost:${l.port}/wp-json/mdr/v1/status/${token}`)).json()).state;
    }
    console.log(state === 'routed' ? 'routed' : `stuck at "${state}"`);
  } catch (e) {
    console.log('FAILED:', e.message);
  } finally {
    await page.close();
  }
}
await browser.close();
