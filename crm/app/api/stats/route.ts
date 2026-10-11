import { NextResponse } from "next/server";
import { authorized, deny } from "@/lib/api";
import { stats } from "@/lib/leads";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!authorized(req)) return deny();
  const since = new URL(req.url).searchParams.get("since") || undefined;
  return NextResponse.json(stats(since));
}
