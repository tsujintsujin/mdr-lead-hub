"use client";
import { useOptimistic, useState, useTransition } from "react";
import { moveStage } from "../actions";
import { STAGES, STAGE_LABEL, VERDICT_LABEL, type Stage, type Verdict } from "@/lib/labels";

type Card = { id: string; business: string; verdict: Verdict | null; score: number | null; assignee: string | null; stage: Stage };
const EDGE: Record<string, string> = { hot: "var(--hot)", warm: "var(--warm)", talk: "var(--talk)", not_fit: "var(--not_fit)" };

export default function Board({ cards }: { cards: Card[] }) {
  const [list, move] = useOptimistic(cards, (state, m: { id: string; stage: Stage }) => state.map((c) => (c.id === m.id ? { ...c, stage: m.stage } : c)));
  const [, start] = useTransition();
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const [msg, setMsg] = useState("");

  function go(id: string, stage: Stage) {
    const c = list.find((x) => x.id === id);
    if (!c || c.stage === stage) return;
    start(async () => {
      move({ id, stage });
      const r = await moveStage(id, stage);
      setMsg(r.ok ? `${c.business} moved to ${STAGE_LABEL[stage]}.${r.synced === false ? " n8n didn’t answer, so the other tools weren’t updated." : ""}` : "That move didn’t save.");
    });
  }

  return (
    <>
      <p className="toast" role="status" style={{ marginTop: -6, marginBottom: 10, minHeight: 20 }}>{msg}</p>
      <div className="board">
        {STAGES.map((s) => {
          const col = list.filter((c) => c.stage === s);
          return (
            <section key={s} className="col" aria-label={STAGE_LABEL[s]} data-over={over === s ? "1" : "0"}
              onDragOver={(e) => { e.preventDefault(); setOver(s); }} onDragLeave={() => setOver(null)}
              onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData("text/plain"); if (id) go(id, s); }}>
              <h2><span>{STAGE_LABEL[s]}</span><span className="muted">{col.length}</span></h2>
              {col.map((c) => (
                <article key={c.id} className="bcard" draggable aria-grabbed={drag === c.id}
                  style={{ borderLeftColor: c.verdict ? EDGE[c.verdict] : undefined }}
                  onDragStart={(e) => { e.dataTransfer.setData("text/plain", c.id); setDrag(c.id); }} onDragEnd={() => setDrag(null)}>
                  <a href={`/leads/${c.id}`}>{c.business}</a>
                  <div className="row"><span>{c.verdict ? VERDICT_LABEL[c.verdict] : ""}{c.score != null ? `, ${c.score}` : ""}</span><span>{c.assignee?.split(" ")[0]}</span></div>
                  <div className="row">
                    <label className="muted" htmlFor={`m-${c.id}`}>Move to</label>
                    <select id={`m-${c.id}`} value={c.stage} onChange={(e) => go(c.id, e.target.value as Stage)}>
                      {STAGES.map((x) => <option key={x} value={x}>{STAGE_LABEL[x]}</option>)}
                    </select>
                  </div>
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}
