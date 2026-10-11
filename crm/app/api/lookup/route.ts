import { NextResponse } from "next/server";
import { authorized, deny } from "@/lib/api";
import { findDuplicates, findLeadBy } from "@/lib/leads";

export const dynamic = "force-dynamic";

/** ?email=&website= -> recent duplicates; ?token= / ?asana_task= / ?slack_ts= -> one lead. */
export async function GET(req: Request) {
  if (!authorized(req)) return deny();
  const u = new URL(req.url).searchParams;
  if (u.get("token")) return NextResponse.json({ lead: findLeadBy("token", u.get("token")!) });
  if (u.get("asana_task")) return NextResponse.json({ lead: findLeadBy("asana_task_gid", u.get("asana_task")!) });
  if (u.get("slack_ts")) return NextResponse.json({ lead: findLeadBy("slack_ts", u.get("slack_ts")!) });
  return NextResponse.json({ duplicates: findDuplicates(u.get("email"), u.get("website")) });
}
