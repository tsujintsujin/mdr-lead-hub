import { NextResponse } from "next/server";
import { authorized, deny, bad } from "@/lib/api";
import { addEvent, createLead, listLeads } from "@/lib/leads";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!authorized(req)) return deny();
  const u = new URL(req.url).searchParams;
  const leads = listLeads({
    verdict: u.get("verdict") || undefined, stage: u.get("stage") || undefined, segment: u.get("segment") || undefined,
    assignee: u.get("assignee") || undefined, q: u.get("q") || undefined,
    staleHours: u.get("stale_hours") ? Number(u.get("stale_hours")) : undefined, limit: u.get("limit") ? Number(u.get("limit")) : undefined,
  });
  return NextResponse.json({ leads });
}

/** n8n creates a lead. Body: lead columns + optional `event` {type, actor, detail}. */
export async function POST(req: Request) {
  if (!authorized(req)) return deny();
  const body = await req.json().catch(() => null);
  if (!body || !body.business || !body.site || !body.variant) return bad("business, site and variant are required");
  const { event, ...fields } = body;
  const lead = createLead(fields);
  addEvent(lead.id, "received", "n8n", { site: lead.site, source: lead.source });
  if (event?.type) addEvent(lead.id, event.type, event.actor || "n8n", event.detail || null);
  return NextResponse.json({ lead }, { status: 201 });
}
