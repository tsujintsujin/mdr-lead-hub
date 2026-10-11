import { db, now, nextLeadId } from "./db";

import { STAGES, VERDICTS, STAGE_LABEL, VERDICT_LABEL, SEGMENT_LABEL, type Stage, type Verdict } from "./labels";
export { STAGES, VERDICTS, STAGE_LABEL, VERDICT_LABEL, SEGMENT_LABEL, type Stage, type Verdict };

const JSON_COLS = ["interest", "fields", "tracking", "audit", "ai"] as const;
const WRITABLE = [
  "business", "contact_name", "email", "phone", "website", "location", "segment", "size", "interest", "fields", "tracking",
  "source", "audit", "ai", "score", "verdict", "verdict_by", "assignee", "assignee_email", "stage", "slack_channel",
  "slack_ts", "asana_task_gid", "asana_project_gid", "first_contact_at", "escalated_at", "duplicate_of", "token", "site", "variant",
] as const;

export type Lead = {
  id: string; created_at: string; updated_at: string; site: string; variant: "practice" | "grant"; token: string | null;
  business: string; contact_name: string | null; email: string | null; phone: string | null; website: string | null;
  location: string | null; segment: string | null; size: string | null; interest: string[]; fields: Record<string, unknown>;
  tracking: Record<string, string>; source: string | null; audit: Audit | null; ai: Ai | null; score: number | null;
  verdict: Verdict | null; verdict_by: string | null; assignee: string | null; assignee_email: string | null; stage: Stage;
  slack_channel: string | null; slack_ts: string | null; asana_task_gid: string | null; asana_project_gid: string | null;
  first_contact_at: string | null; escalated_at: string | null; duplicate_of: string | null;
};
export type Audit = {
  reachable?: boolean; speed?: { score: number | null; lcp_s?: number | null; source?: string };
  checks?: { key: string; ok: boolean; detail?: string }[]; irs?: { found: boolean; name?: string; city?: string; state?: string; ein?: string };
  booking_cta?: boolean; platform?: string | null; public_verdict?: string;
};
export type Ai = { summary?: string; reasons?: string[]; opening_line?: string; confidence?: number; red_flags?: string[]; model?: string; segment?: string; size?: string; intent?: number; rule_notes?: string[] };
export type LeadEvent = { id: number; lead_id: string; at: string; type: string; actor: string; detail: Record<string, unknown> | null };

function parse(row: Record<string, unknown> | undefined): Lead | null {
  if (!row) return null;
  const out: Record<string, unknown> = { ...row };
  for (const c of JSON_COLS) {
    const v = row[c];
    out[c] = typeof v === "string" && v ? JSON.parse(v) : c === "interest" ? [] : c === "fields" || c === "tracking" ? {} : null;
  }
  return out as Lead;
}

function pick(input: Record<string, unknown>) {
  const cols: string[] = [];
  const vals: (string | number | null)[] = [];
  for (const k of WRITABLE) {
    if (!(k in input)) continue;
    let v = input[k];
    if ((JSON_COLS as readonly string[]).includes(k) && v !== null && typeof v !== "string") v = JSON.stringify(v);
    if (typeof v === "boolean") v = v ? 1 : 0;
    cols.push(k);
    vals.push((v ?? null) as string | number | null);
  }
  return { cols, vals };
}

export function getLead(id: string): Lead | null {
  return parse(db.prepare("SELECT * FROM leads WHERE id = ?").get(id) as Record<string, unknown> | undefined);
}

export function findLeadBy(column: "token" | "asana_task_gid" | "slack_ts", value: string): Lead | null {
  return parse(db.prepare(`SELECT * FROM leads WHERE ${column} = ? ORDER BY created_at DESC LIMIT 1`).get(value) as Record<string, unknown> | undefined);
}

export type ListFilter = { verdict?: string; stage?: string; segment?: string; assignee?: string; q?: string; site?: string; staleHours?: number; limit?: number };
export function listLeads(f: ListFilter = {}): Lead[] {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (f.verdict) { where.push("verdict = ?"); args.push(f.verdict); }
  if (f.stage) { where.push("stage = ?"); args.push(f.stage); }
  if (f.segment) { where.push("segment = ?"); args.push(f.segment); }
  if (f.assignee) { where.push("assignee = ?"); args.push(f.assignee); }
  if (f.site) { where.push("site = ?"); args.push(f.site); }
  if (f.q) { where.push("(business LIKE ? OR contact_name LIKE ? OR email LIKE ? OR id LIKE ?)"); const q = `%${f.q}%`; args.push(q, q, q, q); }
  if (f.staleHours) {
    // Still "new", a person was supposed to act, and nobody has for N hours.
    where.push("stage = 'new' AND verdict IN ('hot','warm','talk') AND first_contact_at IS NULL AND created_at <= ?");
    args.push(new Date(Date.now() - f.staleHours * 3600_000).toISOString());
  }
  const sql = `SELECT * FROM leads ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC LIMIT ${Math.min(f.limit ?? 500, 1000)}`;
  return (db.prepare(sql).all(...args) as Record<string, unknown>[]).map((r) => parse(r)!);
}

export function createLead(input: Record<string, unknown>): Lead {
  const id = nextLeadId();
  const t = now();
  const { cols, vals } = pick({ stage: "new", ...input });
  db.prepare(`INSERT INTO leads (id, created_at, updated_at, ${cols.join(", ")}) VALUES (?, ?, ?, ${cols.map(() => "?").join(", ")})`)
    .run(id, (input.created_at as string) || t, t, ...vals);
  return getLead(id)!;
}

export function updateLead(id: string, input: Record<string, unknown>): Lead | null {
  const { cols, vals } = pick(input);
  if (cols.length) db.prepare(`UPDATE leads SET ${cols.map((c) => `${c} = ?`).join(", ")}, updated_at = ? WHERE id = ?`).run(...vals, now(), id);
  return getLead(id);
}

export function addEvent(lead_id: string, type: string, actor: string, detail?: Record<string, unknown> | null) {
  db.prepare("INSERT INTO events (lead_id, at, type, actor, detail) VALUES (?, ?, ?, ?, ?)").run(lead_id, now(), type, actor, detail ? JSON.stringify(detail) : null);
}

export function listEvents(lead_id: string): LeadEvent[] {
  return (db.prepare("SELECT * FROM events WHERE lead_id = ? ORDER BY at ASC, id ASC").all(lead_id) as Record<string, unknown>[])
    .map((r) => ({ ...(r as unknown as LeadEvent), detail: r.detail ? JSON.parse(r.detail as string) : null }));
}

/** Same email or same website domain in the last 30 days. */
export function findDuplicates(email?: string | null, website?: string | null): Lead[] {
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const host = website ? website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase() : "";
  const rows = db.prepare(
    `SELECT * FROM leads WHERE created_at >= ? AND duplicate_of IS NULL AND ((? <> '' AND lower(email) = lower(?)) OR (? <> '' AND lower(replace(replace(replace(website,'https://',''),'http://',''),'www.','')) LIKE ?)) ORDER BY created_at DESC`,
  ).all(since, email || "", email || "", host, host + "%") as Record<string, unknown>[];
  return rows.map((r) => parse(r)!);
}

export function addCorrection(lead_id: string, from: string, to: string, note: string | null, by: string) {
  db.prepare("INSERT INTO corrections (lead_id, at, from_verdict, to_verdict, note, by) VALUES (?, ?, ?, ?, ?, ?)").run(lead_id, now(), from, to, note, by);
}

/** The latest corrections, shaped as examples the model can learn from. */
export function correctionExamples(limit = 6) {
  const rows = db.prepare(
    `SELECT c.from_verdict, c.to_verdict, c.note, l.variant, l.business, l.segment, l.fields, l.audit FROM corrections c JOIN leads l ON l.id = c.lead_id ORDER BY c.at DESC LIMIT ?`,
  ).all(limit) as Record<string, string>[];
  return rows.map((r) => {
    const f = JSON.parse(r.fields || "{}");
    return {
      variant: r.variant, business: r.business, segment: r.segment,
      answers: { goals: f.goals, budget: f.budget, timeline: f.timeline, locations: f.locations, nonprofit_status: f.nonprofit_status, mission: f.mission, staff: f.staff, message: f.message },
      model_said: r.from_verdict, person_said: r.to_verdict, why: r.note,
    };
  });
}

export function workload(): Record<string, number> {
  const rows = db.prepare("SELECT assignee, COUNT(*) n FROM leads WHERE stage IN ('new','contacted','booked') AND assignee IS NOT NULL GROUP BY assignee").all() as { assignee: string; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.assignee, Number(r.n)]));
}

export function stats(sinceIso?: string) {
  const since = sinceIso || "1970-01-01";
  const q = (sql: string) => db.prepare(sql).all(since) as Record<string, string | number>[];
  const by = (col: string) => q(`SELECT ${col} k, COUNT(*) n FROM leads WHERE created_at >= ? AND duplicate_of IS NULL GROUP BY ${col} ORDER BY n DESC`);
  const total = Number((db.prepare("SELECT COUNT(*) n FROM leads WHERE created_at >= ? AND duplicate_of IS NULL").get(since) as { n: number }).n);
  const response = q(`SELECT (julianday(first_contact_at) - julianday(created_at)) * 24 h FROM leads WHERE created_at >= ? AND first_contact_at IS NOT NULL ORDER BY h`).map((r) => Number(r.h));
  const median = response.length ? response[Math.floor(response.length / 2)] : null;
  const corrected = Number((db.prepare("SELECT COUNT(DISTINCT lead_id) n FROM corrections WHERE at >= ?").get(since) as { n: number }).n);
  const scored = Number((db.prepare("SELECT COUNT(*) n FROM leads WHERE created_at >= ? AND verdict_by IN ('ai','rules','person')").get(since) as { n: number }).n);
  return {
    total, bySource: by("source"), bySegment: by("segment"), byVerdict: by("verdict"), byStage: by("stage"), byAssignee: by("assignee"), bySite: by("site"),
    medianHoursToContact: median, contacted: response.length, corrected, scored,
    stale: listLeads({ staleHours: 24 }).length,
  };
}
