# 04 · Ollama and the qwen2.5:7b model

**Connects to:** n8n only. n8n sends it one request per lead and reads the
answer (see [00-how-it-all-connects.md](00-how-it-all-connects.md),
connection 8). Nothing else talks to it.

---

## 1. What it is

**Ollama** is a free program that runs AI language models on your own PC.
**qwen2.5:7b** is the model: Qwen 2.5 by Alibaba, 7.6 billion parameters,
squeezed to 4.7 GB (Q4_K_M quantization) so it fits on a normal PC. No paid AI
service is used anywhere in this project, and no lead data leaves the PC for
this step.

| | |
|---|---|
| Ollama version on this PC | 0.40.14 |
| Program | `C:\Users\justi\AppData\Local\Programs\Ollama\` (`ollama app.exe` in the tray) |
| Models stored in | `C:\Users\justi\.ollama\models\` |
| Address | http://127.0.0.1:11434 |
| Models installed | `qwen2.5:7b` (used here), `qwen2.5-coder:7b` (not used here) |
| Starts | With Windows (tray icon) |

---

## 2. Every link

| What | Link |
|---|---|
| Is it running? (answers "Ollama is running") | http://127.0.0.1:11434 |
| Installed models (JSON) | http://127.0.0.1:11434/api/tags |
| Models loaded in memory right now | http://127.0.0.1:11434/api/ps |
| The model's page | https://ollama.com/library/qwen2.5 |
| Ollama docs | https://docs.ollama.com/ |
| The chat API n8n uses | https://docs.ollama.com/api/chat |
| Structured outputs (forcing a JSON shape) | https://docs.ollama.com/capabilities/structured-outputs |
| Ollama on GitHub | https://github.com/ollama/ollama |
| Qwen 2.5 announcement | https://qwenlm.github.io/blog/qwen2.5/ |

## 3. Commands (any terminal)

| Command | What it does |
|---|---|
| `ollama list` | Installed models |
| `ollama ps` | Loaded models, how much memory, how long they stay loaded |
| `ollama run qwen2.5:7b` | Chat with the model yourself (type `/bye` to leave) |
| `ollama show qwen2.5:7b` | Model details (size, context length 32,768) |
| `ollama pull qwen2.5:7b` | Download it again if it's missing |
| `ollama stop qwen2.5:7b` | Unload it from memory |

---

## 4. How n8n uses it

The node is **Ollama qwen2.5:7b** in **MDR · Lead intake**
(http://localhost:5678/workflow/0q7M3z21CrndQsD5). The node before it, **Write
the prompt**, builds the request with `buildPrompt()` from `n8n/lib/intake.js`.

**The request** (`POST http://127.0.0.1:11434/api/chat`):

| Setting | Value | Why |
|---|---|---|
| `model` | `qwen2.5:7b` | |
| `stream` | `false` | One complete answer, not word by word |
| `format` | A JSON schema | Ollama forces the answer into exactly this shape, so n8n can read it |
| `temperature` | `0.2` | Low, so the same lead gets nearly the same answer every time |
| `num_ctx` | `4096` | How much text it reads at once (tokens). Enough for the lead plus the instructions |

**The system message** tells the model who MDR is (Cleveland agency; SEO,
Google Ads, Ad Grants, social ads, websites; best clients are Northeast Ohio
clinics, home services and nonprofits) and what each answer field means.

**The user message** contains:
1. A description of the lead: which form, business, type, ZIP, website,
   locations, budget, timeline, goals, contact, the website check result, where
   they came from, and their message.
2. Up to 500 characters of text from their home page.
3. **The team's recent corrections** (up to 5 from the CRM): "the model said X,
   a person changed it to Y because Z". This is how it learns from the team
   without any retraining.

**The answer** it must give (the JSON schema):

| Field | Meaning |
|---|---|
| `segment` | What the business really is: healthcare_wellness, home_services, nonprofit, professional_services, retail_ecommerce, restaurant_hospitality, other. A roofer on the clinic form → home_services |
| `size` | solo, small, multi_location, unknown |
| `intent` | 0–30: how ready they are to buy. Added to the rules score |
| `confidence` | 0–1: how sure it is |
| `vendor_pitch` | true if they are selling **to** MDR → spam |
| `summary` | One sentence for a busy rep |
| `reasons` | Up to 4 short reasons |
| `opening_line` | The first sentence the rep should say |
| `red_flags` | Up to 3 warnings |

**Decide the verdict** (the next node) then checks and clamps every field
(`parseAi`) and combines it with the rules (the full table is in
[02-n8n.md](02-n8n.md), section 5). The AI can:
- add 0–30 points;
- move a lead to another rep's segment;
- turn it into **Needs a conversation** when its confidence is under 0.55, or
  when the clinic form was used by another kind of business;
- turn it into **Spam** if it's a vendor pitch.

The AI **can't** override a rule that already said Spam or Not a fit.

**Where you see the answer:** the CRM lead page, "What the AI made of it"
(summary, reasons, "Try opening with", confidence, and "Rules gave X of 70, the
model added Y of 30"). Also on the Slack card ("AI read" and "Opening line").

---

## 5. Speed

Ollama keeps a model in memory for **5 minutes** after its last use (its
default). After that, the next lead has to load 4.7 GB from disk first.

| Situation | Time for the AI step |
|---|---|
| First lead after a restart or 5 idle minutes | ~45–60 seconds (measured 48 s on 4 Nov 2026) |
| A lead right after another | Usually a few seconds to ~15 seconds |

This happens after the visitor's results page has already shown their website
check. The slow part only delays the rep's name appearing.

---

## 6. If it's not running

The **Ollama qwen2.5:7b** node is set to carry on after an error. **Decide the
verdict** sees no answer and scores with rules only:
- every lead that isn't spam becomes **Needs a conversation**;
- the reason "The AI step did not answer, so a person should look at this one"
  is added;
- the CRM shows no AI summary.

Nothing is lost; a person just has more to read.

---

## 7. Try it yourself

1. In a terminal: `ollama run qwen2.5:7b`
2. Paste: `You qualify leads for a marketing agency in Cleveland. In one sentence: is a roofing company in Parma asking for storm-damage leads a good fit?`
3. Read the answer, then `/bye`.
4. To see exactly what n8n sent and got back for a real lead: open
   http://localhost:5678/home/executions, open a **MDR · Lead intake** run,
   click **Write the prompt** (the request) and **Ollama qwen2.5:7b** (the
   answer).

## 7b. Changing how it judges leads

- The instructions: `buildPrompt()` in `n8n/lib/intake.js`.
- What happens with its answer: `decide()` in the same file.
- Then `node n8n/test.js`, `node n8n/build.mjs`.
- Or, without code: correct verdicts in the CRM with a clear reason. The
  latest 5 corrections go into every prompt.
- To try a different model: `ollama pull <name>`, change `model: 'qwen2.5:7b'`
  in the `CFG` block of `n8n/build.mjs`, rebuild. Keep it local (project rule:
  no paid API).

## 8. When something is wrong

| Symptom | Cause | Fix |
|---|---|---|
| Every new lead is "Needs a conversation" with "The AI step did not answer" | Ollama not running | Start Ollama from the Start menu; check http://127.0.0.1:11434 |
| `ollama list` doesn't show `qwen2.5:7b` | Model deleted | `ollama pull qwen2.5:7b` |
| The AI step takes a minute | Model was unloaded (cold start) | Normal; see section 5 |
| PC is very slow during a lead | The model uses a lot of memory while it runs | Normal; it unloads after 5 idle minutes |
