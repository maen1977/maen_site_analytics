-- Cloudflare D1 schema for Maen website analytics + frequency cache
-- Safe to run more than once. If you already created the older table, run the ALTER lines too;
-- the Cloudflare Pages Functions also try to add missing columns automatically.

CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  local_date TEXT NOT NULL,
  local_hour TEXT,
  page TEXT,
  title TEXT,
  device TEXT,
  ua_device TEXT,
  lang TEXT,
  timezone TEXT,
  screen TEXT,
  referrer_host TEXT,
  visitor_hash TEXT,
  session_hash TEXT,
  ip_hash TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  continent TEXT,
  colo TEXT,
  cf_timezone TEXT
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_local_date ON analytics_events(local_date);
CREATE INDEX IF NOT EXISTS idx_analytics_events_visitor ON analytics_events(visitor_hash);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events(session_hash);

CREATE TABLE IF NOT EXISTS analytics_reports (
  key TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  generated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS frequency_cache (
  key TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Visitor reports submitted from the "آخر التحديثات" page.
CREATE TABLE IF NOT EXISTS visitor_reports (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  local_date TEXT NOT NULL,
  local_hour TEXT,
  type TEXT,
  title TEXT,
  details TEXT,
  contact_hash TEXT,
  page TEXT,
  referrer_host TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  status TEXT DEFAULT 'new'
);

CREATE INDEX IF NOT EXISTS idx_visitor_reports_local_date ON visitor_reports(local_date);
CREATE INDEX IF NOT EXISTS idx_visitor_reports_status ON visitor_reports(status);
