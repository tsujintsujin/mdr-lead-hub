import { NextResponse } from "next/server";
import { authorized, deny } from "@/lib/api";
import { correctionExamples } from "@/lib/leads";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!authorized(req)) return deny();
  const limit = Number(new URL(req.url).searchParams.get("limit") || 6);
  return NextResponse.json({ examples: correctionExamples(limit) });
}
