import { NextResponse } from "next/server";
import crypto from "node:crypto";

/** n8n authenticates with the shared CRM_API_KEY as a Bearer token. */
export function authorized(req: Request): boolean {
  const key = process.env.CRM_API_KEY || "";
  const got = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!key || got.length !== key.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(key));
}
export const deny = () => NextResponse.json({ error: "unauthorized" }, { status: 401 });
export const bad = (msg: string) => NextResponse.json({ error: msg }, { status: 400 });
export const notFound = () => NextResponse.json({ error: "not found" }, { status: 404 });
