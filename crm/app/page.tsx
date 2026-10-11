import { listLeads, STAGES, STAGE_LABEL, VERDICTS, VERDICT_LABEL, SEGMENT_LABEL } from "@/lib/leads";
import { db } from "@/lib/db";
import { VerdictPill, Score, StageTag, segmentLabel, ago, VERDICT_COLOR } from "./ui";

type SP = Promise<Record<string, string | undefined>>;

export default async function Leads({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const f = { verdict: sp.verdict, stage: sp.stage, segment: sp.segment, assignee: sp.assignee, q: sp.q };
  const leads = listLeads(f).filter((l) => !l.duplicate_of || sp.dupes === "1");
  const tally = db.prepare("SELECT verdict, COUNT(*) n FROM leads WHERE duplicate_of IS NULL AND verdict IS NOT NULL GROUP BY verdict").all() as { verdict: string; n: number }[];
  const total = tally.reduce((a, t) => a + Number(t.n), 0);
  const reps = db.prepare("SELECT DISTINCT assignee FROM leads WHERE assignee IS NOT NULL ORDER BY assignee").all() as { assignee: string }[];
  const link = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams(Object.entries({ ...f, ...patch }).filter(([, v]) => v) as [string, string][]);
    return q.toString() ? `/?${q}` : "/";
  };

  return (
    <>
      <div className="top">
        <div>
          <h1>Leads</h1>
          <p className="sub" style={{ margin: "4px 0 0" }}>Every form from both sites, scored by n8n and the local model, then routed to a rep.</p>
        </div>
      </div>

      {total > 0 && (
        <div className="triage" role="group" aria-label="Filter by verdict">
          {VERDICTS.map((v) => {
            const n = Number(tally.find((t) => t.verdict === v)?.n || 0);
            if (!n) return null;
            return (
              <a key={v} className={`t-${v}`} href={link({ verdict: f.verdict === v ? undefined : v })} data-on={f.verdict === v ? "1" : "0"}
                style={{ flexGrow: n }} aria-label={`${VERDICT_LABEL[v]}: ${n}`}>
                <b>{n}</b><span>{VERDICT_LABEL[v]}</span>
              </a>
            );
          })}
        </div>
      )}

      <form className="filters" action="/">
        <input type="search" name="q" placeholder="Search business, person, email or ID" defaultValue={f.q} aria-label="Search" />
        <select name="verdict" defaultValue={f.verdict || ""} aria-label="Verdict">
          <option value="">Any verdict</option>
          {VERDICTS.map((v) => <option key={v} value={v}>{VERDICT_LABEL[v]}</option>)}
        </select>
        <select name="stage" defaultValue={f.stage || ""} aria-label="Stage">
          <option value="">Any stage</option>
          {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
        </select>
        <select name="segment" defaultValue={f.segment || ""} aria-label="Segment">
          <option value="">Any segment</option>
          {Object.entries(SEGMENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="assignee" defaultValue={f.assignee || ""} aria-label="Rep">
          <option value="">Any rep</option>
          {reps.map((r) => <option key={r.assignee}>{r.assignee}</option>)}
        </select>
        <button className="btn" type="submit">Filter</button>
        {Object.values(f).some(Boolean) && <a className="linkish" href="/">Clear</a>}
      </form>

      <div className="table-wrap">
        {leads.length === 0 ? (
          <div className="empty">
            <h2>{total ? "Nothing matches these filters" : "No leads yet"}</h2>
            <p>{total ? "Clear a filter or two." : "Send a form from Practice Growth Check (localhost:8081) or Grant Ready (localhost:8082). It shows up here about a minute later."}</p>
          </div>
        ) : (
          <table className="leads">
            <thead>
              <tr>
                <th aria-label="Verdict colour" />
                <th>Business</th>
                <th>Verdict</th>
                <th className="hide-sm">Score</th>
                <th className="hide-sm">Segment</th>
                <th className="hide-sm">Rep</th>
                <th className="hide-sm">Stage</th>
                <th className="hide-sm">Source</th>
                <th className="hide-sm">Received</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td className="edge"><span style={{ background: l.verdict ? VERDICT_COLOR[l.verdict] : "var(--line)" }} /></td>
                  <td className="biz">
                    <a href={`/leads/${l.id}`}>{l.business}</a>
                    <small>{l.id}, {l.contact_name}{l.duplicate_of ? `, repeat of ${l.duplicate_of}` : ""}</small>
                  </td>
                  <td><VerdictPill v={l.verdict} /></td>
                  <td className="hide-sm"><Score n={l.score} /></td>
                  <td className="hide-sm">{segmentLabel(l.segment)}</td>
                  <td className="hide-sm nowrap">{l.assignee || <span className="muted">Nobody</span>}</td>
                  <td className="hide-sm"><StageTag s={l.stage} /></td>
                  <td className="hide-sm">{l.source}</td>
                  <td className="hide-sm nowrap muted" title={l.created_at}>{ago(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
