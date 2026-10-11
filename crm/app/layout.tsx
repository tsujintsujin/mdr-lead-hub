import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import Nav from "./nav";
import MeSwitch from "./me-switch";
import { db } from "@/lib/db";

const ui = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-ui", weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = { title: "MDR Lead Hub", description: "Leads from MDR's sites, scored and routed by n8n." };
export const dynamic = "force-dynamic";

const PEOPLE = ["Marcus Hale", "Ana Reyes", "Ben Kowalski", "Carla Jimenez", "Dana Price"];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = (await cookies()).get("mdr_me")?.value || "Marcus Hale";
  const counts = db.prepare("SELECT COUNT(*) total, SUM(stage IN ('new','contacted','booked')) open FROM leads WHERE duplicate_of IS NULL").get() as { total: number; open: number };
  const sheet = process.env.SHEET_URL;
  const asana = process.env.ASANA_PROJECT ? `https://app.asana.com/0/${process.env.ASANA_PROJECT}/board` : null;
  const slack = process.env.SLACK_TEAM_ID ? `https://app.slack.com/client/${process.env.SLACK_TEAM_ID}` : null;
  return (
    <html lang="en">
      <body className={ui.variable}>
        <div className="shell">
          <aside className="side">
            <a className="brand" href="/">MDR Lead Hub<small>Marketing Done Right</small></a>
            <Nav open={Number(counts.open || 0)} total={Number(counts.total || 0)} />
            <div className="tools">
              {sheet && <a href={sheet} target="_blank" rel="noreferrer">Google Sheet</a>}
              {slack && <a href={slack} target="_blank" rel="noreferrer">Slack</a>}
              {asana && <a href={asana} target="_blank" rel="noreferrer">Asana board</a>}
              <a href="http://localhost:5678" target="_blank" rel="noreferrer">n8n workflows</a>
            </div>
            <div className="me">You are<MeSwitch me={me} people={PEOPLE} /></div>
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
