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

-- 流量事件（匿名）：造訪、開始對局、打完對局。只存匿名裝置代號、版本、對戰類型與時間，沒有任何個人資料。
-- 造訪每次載入頁面一列，心跳只更新那一列：last_seen_at 是最後一次心跳的時間，active_ms 是分頁在前景可見的累計時間，停留時間就是 active_ms。
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL CHECK (name IN ('visit', 'start', 'finish')),
  visit_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  version TEXT NOT NULL,
  -- 只有開始與打完對局才有：電腦、玩家或新手教學。已上線的資料庫要先執行 migrations 裡的遷移檔，才存得進教學
  opponent TEXT CHECK (opponent IN ('cpu', 'player', 'tutorial')),
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  active_ms INTEGER NOT NULL DEFAULT 0
);

-- 同一個造訪代號只會有一列造訪；開始與打完同一造訪可以有很多列
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_visit_once ON events (visit_id) WHERE name = 'visit';
CREATE INDEX IF NOT EXISTS idx_events_device_time ON events (device_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_time ON events (created_at);
