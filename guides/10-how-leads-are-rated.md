# 10 · How a lead is rated

Every lead gets a **score from 0 to 100** and a **grade** (Hot, Warm, Needs a
conversation, Not a fit, Spam). The score has two parts:

| Part | Who gives it | Max points |
|---|---|---|
| **Rules**: fixed checks on the form answers and the website | n8n | 70 |
| **Intent**: how ready they sound to buy | Ollama (the local AI, qwen2.5:7b) | 30 |

All of this is in `n8n/lib/intake.js` (`rules()`, `buildPrompt()`, `decide()`, `pickRep()`).

---

## Step 1. Spam check (n8n, before anything else)

The lead is **Spam** (score 0, sent to nobody) if any of these is true:

| Check | Example |
|---|---|
| Throwaway email address | `@mailinator.com`, `@yopmail.com`, `@10minutemail.com` |
| Sales words in the message | "backlinks", "guest post", "casino", "crypto", "link building", "buy followers" |
| More than one web link in the message | `http://... and http://...` |
| Business name **and** contact name both look like keyboard mashing | "xkcdqwrt" |

Later, the AI can also mark it Spam if it says they're **selling to MDR**.

---

## Step 2. Rules score (n8n, up to 70 points)

### Site A: clinics (Practice Growth Check)

| Check | Answer → points |
|---|---|
| **Location** (from ZIP code) | Northeast Ohio, ZIP 440–449 → **20** · rest of Ohio, ZIP 430–458 → **12** · elsewhere or none → **5** |
| **Monthly budget** | over $5,000 → **20** · $1,500–5,000 → **17** · $500–1,500 → **11** · not sure → **6** · under $500 → **2** |
| **Timeline** | as soon as possible → **15** · next 3 months → **9** · just looking → **3** |
| **Website problems MDR could fix** (up to 15) | mobile speed under 50 → **8**, or 50–89 → **5** · 2 or more page basics missing → **5** · site loads but has no booking button or phone link → **2** |
| **Forced Not a fit** | budget under $500 **and** just looking |

Page basics checked: page title, meta description (the summary Google shows),
one main heading, https (secure), works on phones, local-business details for
Google.

### Site B: nonprofits (Grant Ready)

| Check | Answer → points |
|---|---|
| **501(c)(3) status** (registered US charity) | yes → **25** · applied → **10** · not sure → **8** · no → **0** |
| **IRS records** (via ProPublica) | found → **15** · says "yes" but not found → **5** |
| **Google Ad Grants today** | has it but barely uses it → **15** · doesn't have it → **12** · runs it well → **5** |
| **Paid staff** | 26+ or 6–25 → **10** · 1–5 → **7** · volunteers only → **3** |
| **Website loads on https** | yes → **5** |
| **Forced Not a fit** | no 501(c)(3), **or** a hospital, school or government agency (Google excludes them) |

The rules total is capped at 70.

---

## Step 3. The AI's part (Ollama, up to 30 points)

**What it is:** qwen2.5:7b, a free model by Alibaba, running on your PC through
Ollama. It is **not trained on MDR data**; it's the standard model.

**How it knows what to do:** n8n sends it a written brief for every lead:

1. Who MDR is (a Cleveland agency doing SEO, Google Ads, Ad Grants, social ads
   and websites) and who their best clients are (Northeast Ohio clinics, home
   services, nonprofits).
2. What to judge, field by field (the table below).
3. The lead: form used, business, answers, the website check, where they came
   from, their message, and up to 500 characters from their home page.
4. **Up to 5 recent corrections** from the team: "the AI said X, a person changed
   it to Y because Z". This is how it learns from the team without training.

Settings: temperature 0.2 (low, so the same lead gets nearly the same answer),
and a JSON schema (a fixed answer shape), so it can only reply in this form:

| Field | What it means | Used for |
|---|---|---|
| **intent** | 0–30: how ready to buy. Specific problems, deadlines and budget talk score high; vague curiosity scores low | Added to the score |
| **confidence** | 0–1: how sure it is | Below 0.55 → Needs a conversation |
| **segment** | What the business really is: healthcare and wellness, home services, nonprofit, professional services, retail and e-commerce, restaurants and hospitality, other | Picks the salesperson |
| **vendor_pitch** | true if they're selling *to* MDR | Spam |
| **size** | solo, small, multi-location, unknown | Shown to the rep |
| **summary** | One sentence for a busy rep | CRM, Slack, Asana, Sheet |
| **reasons** | Up to 4 short reasons | CRM, Slack, Asana |
| **opening_line** | The first thing the rep should say | CRM, Slack, Asana |
| **red_flags** | Up to 3 warnings | CRM |

If Ollama doesn't answer, the lead is scored on rules only and becomes **Needs
a conversation**, with "The AI step did not answer, so a person should look at
this one".

---

## Step 4. The grade (n8n combines both)

Checked in this order; the first that applies wins:

| # | Condition | Grade |
|---|---|---|
| 1 | Spam (step 1) | **Spam**, score 0 |
| 2 | The AI didn't answer | **Needs a conversation** |
| 3 | The AI says they're selling to MDR | **Spam**, score 0 |
| 4 | A rule forced it (step 2) | **Not a fit** |
| 5 | Clinic form, but the AI is fairly sure (0.5+) it's another kind of business | **Needs a conversation**, sent to that business type's rep |
| 6 | The AI's confidence is under 0.55 | **Needs a conversation** |
| 7 | Otherwise, by total score (rules + intent) | **70+ Hot** · **45–69 Warm** · **30–44 Needs a conversation** · **under 30 Not a fit** |

---

## Step 5. Picking the salesperson (n8n)

From the **Team** tab of the Google Sheet:

1. People marked **Active = Yes** whose **Covers** column includes the lead's
   segment (from the AI).
2. If nobody covers it: whoever covers **other** (Dana Price).
3. If still nobody: the manager (the row with `*`).
4. Among those, the one with the **fewest open leads** in the CRM (New,
   Contacted or Booked). On a tie, whoever is higher in the Sheet.

---

## Real examples

| Lead | Rules | AI intent | Total | Grade | Why |
|---|---|---|---|---|---|
| tapndine (Site B, 4 Nov 2026) | 24 | 10 | 34 | Not a fit | Answered "no 501(c)(3)" → forced Not a fit (rule 4) |
| Summit Roofing (Site A) | 47 | 10 | 57 | Needs a conversation | A roofer on the clinic form (rule 5), so it went to Ben (home services) |
| The Joint Chiropractic (Site A) | 60 | 25 | 85 | Hot | Northeast Ohio (20), $1,500–5,000 (17), ASAP (15), website problems (8); the AI read a clear, urgent need |
| RankBoost Digital (Site A) | — | not asked | 0 | Spam | "backlinks" in the message and two links (step 1), so the AI was skipped |

To see the numbers for any lead: open it in the CRM. Under "What the AI made of
it" it says "Rules gave X of 70, the model added Y of 30 for intent".
