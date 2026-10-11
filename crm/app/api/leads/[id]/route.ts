import { NextResponse } from "next/server";
import { authorized, deny, notFound } from "@/lib/api";
import { addCorrection, addEvent, getLead, listEvents, updateLead } from "@/lib/leads";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  if (!authorized(req)) return deny();
  const { id } = await params;
  const lead = getLead(id);
  return lead ? NextResponse.json({ lead, events: listEvents(id) }) : notFound();
}

/** n8n updates a lead. Body: columns to change + optional `event` and `correction` {from, to, note, by}. */
export async function PATCH(req: Request, { params }: Ctx) {
  if (!authorized(req)) return deny();
  const { id } = await params;
  if (!getLead(id)) return notFound();
  const { event, correction, ...fields } = (await req.json().catch(() => ({}))) as Record<string, any>;
  const lead = updateLead(id, fields);
  if (correction?.to) addCorrection(id, correction.from, correction.to, correction.note || null, correction.by || "n8n");
  if (event?.type) addEvent(id, event.type, event.actor || "n8n", event.detail || null);
  return NextResponse.json({ lead });
}
