import { SEGMENT_LABEL, STAGE_LABEL, VERDICT_LABEL, type Stage, type Verdict } from "@/lib/leads";

export const VERDICT_COLOR: Record<string, string> = { hot: "var(--hot)", warm: "var(--warm)", talk: "var(--talk)", not_fit: "var(--not_fit)", spam: "var(--spam)" };

export function VerdictPill({ v }: { v: Verdict | null }) {
  if (!v) return <span className="muted">Not scored</span>;
  return <span className={`pill v-${v}`}>{VERDICT_LABEL[v]}</span>;
}
export function Score({ n }: { n: number | null }) {
  if (n == null) return <span className="muted">–</span>;
  return <span className="score"><i aria-hidden="true"><b style={{ width: `${n}%` }} /></i>{n}</span>;
}
export function StageTag({ s }: { s: Stage }) {
  return <span className="stage">{STAGE_LABEL[s]}</span>;
}
export const segmentLabel = (s: string | null) => (s ? SEGMENT_LABEL[s] || s : "–");

export function ago(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "yesterday" : `${d} days ago`;
}
export const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
