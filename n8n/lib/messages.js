// MDR Lead Hub: Slack blocks and email bodies. Wording comes from n8n/copy.md (humanized).
// Pure functions; inlined into the n8n Code nodes by build.mjs.

const MSG = (() => {
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const slackEsc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const CHECK_LABEL = {
    title: 'Page title', meta_description: 'Meta description', h1: 'One clear main heading', https: 'Secure (https)',
    viewport: 'Works on phones', local_schema: 'Local business details for Google',
    irs: 'Found in IRS nonprofit records', site_https: 'Website loads on https', mission_content: 'Enough about the mission on the site', org_type: 'An organization type Google accepts',
  };
  const STAMP = { likely: 'likely eligible', almost: 'almost there', not_yet: 'not eligible yet' };
  const band = (s) => (s == null ? 'we couldn’t measure it' : s >= 90 ? 'quick' : s >= 50 ? 'middling' : 'slow enough to lose people');

  function speedLine(audit) {
    if (!audit.reachable) return 'the site didn’t load for us';
    const s = audit.speed || {};
    return s.score == null ? 'speed not measured' : `mobile speed ${s.score}/100${s.source === 'estimate' ? ' (estimate)' : ''}`;
  }
  function checksLine(audit) {
    const miss = (audit.checks || []).filter((c) => !c.ok).map((c) => CHECK_LABEL[c.key] || c.key);
    return miss.length ? `Missing: ${miss.join(', ').toLowerCase()}` : 'All the basics are in place';
  }

  /* ---------- Slack ---------- */
  function slackLead(L, x) {
    // L: lead fields; x: { lib, crmUrl, rep, status }
    const v = L.verdict;
    const head = `${x.lib.VERDICT_EMOJI[v]} ${x.lib.VERDICT_LABEL[v]} lead: ${L.business}`;
    const f = L.fields || {};
    const L2 = x.lib.label;
    const facts = L.variant === 'grant'
      ? [`*Contact*\n${slackEsc(f.name)}${f.role ? ', ' + slackEsc(f.role) : ''}`, `*Assigned to*\n${slackEsc(x.rep ? x.rep.name : 'Nobody yet')}`, `*Status*\n${L2('nonprofit_status', f.nonprofit_status)}`, `*Ad Grants*\n${L2('grant_status', f.grant_status)}`]
      : [`*Contact*\n${slackEsc(f.name)}`, `*Assigned to*\n${slackEsc(x.rep ? x.rep.name : 'Nobody yet')}`, `*Budget*\n${L2('budget', f.budget)}`, `*Timing*\n${L2('timeline', f.timeline)}`];
    const blocks = [
      { type: 'header', text: { type: 'plain_text', text: head.slice(0, 150), emoji: true } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `Score *${L.score}*. ${x.lib.SEGMENT_LABEL[L.segment] || L.segment}. Came from ${slackEsc(L.source)}. <${x.crmUrl}|${L.id}>` }] },
      { type: 'section', fields: facts.map((t) => ({ type: 'mrkdwn', text: t })) },
    ];
    if (L.ai && L.ai.summary) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*AI read:* ${slackEsc(L.ai.summary)}` } });
    if (L.why && L.why.length) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: L.why.map((w) => `• ${slackEsc(w)}`).join('\n') } });
    if (L.ai && L.ai.opening_line) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*Opening line:* _${slackEsc(L.ai.opening_line)}_` } });
    if (x.status) blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: x.status }] });
    const done = ['won', 'lost'].includes(L.stage);
    if (!done) {
      blocks.push({
        type: 'actions', block_id: 'lead_actions',
        elements: [
          L.stage === 'new' ? { type: 'button', action_id: 'mdr_contacted', text: { type: 'plain_text', text: 'Mark contacted' }, style: 'primary', value: L.id } : null,
          L.stage !== 'booked' ? { type: 'button', action_id: 'mdr_booked', text: { type: 'plain_text', text: 'Booked a call' }, value: L.id } : null,
          L.verdict !== 'not_fit' ? {
            type: 'button', action_id: 'mdr_not_fit', text: { type: 'plain_text', text: 'Not a fit' }, style: 'danger', value: L.id,
            confirm: { title: { type: 'plain_text', text: 'Mark as not a fit?' }, text: { type: 'mrkdwn', text: 'This corrects the AI’s verdict and teaches it for next time.' }, confirm: { type: 'plain_text', text: 'Not a fit' }, deny: { type: 'plain_text', text: 'Cancel' } },
          } : null,
          { type: 'button', action_id: 'mdr_open', text: { type: 'plain_text', text: 'Open in CRM' }, url: x.crmUrl, value: L.id },
        ].filter(Boolean),
      });
    }
    return { text: `${head} (score ${L.score})`, blocks };
  }

  /* ---------- email shell ---------- */
  function shell(bodyHtml) {
    return `<!doctype html><html><body style="margin:0;padding:24px;background:#f3f5f4;font-family:Arial,Helvetica,sans-serif;color:#16302E;font-size:15px;line-height:1.55">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #d9e2df;border-radius:10px;padding:28px">${bodyHtml}</div></body></html>`;
  }
  const p = (s) => `<p style="margin:0 0 14px">${s}</p>`;
  const ul = (items) => `<ul style="margin:0 0 16px;padding-left:20px">${items.map((i) => `<li style="margin:0 0 6px">${i}</li>`).join('')}</ul>`;
  const btn = (href, text) => `<p style="margin:20px 0"><a href="${esc(href)}" style="display:inline-block;background:#3E7C74;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:bold">${esc(text)}</a></p>`;

  function repEmail(L, x) {
    const f = L.fields || {};
    const subj = `${x.lib.VERDICT_EMOJI[L.verdict]} ${x.lib.VERDICT_LABEL[L.verdict]} lead for you: ${L.business} (${L.score})`;
    const html = [
      p(`Hi ${esc(x.lib.firstName(x.rep.name))},`),
      p(`<strong>${esc(L.business)}</strong> just came through ${esc(x.siteName)}, and it’s landed on your desk.`),
      L.ai && L.ai.summary ? p(`The short read: ${esc(L.ai.summary)}`) : '',
      L.why && L.why.length ? p('Why it scored that way:') + ul(L.why.map(esc)) : '',
      L.ai && L.ai.opening_line ? p(`A good way in, maybe: <em>“${esc(L.ai.opening_line)}”</em>`) : '',
      p(`Their site right now: ${esc(speedLine(L.audit))}. ${esc(checksLine(L.audit))}.`),
      L.ai && L.ai.red_flags && L.ai.red_flags.length ? p(`Heads up before you call: ${esc(L.ai.red_flags.join('; '))}`) : '',
      p(`Contact: ${esc(f.name)}, <a href="mailto:${esc(f.email)}">${esc(f.email)}</a>${f.phone ? ', ' + esc(f.phone) : ''}`),
      btn(x.crmUrl, `Open ${L.id} in the CRM`),
      x.asanaDue ? p(`There’s an Asana task waiting too, due ${esc(x.asanaDue)}.`) : '',
      `<p style="margin:18px 0 0;color:#5B716E;font-size:13px">MDR Lead Hub</p>`,
    ].join('');
    return { subject: subj, html: shell(html) };
  }

  function prospectEmail(L, x) {
    const f = L.fields || {};
    const first = esc(x.lib.firstName(f.name));
    const a = L.audit || {};
    const sign = `<p style="margin:18px 0 0">Marketing Done Right, Cleveland</p>`;
    if (L.variant === 'grant') {
      const stamp = STAMP[a.public_verdict] || STAMP.almost;
      const subject = `Your Ad Grants check, ${f.org_name}`;
      const list = ul((a.checks || []).map((c) => `${c.ok ? '✓' : '✕'} ${esc(CHECK_LABEL[c.key] || c.key)}${c.detail ? ` <span style="color:#5B716E">(${esc(c.detail)})</span>` : ''}`));
      if (L.verdict === 'not_fit') {
        const noStatus = f.nonprofit_status === 'no';
        const excluded = f.mission === 'hospital_school_gov';
        const reason = excluded ? 'Google keeps hospitals, schools and government agencies out of Ad Grants' : noStatus ? 'Ad Grants needs 501(c)(3) status, and you told us you don’t have it yet' : 'the checks below came back short';
        return { subject, html: shell([
          p(`Hi ${first},`), p(`Thanks for checking. Right now ${esc(f.org_name)} doesn’t qualify for Google Ad Grants. The reason: ${esc(reason)}.`), list,
          noStatus ? p('Once your 501(c)(3) status comes through, give the check another go. Two minutes, tops.') : '',
          excluded ? p('Google runs separate programs for hospitals, schools and government agencies, so Ad Grants isn’t really your road.') : '',
          p('Still want a hand with search ads or your website? Reply here and we’ll talk it through.'), sign].join('')) };
      }
      return { subject, html: shell([
        p(`Hi ${first},`), p(`Here’s where ${esc(f.org_name)} stands with Google Ad Grants: <strong>${esc(stamp)}</strong>.`), list,
        x.rep ? p(`${esc(x.rep.name)} looks after Ad Grants accounts at Marketing Done Right and will email you within one business day about next steps.`) : '', sign].join('')) };
    }
    const subject = `Your website checkup, ${f.business}`;
    const s = a.speed || {};
    const okN = (a.checks || []).filter((c) => c.ok).length;
    const miss = (a.checks || []).filter((c) => !c.ok).map((c) => CHECK_LABEL[c.key]);
    const results = a.reachable
      ? ul([`Mobile speed: <strong>${s.score == null ? 'not measured' : s.score + '/100'}</strong>, ${esc(band(s.score))}`, `Google basics: <strong>${okN} of ${(a.checks || []).length}</strong> in place${miss.length ? '. Missing: ' + esc(miss.join(', ').toLowerCase()) : ''}`])
      : p(`We couldn’t open ${esc(f.website)}. It may be down, or it may block automated visits.`);
    if (L.verdict === 'not_fit') {
      return { subject, html: shell([
        p(`Hi ${first},`), p('Thanks for running the checkup. Your results are below, and they’re yours to keep, whatever you decide.'), results,
        p('To be straight with you, going by what you told us, a full agency retainer probably isn’t the right spend for you just now. Three things you can do yourself that tend to move the needle most: fill your Google Business Profile out completely, ask happy patients for reviews, and make your phone number tappable at the top of every page.'),
        p('If things change down the road, run the checkup again or reply here. We’d be glad to hear from you.'), sign].join('')) };
    }
    return { subject, html: shell([
      p(`Hi ${first},`), p(`Thanks for running the checkup. Here’s the gist of what we saw on ${esc(String(f.website || '').replace(/^https?:\/\//, ''))}:`), results,
      x.rep ? p(`${esc(x.rep.name)} works with clinics here at Marketing Done Right, and they’ll email you within one business day to go through it properly. Anything urgent? Just hit reply.`) : '', sign].join('')) };
  }

  return { slackLead, repEmail, prospectEmail, speedLine, checksLine, CHECK_LABEL, esc };
})();

if (typeof module !== 'undefined') module.exports = MSG;
