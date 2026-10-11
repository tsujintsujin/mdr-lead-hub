import { NextResponse } from "next/server";
import { authorized, deny, notFound, bad } from "@/lib/api";
import { addEvent, getLead } from "@/lib/leads";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!authorized(req)) return deny();
  const { id } = await params;
  if (!getLead(id)) return notFound();
  const b = await req.json().catch(() => null);
  if (!b?.type) return bad("type is required");
  addEvent(id, b.type, b.actor || "n8n", b.detail || null);
  return NextResponse.json({ ok: true }, { status: 201 });
}
