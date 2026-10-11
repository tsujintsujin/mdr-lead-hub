import { listLeads } from "@/lib/leads";
import Board from "./board";

export default async function Pipeline() {
  const leads = listLeads({ limit: 1000 }).filter((l) => !l.duplicate_of && l.verdict !== "spam");
  return (
    <>
      <div className="top">
        <div>
          <h1>Pipeline</h1>
          <p className="sub" style={{ margin: "4px 0 0" }}>Drag a card to move it. Slack, Asana and the Sheet follow along.</p>
        </div>
      </div>
      <Board cards={leads.map((l) => ({ id: l.id, business: l.business, verdict: l.verdict, score: l.score, assignee: l.assignee, stage: l.stage }))} />
    </>
  );
}
