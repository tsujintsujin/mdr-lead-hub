// MDR Lead Hub: the deciding logic used inside the n8n Code nodes.
// Pure functions only (no network), so test.js can check them without n8n.
// build.mjs inlines this file into each Code node that needs it.

const LIB = (() => {
  const SEGMENTS = ['healthcare_wellness', 'home_services', 'nonprofit', 'professional_services', 'retail_ecommerce', 'restaurant_hospitality', 'other'];
  const SEGMENT_LABEL = {
    healthcare_wellness: 'Healthcare and wellness', home_services: 'Home services', nonprofit: 'Nonprofit',
    professional_services: 'Professional services', retail_ecommerce: 'Retail and e-commerce',
    restaurant_hospitality: 'Restaurants and hospitality', other: 'Other',
  };
  const VERDICT_LABEL = { hot: 'Hot', warm: 'Warm', talk: 'Needs a conversation', not_fit: 'Not a fit', spam: 'Spam' };
  const VERDICT_EMOJI = { hot: '🔥', warm: '🌤️', talk: '💬', not_fit: '❌', spam: '🗑️' };

  const LABELS = {
    practice_type: { chiropractic: 'Chiropractic', physical_therapy: 'Physical therapy', med_spa: 'Med spa', dental: 'Dental', massage_wellness: 'Massage or wellness', other_health: 'Another kind of practice' },
    goals: { new_patients: 'More new patients', rank_google: 'Higher on Google', run_ads: 'Google or Facebook ads', new_website: 'A new website', reviews: 'More reviews', donors: 'More donors', volunteers: 'More volunteers', signups: 'More program signups', awareness: 'More awareness' },
    locations: { '1': 'One location', '2_3': 'Two or three locations', '4_plus': 'Four or more locations' },
    budget: { under_500: 'Under $500/mo', '500_1500': '$500–1,500/mo', '1500_5000': '$1,500–5,000/mo', '5000_plus': 'Over $5,000/mo', unsure: 'Budget not set' },
    timeline: { asap: 'Wants to start ASAP', quarter: 'Next three months', exploring: 'Just looking' },
    nonprofit_status: { yes: '501(c)(3): yes', pending: '501(c)(3): applied', no: '501(c)(3): no', unsure: '501(c)(3): not sure' },
    mission: { human_services: 'Human services', education_programs: 'Education programs', health_programs: 'Health programs', arts_culture: 'Arts and culture', environment_animals: 'Environment or animals', community: 'Community development', religious: 'Faith-based', hospital_school_gov: 'Hospital, school or government', other: 'Other mission' },
    grant_status: { no: 'No Ad Grants yet', underused: 'Has Ad Grants, barely used', active: 'Has Ad Grants, running well' },
    staff: { volunteers: 'All volunteers', '1_5': '1–5 staff', '6_25': '6–25 staff', '26_plus': '26+ staff' },
  };
  const label = (group, v) => (LABELS[group] && LABELS[group][v]) || v || '';

  /* ---------- source: where the visitor came from ---------- */
  function classifySource(t = {}) {
    const src = String(t.utm_source || '').toLowerCase();
    const med = String(t.utm_medium || '').toLowerCase();
    const ref = String(t.referrer || '').toLowerCase();
    const paid = /^(cpc|ppc|paid|paidsearch|paid_social|paidsocial|display)$/.test(med);
    if (t.gclid || (paid && /google/.test(src))) return 'Google Ads';
    if (t.fbclid || /facebook|instagram|meta|fb|ig/.test(src)) return paid || t.fbclid ? 'Facebook/Instagram ads' : 'Social';
    if (/gbp|google_business|gmb|maps/.test(src + ' ' + med)) return 'Google Business Profile';
    if (med === 'email' || /newsletter|mailchimp/.test(src)) return 'Email';
    if (paid) return 'Paid (other)';
    if (/google\.|bing\.|duckduckgo\.|yahoo\.|ecosia\./.test(ref)) return 'Organic search';
    if (ref) return 'Referral';
    if (src) return 'Campaign: ' + src;
    return 'Direct';
  }

  /* ---------- reading the prospect's website ---------- */
  function readWebsite(html, meta = {}) {
    const h = String(html || '');
    const low = h.toLowerCase();
    const pick = (re) => { const m = h.match(re); return m ? m[1].replace(/\s+/g, ' ').trim() : ''; };
    const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const desc = pick(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) || pick(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i);
    const h1s = (h.match(/<h1[\s>]/gi) || []).length;
    const viewport = /<meta[^>]+name=["']viewport["']/i.test(h);
    const ld = (h.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || []).join(' ');
    const localSchema = /"@type"\s*:\s*"?(LocalBusiness|MedicalBusiness|MedicalClinic|Physician|Chiropractor|Dentist|HealthAndBeautyBusiness|DaySpa|MedicalOrganization)/i.test(ld);
    const orgSchema = /"@type"\s*:\s*"?(NGO|Organization|NonprofitOrganization|LocalBusiness)/i.test(ld);
    const text = h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
    const words = text ? text.split(' ').length : 0;
    const links = h.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) || [];
    const booking = /href=["']tel:/i.test(h) || links.some((a) => /book|appointment|schedule|request an? (visit|consult)|zocdoc|janeapp|calendly/i.test(a));
    const donate = links.some((a) => /donat|give now|support us|givebutter|paypal\.com\/donate/i.test(a));
    let platform = null;
    if (/wp-content|wp-includes/.test(low)) platform = 'WordPress';
    else if (/squarespace/.test(low)) platform = 'Squarespace';
    else if (/wix\.com|wixstatic/.test(low)) platform = 'Wix';
    else if (/shopify/.test(low)) platform = 'Shopify';
    else if (/webflow/.test(low)) platform = 'Webflow';
    const finalUrl = meta.finalUrl || meta.url || '';
    return {
      reachable: !!meta.ok, status: meta.status || 0, final_url: finalUrl, https: /^https:/i.test(finalUrl),
      ms: meta.ms || null, bytes: h.length, title, description: desc, h1_count: h1s, viewport,
      local_schema: localSchema, org_schema: orgSchema, words, booking_cta: booking, donate_link: donate, platform,
      excerpt: text.slice(0, 600),
    };
  }

  /** Mobile speed from the local Lighthouse run (or a PageSpeed response). Never estimated. */
  function speedFrom(psi, site) {
    if (psi && psi.ok === true && typeof psi.score === 'number') return { score: psi.score, lcp_s: psi.lcp_s == null ? null : psi.lcp_s, source: 'lighthouse' };
    const cat = psi && psi.lighthouseResult && psi.lighthouseResult.categories && psi.lighthouseResult.categories.performance;
    if (cat && typeof cat.score === 'number') {
      const lcp = psi.lighthouseResult.audits && psi.lighthouseResult.audits['largest-contentful-paint'];
      return { score: Math.round(cat.score * 100), lcp_s: lcp && lcp.numericValue ? Math.round(lcp.numericValue / 100) / 10 : null, source: 'pagespeed' };
    }
    // No guessing: if Lighthouse didn't finish, the speed is reported as not measured.
    return { score: null, lcp_s: null, source: 'none' };
  }

  function buildAudit(variant, f, site, speed, irs) {
    const s = site || {};
    if (variant === 'grant') {
      const missionWords = s.words >= 300;
      const typeOk = f.mission !== 'hospital_school_gov';
      const irsOk = !!(irs && irs.found);
      const checks = [
        { key: 'irs', ok: irsOk, detail: irsOk ? `${irs.name}${irs.city ? ', ' + irs.city : ''}` : (f.nonprofit_status === 'yes' ? 'Not matched by name. An EIN will settle it.' : 'No IRS record found') },
        { key: 'site_https', ok: !!(s.reachable && s.https), detail: !s.reachable ? 'The site did not load' : (s.https ? '' : 'Loads without https') },
        { key: 'mission_content', ok: !!(s.reachable && missionWords), detail: s.reachable ? `About ${s.words} words on the home page` : '' },
        { key: 'org_type', ok: typeOk, detail: typeOk ? '' : 'Google runs separate programs for these' },
      ];
      const passed = checks.filter((c) => c.ok).length;
      const verdict = !typeOk || f.nonprofit_status === 'no' ? 'not_yet' : passed === 4 ? 'likely' : passed >= 2 ? 'almost' : 'not_yet';
      return { reachable: !!s.reachable, speed, checks, irs: irs || { found: false }, public_verdict: verdict, platform: s.platform || null, donate_link: !!s.donate_link };
    }
    const checks = [
      { key: 'title', ok: !!(s.title && s.title.length >= 10 && s.title.length <= 70) },
      { key: 'meta_description', ok: !!(s.description && s.description.length >= 50) },
      { key: 'h1', ok: s.h1_count === 1 },
      { key: 'https', ok: !!s.https },
      { key: 'viewport', ok: !!s.viewport },
      { key: 'local_schema', ok: !!s.local_schema },
    ].map((c) => (s.reachable ? c : { ...c, ok: false }));
    return { reachable: !!s.reachable, speed, checks, booking_cta: !!s.booking_cta, platform: s.platform || null };
  }

  /** What the visitor sees on the results page. Nothing internal. */
  function publicResult(variant, f, audit) {
    if (variant === 'grant') {
      const irs = audit.irs && audit.irs.found ? { found: true, name: audit.irs.name, city: audit.irs.city, state: audit.irs.state, ein: audit.irs.ein } : { found: false };
      return { org_name: f.org_name, verdict: audit.public_verdict, checks: audit.checks, irs };
    }
    return { business: f.business, website: f.website, reachable: audit.reachable, speed: audit.speed, checks: audit.checks.map(({ key, ok }) => ({ key, ok })) };
  }

  /* ---------- rules: the cheap, certain decisions first ---------- */
  const DISPOSABLE = /@(mailinator|guerrillamail|10minutemail|tempmail|yopmail|trashmail|sharklasers|getnada|dispostable|maildrop)\./i;
  const SPAM_WORDS = /\b(backlinks?|guest post|casino|crypto|forex|viagra|seo services? (for|to) you|rank your (site|website) #?1|link building|buy followers|loan offer)\b/i;

  function looksLikeGibberish(s) {
    const t = String(s || '').replace(/[^a-z]/gi, '');
    if (t.length < 4) return false;
    return !/[aeiouy]/i.test(t) || /(.)\1{4,}/.test(t) || /[bcdfghjklmnpqrstvwxz]{6,}/i.test(t);
  }

  function zipBand(zip) {
    const z = parseInt(String(zip || '').slice(0, 3), 10);
    if (z >= 440 && z <= 449) return 'ne_ohio';
    if (z >= 430 && z <= 458) return 'ohio';
    return zip ? 'elsewhere' : 'unknown';
  }

  function rules(variant, f, audit) {
    const notes = [];
    const msg = String(f.message || '');
    const urls = (msg.match(/https?:\/\//gi) || []).length;
    const name = variant === 'grant' ? f.org_name : f.business;
    if (DISPOSABLE.test(f.email || '')) return { hard: 'spam', points: 0, notes: ['Throwaway email address'] };
    if (SPAM_WORDS.test(msg) || urls > 1) return { hard: 'spam', points: 0, notes: ['Message reads like a sales pitch or link spam'] };
    if (looksLikeGibberish(name) && looksLikeGibberish(f.name)) return { hard: 'spam', points: 0, notes: ['Name and business look like keyboard mashing'] };

    let pts = 0;
    let hard = null;
    if (variant === 'grant') {
      if (f.mission === 'hospital_school_gov') { hard = 'not_fit'; notes.push('Hospitals, schools and government agencies are excluded from Ad Grants'); }
      if (f.nonprofit_status === 'no') { hard = 'not_fit'; notes.push('No 501(c)(3) status, which Ad Grants requires'); }
      pts += { yes: 25, pending: 10, unsure: 8, no: 0 }[f.nonprofit_status] || 0;
      if (audit.irs && audit.irs.found) { pts += 15; notes.push('Found in IRS records'); }
      else if (f.nonprofit_status === 'yes') { pts += 5; notes.push('Says 501(c)(3) but IRS lookup did not match'); }
      pts += { no: 12, underused: 15, active: 5 }[f.grant_status] || 0;
      if (f.grant_status === 'underused') notes.push('Already has Ad Grants and is wasting it: management opportunity');
      pts += { volunteers: 3, '1_5': 7, '6_25': 10, '26_plus': 10 }[f.staff] || 0;
      if (audit.reachable && audit.checks.find((c) => c.key === 'site_https' && c.ok)) pts += 5;
      else notes.push('Website needs work before Google will approve it');
      return { hard, points: Math.min(70, pts), notes };
    }

    const band = zipBand(f.zip);
    pts += { ne_ohio: 20, ohio: 12, elsewhere: 5, unknown: 5 }[band];
    notes.push({ ne_ohio: 'Inside MDR’s Northeast Ohio area', ohio: 'Ohio, outside the core area', elsewhere: 'Outside Ohio', unknown: 'No location' }[band]);
    pts += { '5000_plus': 20, '1500_5000': 17, '500_1500': 11, unsure: 6, under_500: 2 }[f.budget] || 0;
    pts += { asap: 15, quarter: 9, exploring: 3 }[f.timeline] || 0;
    let opp = 0;
    const sp = audit.speed && audit.speed.score;
    if (typeof sp === 'number') { if (sp < 50) opp += 8; else if (sp < 90) opp += 5; }
    const missing = audit.checks.filter((c) => !c.ok).length;
    if (missing >= 2) opp += 5;
    if (audit.reachable && !audit.booking_cta) opp += 2;
    pts += Math.min(15, opp);
    if (opp >= 8) notes.push('Website has clear problems MDR can fix');
    if (f.budget === 'under_500' && f.timeline === 'exploring') { hard = 'not_fit'; notes.push('Under $500 a month and only looking around'); }
    return { hard, points: Math.min(70, pts), notes };
  }

  /* ---------- the model's part ---------- */
  const AI_SCHEMA = {
    type: 'object',
    properties: {
      segment: { type: 'string', enum: SEGMENTS },
      size: { type: 'string', enum: ['solo', 'small', 'multi_location', 'unknown'] },
      intent: { type: 'integer', minimum: 0, maximum: 30 },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      vendor_pitch: { type: 'boolean' },
      summary: { type: 'string' },
      reasons: { type: 'array', items: { type: 'string' }, maxItems: 4 },
      opening_line: { type: 'string' },
      red_flags: { type: 'array', items: { type: 'string' }, maxItems: 3 },
    },
    required: ['segment', 'size', 'intent', 'confidence', 'vendor_pitch', 'summary', 'reasons', 'opening_line', 'red_flags'],
  };

  function describeLead(variant, f, audit, source) {
    const lines = [];
    if (variant === 'grant') {
      lines.push(`Form: Google Ad Grants eligibility check (nonprofits)`);
      lines.push(`Organization: ${f.org_name} (${f.state}), website ${f.website}`);
      lines.push(`${label('nonprofit_status', f.nonprofit_status)}. Mission: ${label('mission', f.mission)}. ${label('grant_status', f.grant_status)}. Staff: ${label('staff', f.staff)}.`);
      lines.push(`Wants: ${(f.goals || []).map((g) => label('goals', g)).join(', ')}`);
      lines.push(`IRS lookup: ${audit.irs && audit.irs.found ? `found ${audit.irs.name}, ${audit.irs.city || ''} ${audit.irs.state || ''}` : 'no match'}`);
      lines.push(`Contact: ${f.name}${f.role ? ', ' + f.role : ''}`);
    } else {
      lines.push(`Form: website checkup for clinics and practices`);
      lines.push(`Business: ${f.business}, type picked: ${label('practice_type', f.practice_type)}, ZIP ${f.zip}, website ${f.website}`);
      lines.push(`${label('locations', f.locations)}. ${label('budget', f.budget)}. ${label('timeline', f.timeline)}.`);
      lines.push(`Wants: ${(f.goals || []).map((g) => label('goals', g)).join(', ')}`);
      lines.push(`Contact: ${f.name}`);
    }
    const sp = audit.speed && audit.speed.score;
    lines.push(`Website: ${audit.reachable ? `loads${typeof sp === 'number' ? `, mobile speed ${sp}/100` : ''}, ${audit.checks.filter((c) => c.ok).length}/${audit.checks.length} basics in place${audit.platform ? ', built on ' + audit.platform : ''}` : 'did not load'}`);
    lines.push(`Came from: ${source}`);
    lines.push(`Their message: ${f.message ? '"' + String(f.message).slice(0, 800) + '"' : '(none)'}`);
    return lines.join('\n');
  }

  function buildPrompt(variant, f, audit, source, siteExcerpt, examples) {
    const system = [
      'You qualify inbound leads for Marketing Done Right (MDR), a digital marketing agency in Cleveland, Ohio.',
      'MDR sells SEO, Google Ads (including managing Google Ad Grants for nonprofits), social media ads, and website design.',
      'Their best clients are local businesses in Northeast Ohio, especially chiropractors, physical therapists and wellness clinics, home service companies, and nonprofits.',
      'Read the lead and answer ONLY with the JSON object asked for.',
      'segment: the kind of business it really is, judged from the name, the website text and the message, not just the form they used. A roofing company that used the clinic form is home_services.',
      'size: solo (one person or one small office), small, multi_location, or unknown.',
      'intent: 0 to 30, how ready they are to buy soon. Specific problems, deadlines, and budget talk score high. Vague curiosity scores low.',
      'confidence: 0 to 1, how sure you are about this read. Low when the message is empty, contradicts the form, or the business is unclear.',
      'vendor_pitch: true only if they are trying to sell something TO MDR.',
      'summary: one sentence a busy sales rep can read in three seconds.',
      'reasons: up to 4 short reasons for your read, each under 15 words, concrete.',
      'opening_line: the first sentence the rep should say or write to them, specific to their situation, warm, no hype, no exclamation marks.',
      'red_flags: anything a rep should know before calling (empty list if none).',
    ].join('\n');
    const ex = (examples || []).slice(0, 5).map((e) =>
      `- ${e.business} (${e.segment || '?'}): the model said "${e.model_said}", a person changed it to "${e.person_said}"${e.why ? ' because: ' + e.why : ''}`).join('\n');
    const user = [
      describeLead(variant, f, audit, source),
      siteExcerpt ? `\nText from their home page: "${String(siteExcerpt).slice(0, 500)}"` : '',
      ex ? `\nRecent corrections from MDR's team. Learn from them:\n${ex}` : '',
    ].join('\n');
    return { system, user, schema: AI_SCHEMA };
  }

  function parseAi(raw) {
    let o = raw;
    if (typeof raw === 'string') { try { o = JSON.parse(raw); } catch (e) { return null; } }
    if (!o || typeof o !== 'object') return null;
    const clamp = (n, a, b) => Math.max(a, Math.min(b, Number.isFinite(+n) ? +n : a));
    return {
      segment: SEGMENTS.includes(o.segment) ? o.segment : 'other',
      size: ['solo', 'small', 'multi_location', 'unknown'].includes(o.size) ? o.size : 'unknown',
      intent: Math.round(clamp(o.intent, 0, 30)),
      confidence: clamp(o.confidence, 0, 1),
      vendor_pitch: o.vendor_pitch === true,
      summary: String(o.summary || '').slice(0, 300),
      reasons: (Array.isArray(o.reasons) ? o.reasons : []).map(String).slice(0, 4),
      opening_line: String(o.opening_line || '').slice(0, 300),
      red_flags: (Array.isArray(o.red_flags) ? o.red_flags : []).map(String).filter(Boolean).slice(0, 3),
    };
  }

  /* ---------- the verdict ---------- */
  function decide(variant, f, rule, ai) {
    const formSegment = variant === 'grant' ? 'nonprofit' : 'healthcare_wellness';
    if (rule.hard === 'spam') return { verdict: 'spam', score: 0, by: 'rules', segment: 'other', why: rule.notes };
    if (!ai) {
      // Model unavailable: rules alone, and a person looks at it.
      return { verdict: rule.hard || 'talk', score: rule.points, by: 'rules', segment: formSegment, why: [...rule.notes, 'The AI step did not answer, so a person should look at this one'] };
    }
    if (ai.vendor_pitch) return { verdict: 'spam', score: 0, by: 'ai', segment: 'other', why: ['They are selling to MDR, not buying', ...ai.reasons] };
    const score = Math.max(0, Math.min(100, rule.points + ai.intent));
    const why = [...ai.reasons, ...rule.notes].slice(0, 6);
    if (rule.hard === 'not_fit') return { verdict: 'not_fit', score, by: 'rules', segment: ai.segment, why };
    const mismatch = variant === 'practice' && ai.segment !== 'healthcare_wellness' && ai.confidence >= 0.5;
    if (mismatch) return { verdict: 'talk', score, by: 'ai', segment: ai.segment, why: [`Used the clinic form but looks like ${SEGMENT_LABEL[ai.segment].toLowerCase()}`, ...why].slice(0, 6) };
    if (ai.confidence < 0.55) return { verdict: 'talk', score, by: 'ai', segment: ai.segment, why: ['Not enough to go on, a short call will settle it', ...why].slice(0, 6) };
    const verdict = score >= 70 ? 'hot' : score >= 45 ? 'warm' : score >= 30 ? 'talk' : 'not_fit';
    return { verdict, score, by: 'ai', segment: ai.segment, why };
  }

  /* ---------- routing ---------- */
  function parseRoster(rows) {
    return (rows || []).filter((r) => r && r.Rep && String(r.Active || '').toLowerCase().startsWith('y')).map((r) => ({
      name: String(r.Rep).trim(), email: String(r.Email || '').trim(), role: String(r.Role || '').trim(),
      covers: String(r.Covers || '').split(',').map((s) => s.trim()).filter(Boolean), channel: String(r['Slack channel'] || '').replace(/^#/, '').trim(),
    }));
  }

  function pickRep(roster, segment, open = {}) {
    const reps = roster.filter((r) => !r.covers.includes('*'));
    let pool = reps.filter((r) => r.covers.includes(segment));
    if (!pool.length) pool = reps.filter((r) => r.covers.includes('other'));
    if (!pool.length) pool = roster.filter((r) => r.covers.includes('*'));
    if (!pool.length) return null;
    return pool.slice().sort((a, b) => (open[a.name] || 0) - (open[b.name] || 0))[0]; // stable: ties keep sheet order
  }
  const manager = (roster) => roster.find((r) => r.covers.includes('*')) || null;
  const firstName = (n) => String(n || '').split(' ')[0];
  const ageText = (hours) => { if (hours >= 1) return (Math.round(hours * 10) / 10) + ' hours'; const m = Math.max(1, Math.round(hours * 60)); return m + (m === 1 ? ' minute' : ' minutes'); };

  return { SEGMENTS, SEGMENT_LABEL, VERDICT_LABEL, VERDICT_EMOJI, LABELS, label, classifySource, readWebsite, speedFrom, buildAudit, publicResult, rules, zipBand, looksLikeGibberish, buildPrompt, describeLead, parseAi, decide, parseRoster, pickRep, manager, firstName, ageText, AI_SCHEMA };
})();

if (typeof module !== 'undefined') module.exports = LIB;
