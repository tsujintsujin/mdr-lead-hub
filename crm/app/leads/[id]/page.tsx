import { notFound } from "next/navigation";
import { getLead, listEvents, VERDICT_LABEL, STAGE_LABEL } from "@/lib/leads";
import { roster } from "@/lib/n8n";
import { VerdictPill, Score, segmentLabel, when, ago } from "../../ui";
import LeadActions from "./actions-panel";

const CHECK_LABEL: Record<string, string> = {
  title: "Page title", meta_description: "Meta description", h1: "One clear main heading", https: "Secure (https)", viewport: "Works on phones",
  local_schema: "Local business details for Google", irs: "Found in IRS nonprofit records", site_https: "Website loads on https",
  mission_content: "Enough about the mission on the site", org_type: "An organization type Google accepts",
};
const ANSWER_LABEL: Record<string, string> = {
  practice_type: "Practice type", goals: "Wants", locations: "Locations", budget: "Budget", timeline: "Timing", message: "Message",
  nonprofit_status: "501(c)(3)", mission: "Mission", grant_status: "Ad Grants today", staff: "Paid staff", ein: "EIN", state: "State", role: "Role", zip: "ZIP",
};
const pretty = (v: unknown) => (Array.isArray(v) ? v.join(", ") : String(v ?? "")).replace(/_/g, " ");

function toolOf(actor: string, type: string): [string, string] {
  if (/slack/i.test(actor) || type === "slack") return ["tool-slack", "S"];
  if (/asana/i.test(actor)) return ["tool-asana", "A"];
  if (/qwen|model/i.test(actor)) return ["tool-ai", "AI"];
  if (/^CRM/.test(actor)) return ["tool-crm", "C"];
  if (/wordpress/i.test(actor)) return ["tool-wp", "W"];
  return ["tool-n8n", "n8n"];
}

function describe(type: string, d: Record<string, any> | null): string {
  const x = d || {};
  switch (type) {
    case "received": return `Form received from ${x.site === "site-b" ? "Grant Ready" : "Practice Growth Check"}${x.source ? `, came from ${x.source}` : ""}`;
    case "scored": return `Scored ${x.score}: ${VERDICT_LABEL[x.verdict as keyof typeof VERDICT_LABEL] || x.verdict}, ${segmentLabel(x.segment)}${x.assignee ? `, routed to ${x.assignee}` : ""}`;
    case "routed": return `Posted to Slack${x.slack && x.slack !== "posted" ? ` (${x.slack})` : ""}${x.asana ? ", Asana task created" : ""}, ${x.emails || 0} email${x.emails === 1 ? "" : "s"} sent`;
    case "stage": return `Moved from ${STAGE_LABEL[x.from as keyof typeof STAGE_LABEL] || x.from} to ${STAGE_LABEL[x.to as keyof typeof STAGE_LABEL] || x.to}`;
    case "override": return `Changed the verdict from ${VERDICT_LABEL[x.from as keyof typeof VERDICT_LABEL] || x.from} to ${VERDICT_LABEL[x.to as keyof typeof VERDICT_LABEL] || x.to}${x.note ? `: “${x.note}”` : ""}`;
    case "reassigned": return `Reassigned from ${x.from || "nobody"} to ${x.to}`;
    case "note": return x.text;
    case "escalated": return `No first contact after ${x.hours} hours, flagged in #mdr-ops and emailed ${x.manager || "the manager"}`;
    case "synced": return x.what || "Other tools updated";
    case "sync_failed": return `Couldn’t reach n8n for “${x.action}”: ${x.error}`;
    case "onboarding": return `Asana onboarding project created${x.url ? "" : ""}`;
    case "resubmitted": return `Sent the form again${x.lead ? ` (${x.lead})` : ""}`;
    default: return type.replace(/_/g, " ");
  }
}

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = getLead(id);
  if (!lead) notFound();
  const events = listEvents(id);
  const reps = (await roster()) || [];
  const a = lead.audit || {};
  const ai = lead.ai || {};
  const f = lead.fields as Record<string, unknown>;
  const slackUrl = lead.slack_ts && lead.slack_channel ? `https://app.slack.com/client/${process.env.SLACK_TEAM_ID}/${lead.slack_channel}/p${lead.slack_ts.replace(".", "")}` : null;
  const asanaUrl = lead.asana_task_gid ? `https://app.asana.com/0/${lead.asana_project_gid || process.env.ASANA_PROJECT}/${lead.asana_task_gid}` : null;
  const speed = a.speed;

  return (
    <>
      <p className="crumbs"><a href="/">Leads</a> / {lead.id}</p>
      <div className="lead-head">
        <div>
          <h1>{lead.business}</h1>
          <div className="meta">
            <VerdictPill v={lead.verdict} /> <Score n={lead.score} />
            <span>{segmentLabel(lead.segment)}</span>
            <span>{lead.variant === "grant" ? "Grant Ready" : "Practice Growth Check"}</span>
            <span title={lead.created_at}>{ago(lead.created_at)}</span>
            {lead.verdict_by === "person" && <span className="muted">verdict set by a person</span>}
          </div>
        </div>
        <LeadActions id={lead.id} stage={lead.stage} verdict={lead.verdict} assignee={lead.assignee} reps={reps.map((r) => ({ name: r.name, email: r.email }))} section="stage" />
      </div>

      <div className="grid2">
        <div>
          <section className="card" aria-labelledby="h-read">
            <h2 id="h-read">What the AI made of it</h2>
            {ai.summary ? <p className="read">{ai.summary}</p> : <p className="read muted">The model didn’t answer for this one, so the rules decided and a person should look.</p>}
            {(ai.reasons?.length ?? 0) > 0 && <ul className="reasons">{ai.reasons!.map((r, i) => <li key={i}>{r}</li>)}</ul>}
            {ai.opening_line && <blockquote className="opener"><small>Try opening with</small>{ai.opening_line}</blockquote>}
            {(ai.red_flags?.length ?? 0) > 0 && <p className="flags">Before you call: {ai.red_flags!.join("; ")}</p>}
            <p className="muted" style={{ margin: "12px 0 0", fontSize: 12 }}>
              {ai.model ? `${ai.model} on MDR’s own machine` : "Rules only"}{typeof ai.confidence === "number" ? `, confidence ${Math.round(ai.confidence * 100)}%` : ""}
              {typeof (ai as any).rule_points === "number" ? `. Rules gave ${(ai as any).rule_points} of 70, the model added ${(ai as any).intent ?? 0} of 30 for intent.` : ""}
            </p>
          </section>

          <section className="card" aria-labelledby="h-time">
            <h2 id="h-time">Everything that happened</h2>
            <ol className="timeline">
              {events.map((e) => {
                const [cls, label] = toolOf(e.actor, e.type);
                return (
                  <li key={e.id}>
                    <span className={`tool ${cls}`} aria-hidden="true">{label}</span>
                    <div>
                      <div>{describe(e.type, e.detail)}</div>
                      <div className="when">{e.actor}, {when(e.at)}</div>
                    </div>
                  </li>
                );
              })}
            </ol>
            <LeadActions id={lead.id} stage={lead.stage} verdict={lead.verdict} assignee={lead.assignee} reps={[]} section="note" />
          </section>
        </div>

        <div>
          <section className="card" aria-labelledby="h-who">
            <h2 id="h-who">Contact</h2>
            <dl className="facts">
              <dt>Name</dt><dd>{lead.contact_name}{f.role ? `, ${f.role}` : ""}</dd>
              <dt>Email</dt><dd><a href={`mailto:${lead.email}`}>{lead.email}</a></dd>
              {lead.phone && <><dt>Phone</dt><dd><a href={`tel:${lead.phone}`}>{lead.phone}</a></dd></>}
              <dt>Website</dt><dd>{lead.website && <a href={/^https?:/.test(lead.website) ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer">{lead.website}</a>}</dd>
              <dt>Came from</dt><dd>{lead.source}{lead.tracking?.utm_campaign ? `, campaign “${lead.tracking.utm_campaign}”` : ""}</dd>
              <dt>Rep</dt><dd>{lead.assignee || "Nobody"}</dd>
            </dl>
            <div className="links" style={{ marginTop: 14 }}>
              {slackUrl && <a className="btn" href={slackUrl} target="_blank" rel="noreferrer">Slack message</a>}
              {asanaUrl && <a className="btn" href={asanaUrl} target="_blank" rel="noreferrer">Asana task</a>}
              {process.env.SHEET_URL && <a className="btn" href={process.env.SHEET_URL} target="_blank" rel="noreferrer">Sheet row</a>}
            </div>
          </section>

          <section className="card" aria-labelledby="h-site">
            <h2 id="h-site">{lead.variant === "grant" ? "Eligibility check" : "Website checkup"}</h2>
            {a.reachable === false && <p>The site didn’t load when n8n tried it.</p>}
            {speed && speed.score != null && (
              <p style={{ margin: "0 0 6px" }}>
                <span className="big-num">{speed.score}</span> <span className="muted">/100 mobile speed{speed.source === "lighthouse" ? ", Lighthouse" : speed.source === "estimate" ? ", estimated" : ""}{speed.lcp_s ? `, main content at ${speed.lcp_s}s` : ""}</span>
              </p>
            )}
            <ul className="checks">
              {(a.checks || []).map((c) => (
                <li key={c.key}><span className={c.ok ? "ok" : "no"} aria-hidden="true">{c.ok ? "✓" : "✕"}</span><span>{CHECK_LABEL[c.key] || c.key}{c.detail ? <span className="muted">, {c.detail}</span> : null}</span><span className="sr-only" style={{ position: "absolute", left: -9999 }}>{c.ok ? "passed" : "missing"}</span></li>
              ))}
            </ul>
            {a.platform && <p className="muted" style={{ margin: "10px 0 0" }}>Built on {a.platform}</p>}
          </section>

          <section className="card" aria-labelledby="h-ans">
            <h2 id="h-ans">What they told us</h2>
            <dl className="facts">
              {Object.entries(f).filter(([k, v]) => ANSWER_LABEL[k] && v !== "" && v != null && !(Array.isArray(v) && !v.length)).map(([k, v]) => (
                <div key={k} style={{ display: "contents" }}><dt>{ANSWER_LABEL[k]}</dt><dd>{k === "message" ? String(v) : pretty(v)}</dd></div>
              ))}
            </dl>
          </section>

          <section className="card" aria-labelledby="h-fix">
            <h2 id="h-fix">Correct the AI or hand it over</h2>
            <LeadActions id={lead.id} stage={lead.stage} verdict={lead.verdict} assignee={lead.assignee} reps={reps.map((r) => ({ name: r.name, email: r.email }))} section="fix" />
          </section>
        </div>
      </div>
    </>
  );
}
