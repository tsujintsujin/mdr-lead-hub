"use client";
import { useState, useTransition } from "react";
import { addNote, moveStage, overrideVerdict, reassign } from "../../actions";
import { STAGES, STAGE_LABEL, VERDICTS, VERDICT_LABEL, type Stage, type Verdict } from "@/lib/labels";

type Props = { id: string; stage: Stage; verdict: Verdict | null; assignee: string | null; reps: { name: string; email: string }[]; section: "stage" | "fix" | "note" };

export default function LeadActions({ id, stage, verdict, assignee, reps, section }: Props) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [v, setV] = useState<Verdict | "">("");
  const [why, setWhy] = useState("");
  const [rep, setRep] = useState("");
  const [note, setNote] = useState("");
  const done = (r: { ok: boolean; synced?: boolean }, what: string) =>
    setMsg(!r.ok ? "Nothing changed." : r.synced === false ? `${what}. n8n didn’t answer, so Slack and Asana weren’t updated.` : `${what}. Slack, Asana and the Sheet are updating.`);

  if (section === "stage") {
    return (
      <div>
        <div className="stages" role="group" aria-label="Stage">
          {STAGES.map((s) => (
            <button key={s} type="button" aria-pressed={stage === s} disabled={pending}
              onClick={() => start(async () => done(await moveStage(id, s), `Moved to ${STAGE_LABEL[s]}`))}>
              {STAGE_LABEL[s]}
            </button>
          ))}
        </div>
        <p className="toast" role="status">{pending ? "Saving…" : msg}</p>
      </div>
    );
  }

  if (section === "note") {
    return (
      <form className="form-row" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await addNote(id, note); if (r.ok) setNote(""); }); }}>
        <label htmlFor="note" className="muted">Add a note to the timeline</label>
        <textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Left a voicemail, calling back Thursday" />
        <div><button className="btn" disabled={pending || !note.trim()}>Add note</button></div>
      </form>
    );
  }

  return (
    <div>
      <form className="form-row" onSubmit={(e) => { e.preventDefault(); if (!v) return; start(async () => { done(await overrideVerdict(id, v, why), `Verdict changed to ${VERDICT_LABEL[v]}`); setWhy(""); setV(""); }); }}>
        <label htmlFor="verdict">The AI said <strong>{verdict ? VERDICT_LABEL[verdict] : "nothing"}</strong>. It should be:</label>
        <select id="verdict" value={v} onChange={(e) => setV(e.target.value as Verdict)}>
          <option value="">Choose a verdict</option>
          {VERDICTS.filter((x) => x !== verdict).map((x) => <option key={x} value={x}>{VERDICT_LABEL[x]}</option>)}
        </select>
        <input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why? The model reads this next time." aria-label="Why" />
        <div><button className="btn btn-act" disabled={pending || !v}>Correct the verdict</button></div>
      </form>
      {reps.length > 0 && (
        <form className="form-row" style={{ marginTop: 18 }} onSubmit={(e) => { e.preventDefault(); const r = reps.find((x) => x.name === rep); if (!r) return; start(async () => { done(await reassign(id, r.name, r.email), `Handed to ${r.name}`); setRep(""); }); }}>
          <label htmlFor="rep">Owned by <strong>{assignee || "nobody"}</strong>. Hand it to:</label>
          <select id="rep" value={rep} onChange={(e) => setRep(e.target.value)}>
            <option value="">Choose a rep</option>
            {reps.filter((r) => r.name !== assignee).map((r) => <option key={r.name}>{r.name}</option>)}
          </select>
          <div><button className="btn" disabled={pending || !rep}>Reassign</button></div>
        </form>
      )}
      <p className="toast" role="status">{pending ? "Saving…" : msg}</p>
    </div>
  );
}
