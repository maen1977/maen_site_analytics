-- Optional safety migration. The Worker also creates these tables automatically.
CREATE TABLE IF NOT EXISTS frequency_cache (
  key TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cloudflare_cron_status (
  key TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
