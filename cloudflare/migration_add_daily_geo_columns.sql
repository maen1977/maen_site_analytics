-- Run this only if you created the older D1 schema before this daily version.
-- D1/SQLite may show "duplicate column" if a column already exists; that is fine.
ALTER TABLE analytics_events ADD COLUMN ip_hash TEXT;
ALTER TABLE analytics_events ADD COLUMN country TEXT;
ALTER TABLE analytics_events ADD COLUMN region TEXT;
ALTER TABLE analytics_events ADD COLUMN city TEXT;
ALTER TABLE analytics_events ADD COLUMN continent TEXT;
ALTER TABLE analytics_events ADD COLUMN colo TEXT;
ALTER TABLE analytics_events ADD COLUMN cf_timezone TEXT;
