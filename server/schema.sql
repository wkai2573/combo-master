-- 全站戰績資料表（Cloudflare D1，SQLite 語法）
-- 只存戰績欄位；對局代號（match_id）有唯一限制，補傳同一場不會重複。
CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id TEXT NOT NULL UNIQUE,
  device_id TEXT NOT NULL,
  version TEXT NOT NULL,
  opponent TEXT NOT NULL CHECK (opponent IN ('cpu', 'player')),
  mine TEXT NOT NULL,
  theirs TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('win', 'lose', 'draw')),
  turns INTEGER NOT NULL CHECK (turns BETWEEN 1 AND 500),
  -- 記錄者是不是開局（第 1 回合）的先攻方：1 是、0 不是，沒有資料是 NULL
  opening_first INTEGER CHECK (opening_first IN (0, 1)),
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_records_device_time ON records (device_id, created_at);
CREATE INDEX IF NOT EXISTS idx_records_time ON records (created_at);
CREATE INDEX IF NOT EXISTS idx_records_version ON records (version, id);
