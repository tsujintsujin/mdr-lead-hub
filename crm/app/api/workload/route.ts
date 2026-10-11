import { NextResponse } from "next/server";
import { authorized, deny } from "@/lib/api";
import { workload } from "@/lib/leads";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!authorized(req)) return deny();
  return NextResponse.json({ open: workload() });
}
