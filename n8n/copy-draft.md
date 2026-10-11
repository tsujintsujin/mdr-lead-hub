# Email to the rep (internal)
Subject: {emoji} {verdict} lead for you: {business} ({score})
Hi {rep_first},
{business} just came in through {site_name} and it's yours.
What the AI made of it: {summary}
Why: (bullets)
Try opening with: "{opening_line}"
Their website: {speed line}; {checks line}
{red flags if any: "Before you call: ..."}
Open the lead: {crm_link}
{if asana: "There's an Asana task for this, due {due}."}
— MDR Lead Hub

# Email to the prospect: practice, fit (hot/warm/talk)
Subject: Your website checkup, {business}
Hi {first},
Thanks for running the checkup. Here's the short version of what we found on {website}:
- Mobile speed: {score}/100 ({band words})
- Google basics: {n} of 6 in place{missing list: "Missing: ..."}
{rep_first} {rep_last} works with clinics here at Marketing Done Right and will email you within one business day to walk through it. If anything's urgent, just reply to this email.
Marketing Done Right, Cleveland

# Email to the prospect: practice, not a fit
Subject: Your website checkup, {business}
Hi {first},
Thanks for running the checkup. Your results are below, and they're yours to keep whatever you decide.
(results)
Honestly, from what you told us, a full agency retainer probably isn't the right move for you right now. A few things you can do yourself that usually help most: get your Google Business Profile fully filled in, ask happy patients for reviews, and make sure your phone number is tappable at the top of every page.
If things change, run the checkup again or reply here. We'd be glad to hear from you.

# Email to the prospect: grant, likely/almost
Subject: Your Ad Grants check, {org}
Hi {first},
Here's where {org} stands with Google Ad Grants: {stamp words}.
(checklist)
{rep} handles Ad Grants accounts at Marketing Done Right and will email you within one business day with next steps.

# Email to the prospect: grant, not eligible
Subject: Your Ad Grants check, {org}
Hi {first},
Thanks for checking. Right now {org} doesn't qualify for Google Ad Grants, and here's why: {reason}.
{if no 501c3: "Once your 501(c)(3) status comes through, run the check again. It only takes two minutes."}
{if hospital/school/gov: "Google runs separate programs for hospitals, schools and government agencies, so Ad Grants isn't the route for you."}
If you'd still like help with search ads or your website, reply here and we'll talk it through.

# Slack
Header: {emoji} {verdict} lead: {business}
Line: Score {score} · {segment} · {source}  -> avoid middle dot? Slack context ok: "Score 87, healthcare and wellness, from Google Ads"
Fields: Contact / Assigned to / Budget / Timeline
AI says: {summary}
Opening line: _{opening}_
Buttons: Mark contacted / Booked a call / Not a fit / Open in CRM
After click: "✅ {who} marked this contacted at {time}"
Duplicate thread reply: "Submitted again on {date} through {site}. Nothing new was routed."
Escalation (#mdr-ops): "⏰ {business} came in {hours} hours ago as {verdict} and nobody has contacted them yet. {rep} owns it."
Daily digest (#mdr-daily): "Yesterday: {n} leads. {hot} hot, {warm} warm, {talk} need a conversation. Top source: {source}. {stale} still waiting on a first contact."
