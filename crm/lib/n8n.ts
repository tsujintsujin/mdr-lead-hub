// The CRM stays thin: every change a person makes here is handed to n8n,
// which updates Slack, Asana, the Google Sheet and sends any emails.
const BASE = process.env.N8N_BASE || "http://localhost:5678";

export async function tellN8n(action: string, payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch(`${BASE}/webhook/mdr-crm-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-MDR-Key": process.env.CRM_API_KEY || "" },
      body: JSON.stringify({ action, ...payload }),
      signal: AbortSignal.timeout(8000),
    });
    return r.ok ? { ok: true } : { ok: false, error: `n8n answered ${r.status}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type RosterRep = { name: string; email: string; role: string; covers: string[]; channel: string; active: boolean };

export async function roster(): Promise<RosterRep[] | null> {
  try {
    const r = await fetch(`${BASE}/webhook/mdr-roster`, { headers: { "X-MDR-Key": process.env.CRM_API_KEY || "" }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    return ((await r.json()) as { reps: RosterRep[] }).reps;
  } catch {
    return null;
  }
}
