import { stats, VERDICT_LABEL, STAGE_LABEL, SEGMENT_LABEL } from "@/lib/leads";

function Bars({ rows, labels }: { rows: Record<string, string | number>[]; labels?: Record<string, string> }) {
  const max = Math.max(1, ...rows.map((r) => Number(r.n)));
  if (!rows.length) return <p className="muted">No data yet.</p>;
  return (
    <div className="bars">
      {rows.map((r) => {
        const k = String(r.k ?? "none");
        return (
          <div className="bar" key={k}>
            <span>{labels?.[k] || (k === "null" || k === "none" ? "Unassigned" : k)}</span>
            <i aria-hidden="true"><b style={{ width: `${(Number(r.n) / max) * 100}%` }} /></i>
            <span>{r.n}</span>
          </div>
        );
      })}
    </div>
  );
}

export default async function Reports({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const days = Number((await searchParams).days || 30);
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const s = stats(since);
  const fit = s.byVerdict.filter((r) => ["hot", "warm", "talk"].includes(String(r.k))).reduce((a, r) => a + Number(r.n), 0);
  return (
    <>
      <div className="top">
        <div>
          <h1>Reports</h1>
          <p className="sub" style={{ margin: "4px 0 0" }}>The last {days} days. These are the numbers an agency sends its clients and its own sales manager.</p>
        </div>
        <form className="filters" style={{ margin: 0 }}>
          <select name="days" defaultValue={String(days)} aria-label="Period">
            <option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option>
          </select>
          <button className="btn">Show</button>
        </form>
      </div>
      <div className="kpis">
        <div className="kpi"><b>{s.total}</b><span>leads in</span></div>
        <div className="kpi"><b>{fit}</b><span>worth a rep’s time</span></div>
        <div className="kpi"><b>{s.medianHoursToContact == null ? "–" : s.medianHoursToContact < 1 ? `${Math.round(s.medianHoursToContact * 60)} min` : `${s.medianHoursToContact.toFixed(1)} h`}</b><span>median time to first contact</span></div>
        <div className="kpi"><b>{s.scored ? Math.round((s.corrected / s.scored) * 100) : 0}%</b><span>verdicts a person corrected</span></div>
      </div>
      <div className="grid3">
        <section className="card"><h2>Where leads came from</h2><Bars rows={s.bySource} /></section>
        <section className="card"><h2>Verdicts</h2><Bars rows={s.byVerdict} labels={VERDICT_LABEL} /></section>
        <section className="card"><h2>Kind of business</h2><Bars rows={s.bySegment} labels={SEGMENT_LABEL} /></section>
        <section className="card"><h2>Stage</h2><Bars rows={s.byStage} labels={STAGE_LABEL} /></section>
        <section className="card"><h2>By rep</h2><Bars rows={s.byAssignee} /></section>
        <section className="card"><h2>By site</h2><Bars rows={s.bySite} labels={{ "site-a": "Practice Growth Check", "site-b": "Grant Ready" }} /></section>
      </div>
      {s.stale > 0 && <p className="flags" style={{ marginTop: 16 }}>{s.stale} lead{s.stale === 1 ? " is" : "s are"} still waiting on a first contact after 24 hours.</p>}
    </>
  );
}
