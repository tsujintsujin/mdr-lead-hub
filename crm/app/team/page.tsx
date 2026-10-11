import { roster } from "@/lib/n8n";
import { workload, SEGMENT_LABEL } from "@/lib/leads";

export default async function Team() {
  const reps = await roster();
  const open = workload();
  return (
    <>
      <div className="top">
        <div>
          <h1>Team</h1>
          <p className="sub" style={{ margin: "4px 0 0" }}>
            Read live from the Team tab of the Google Sheet. n8n uses it to route every lead, so changing who covers what is a spreadsheet edit, not a code change.
          </p>
        </div>
        {process.env.SHEET_URL && <a className="btn" href={process.env.SHEET_URL} target="_blank" rel="noreferrer">Edit the roster in Sheets</a>}
      </div>
      {!reps ? (
        <div className="card empty"><h2>Couldn’t read the roster</h2><p>n8n didn’t answer. Check that n8n is running and the “MDR · Roster” workflow is active.</p></div>
      ) : (
        <div className="team">
          {reps.map((r) => (
            <section key={r.name} className="card rep">
              <h3>{r.name}</h3>
              <p className="muted" style={{ margin: "2px 0 0" }}>{r.role}{r.active ? "" : ", not taking leads"}</p>
              <div className="tags">{r.covers.map((c) => <span key={c}>{c === "*" ? "Escalations" : SEGMENT_LABEL[c] || c}</span>)}</div>
              <p style={{ margin: 0 }}><strong>{open[r.name] || 0}</strong> open lead{open[r.name] === 1 ? "" : "s"}, posts to #{r.channel}</p>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
