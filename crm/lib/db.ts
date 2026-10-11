// The CRM's database: one SQLite file (Node's built-in node:sqlite, no extra dependency).
// n8n writes leads in through the API; people work them through the screens.
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

const file = process.env.CRM_DB_PATH || path.join(process.cwd(), "data", "crm.db");
fs.mkdirSync(path.dirname(file), { recursive: true });

const g = globalThis as unknown as { __crmDb?: DatabaseSync };
export const db: DatabaseSync = g.__crmDb ?? new DatabaseSync(file);
g.__crmDb = db;

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS leads (
  id              TEXT PRIMARY KEY,           -- MDR-1001
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  site            TEXT NOT NULL,              -- site-a | site-b
  variant         TEXT NOT NULL,              -- practice | grant
  token           TEXT,                       -- WordPress submission token
  business        TEXT NOT NULL,
  contact_name    TEXT,
  email           TEXT,
  phone           TEXT,
  website         TEXT,
  location        TEXT,                       -- ZIP or state
  segment         TEXT,                       -- healthcare_wellness, nonprofit, ...
  size            TEXT,
  interest        TEXT,                       -- JSON array of services wanted
  fields          TEXT,                       -- JSON: everything the form sent
  tracking        TEXT,                       -- JSON: utm, gclid, referrer...
  source          TEXT,                       -- Google Ads, Organic search, ...
  audit           TEXT,                       -- JSON: speed, SEO checks, IRS lookup
  ai              TEXT,                       -- JSON: summary, reasons, opening line, confidence
  score           INTEGER,
  verdict         TEXT,                       -- hot | warm | talk | not_fit | spam
  verdict_by      TEXT,                       -- rules | ai | person
  assignee        TEXT,
  assignee_email  TEXT,
  stage           TEXT NOT NULL DEFAULT 'new',-- new | contacted | booked | won | lost
  slack_channel   TEXT,
  slack_ts        TEXT,
  asana_task_gid  TEXT,
  asana_project_gid TEXT,
  first_contact_at TEXT,
  escalated_at    TEXT,
  duplicate_of    TEXT
);
CREATE INDEX IF NOT EXISTS leads_created ON leads(created_at);
CREATE INDEX IF NOT EXISTS leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS leads_asana ON leads(asana_task_gid);

CREATE TABLE IF NOT EXISTS events (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id  TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  at       TEXT NOT NULL,
  type     TEXT NOT NULL,                     -- received, scored, routed, slack, asana, email, stage, override, ...
  actor    TEXT NOT NULL,                     -- n8n, Slack: Ana Reyes, CRM: Marcus Hale, ...
  detail   TEXT                               -- JSON
);
CREATE INDEX IF NOT EXISTS events_lead ON events(lead_id, at);

-- Verdicts a person corrected. n8n feeds the latest ones to the model as examples.
CREATE TABLE IF NOT EXISTS corrections (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id       TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  at            TEXT NOT NULL,
  from_verdict  TEXT NOT NULL,
  to_verdict    TEXT NOT NULL,
  note          TEXT,
  by            TEXT
);
`);

export const now = () => new Date().toISOString();

export function nextLeadId(): string {
  const row = db.prepare("SELECT id FROM leads ORDER BY CAST(substr(id, 5) AS INTEGER) DESC LIMIT 1").get() as { id?: string } | undefined;
  const n = row?.id ? parseInt(row.id.slice(4), 10) + 1 : 1001;
  return `MDR-${n}`;
}
