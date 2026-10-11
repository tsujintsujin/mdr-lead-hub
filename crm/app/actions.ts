"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { addCorrection, addEvent, getLead, STAGES, updateLead, VERDICTS, type Stage, type Verdict } from "@/lib/leads";
import { tellN8n } from "@/lib/n8n";
import { now } from "@/lib/db";

async function me(): Promise<string> {
  return (await cookies()).get("mdr_me")?.value || "Marcus Hale";
}

export async function setMe(name: string) {
  (await cookies()).set("mdr_me", name, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}

export async function moveStage(id: string, stage: Stage) {
  const lead = getLead(id);
  if (!lead || !STAGES.includes(stage) || lead.stage === stage) return { ok: false };
  const who = await me();
  const patch: Record<string, unknown> = { stage };
  if (stage !== "new" && !lead.first_contact_at) patch.first_contact_at = now();
  updateLead(id, patch);
  addEvent(id, "stage", `CRM: ${who}`, { from: lead.stage, to: stage });
  const n = await tellN8n("stage", { lead_id: id, from: lead.stage, to: stage, by: who });
  if (!n.ok) addEvent(id, "sync_failed", "CRM", { action: "stage", error: n.error });
  revalidatePath("/", "layout");
  return { ok: true, synced: n.ok };
}

export async function overrideVerdict(id: string, verdict: Verdict, note: string) {
  const lead = getLead(id);
  if (!lead || !VERDICTS.includes(verdict) || lead.verdict === verdict) return { ok: false };
  const who = await me();
  updateLead(id, { verdict, verdict_by: "person" });
  addCorrection(id, lead.verdict || "none", verdict, note.trim().slice(0, 500) || null, who);
  addEvent(id, "override", `CRM: ${who}`, { from: lead.verdict, to: verdict, note: note.trim() || null });
  const n = await tellN8n("override", { lead_id: id, from: lead.verdict, to: verdict, note: note.trim(), by: who });
  if (!n.ok) addEvent(id, "sync_failed", "CRM", { action: "override", error: n.error });
  revalidatePath("/", "layout");
  return { ok: true, synced: n.ok };
}

export async function reassign(id: string, rep: string, email: string) {
  const lead = getLead(id);
  if (!lead || !rep || lead.assignee === rep) return { ok: false };
  const who = await me();
  updateLead(id, { assignee: rep, assignee_email: email });
  addEvent(id, "reassigned", `CRM: ${who}`, { from: lead.assignee, to: rep });
  const n = await tellN8n("reassign", { lead_id: id, from: lead.assignee, to: rep, by: who });
  if (!n.ok) addEvent(id, "sync_failed", "CRM", { action: "reassign", error: n.error });
  revalidatePath("/", "layout");
  return { ok: true, synced: n.ok };
}

export async function addNote(id: string, text: string) {
  const t = text.trim().slice(0, 2000);
  if (!t || !getLead(id)) return { ok: false };
  addEvent(id, "note", `CRM: ${await me()}`, { text: t });
  revalidatePath(`/leads/${id}`);
  return { ok: true };
}
