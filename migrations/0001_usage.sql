CREATE TABLE IF NOT EXISTS daily_usage (
  usage_date TEXT PRIMARY KEY,
  review_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS device_usage (
  usage_date TEXT NOT NULL,
  device_id TEXT NOT NULL,
  review_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (usage_date, device_id)
);

CREATE INDEX IF NOT EXISTS idx_device_usage_date ON device_usage (usage_date);
