// Sends five realistic demo leads through the real WordPress form endpoints, one at a time,
// waiting for each to be fully routed (about a minute each: Lighthouse + the local model).
//   node tools/seed-demo.mjs
// Prospect emails go to Justin's Gmail plus-aliases, so they land in his inbox.
const LEADS = [
  { port: 8081, label: 'Franchise clinic, Google Ads click (expect hot, Ana)', body: {
    variant: 'practice', elapsed_ms: 64000,
    fields: { business: 'The Joint Chiropractic (Mentor)', website: 'thejoint.com', practice_type: 'chiropractic', zip: '44060', goals: ['new_patients', 'rank_google', 'run_ads'], locations: '1', budget: '1500_5000', timeline: 'asap',
      message: "I own the Mentor franchise location. Corporate runs the main website, but I need more local patients finding us on Google Maps and I'm ready to put money into local ads. We just hired a second chiropractor and her schedule is half empty.",
      name: 'Megan Doyle', email: 'justin.masiga.94+megan.doyle@gmail.com', phone: '440-555-0187', consent: true },
    tracking: { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'chiro-northeast-ohio', gclid: 'demo-click-1', landing_page: '/' } } },
  { port: 8081, label: 'Roofer on the clinic form (expect a conversation, Ben)', body: {
    variant: 'practice', elapsed_ms: 61000,
    fields: { business: 'Summit Roofing & Gutters', website: 'example.org', practice_type: 'other_health', zip: '44129', goals: ['rank_google', 'run_ads'], locations: '1', budget: '500_1500', timeline: 'quarter',
      message: 'Heads up, we are a roofing company in Parma, not a clinic. Your form was the only free check I found. We need more storm-damage leads from Google before spring.',
      name: 'Tony Russo', email: 'justin.masiga.94+tony.russo@gmail.com', phone: '216-555-0133', consent: true },
    tracking: { referrer: 'https://www.bing.com/', landing_page: '/' } } },
  { port: 8082, label: 'Animal shelter, Facebook ad (expect hot, Carla)', body: {
    variant: 'grant', elapsed_ms: 75000,
    fields: { org_name: 'Cleveland Animal Protective League', website: 'clevelandapl.org', ein: '', state: 'OH', nonprofit_status: 'yes', mission: 'environment_animals', grant_status: 'no', staff: '26_plus', goals: ['donors', 'volunteers'],
      message: 'A board member mentioned Ad Grants last week. We have never applied and would love help getting set up before our spring adoption drive.',
      name: 'Laura Bennett', role: 'Marketing manager', email: 'justin.masiga.94+laura.bennett@gmail.com', phone: '', consent: true },
    tracking: { utm_source: 'facebook', utm_medium: 'paid_social', utm_campaign: 'nonprofit-ad-grants', fbclid: 'demo-fb-1', landing_page: '/' } } },
  { port: 8082, label: 'School district (expect not a fit: Google excludes them)', body: {
    variant: 'grant', elapsed_ms: 48000,
    fields: { org_name: 'Westlake City Schools', website: 'wlcsd.org', ein: '', state: 'OH', nonprofit_status: 'unsure', mission: 'hospital_school_gov', grant_status: 'no', staff: '26_plus', goals: ['awareness'],
      message: 'We are a public school district. Can we get the free Google ads for our levy campaign?',
      name: 'Paul Grant', role: 'Communications director', email: 'justin.masiga.94+paul.grant@gmail.com', phone: '', consent: true },
    tracking: { referrer: 'https://www.google.com/', landing_page: '/' } } },
  { port: 8081, label: 'Backlink seller (expect spam, nobody pinged)', body: {
    variant: 'practice', elapsed_ms: 9000,
    fields: { business: 'RankBoost Digital', website: 'rankboostdigital.example', practice_type: 'other_health', zip: '10001', goals: ['rank_google'], locations: '1', budget: 'unsure', timeline: 'asap',
      message: 'Hi, we offer high DA backlinks and guest post placements for your clients. 200 links for $99, see http://rankboost.example and http://rankboost.example/prices',
      name: 'Steve', email: 'justin.masiga.94+steve.rb@gmail.com', phone: '', consent: true },
    tracking: { landing_page: '/' } } },
];

for (const l of LEADS) {
  process.stdout.write(`${l.label}... `);
  const r = await (await fetch(`http://localhost:${l.port}/wp-json/mdr/v1/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(l.body) })).json();
  if (!r.token) { console.log('NOT ACCEPTED', JSON.stringify(r)); continue; }
  let state = '';
  for (let i = 0; i < 80 && state !== 'routed'; i++) {
    await new Promise((res) => setTimeout(res, 3000));
    state = (await (await fetch(`http://localhost:${l.port}/wp-json/mdr/v1/status/${r.token}`)).json()).state;
  }
  console.log(state === 'routed' ? 'routed' : `stuck at "${state}"`);
}
