-- 遷移：流量事件 events 的對戰類型（opponent）多一個「tutorial」（新手教學）。
-- SQLite 不能直接改欄位的限制，所以重建資料表並搬資料；舊資料一筆不少。
-- 已上線的資料庫先執行這個檔（bun run server:db:migrate），再部署伺服器；新建的資料庫用 schema.sql 就已經包含。
-- 重複執行是安全的：搬資料用 INSERT OR IGNORE，新表不會先被清掉。如果中途失敗（舊表已刪、還沒改名），
-- 資料還在 events_new，這時不要重跑，先用 wrangler d1 execute 查兩張表，再把 events_new 改名成 events 並補上下面的索引。
-- 注意：0002 之後不要再跑這個檔。它重建 events 時只搬自己認得的欄位，會把 0002 加的 lesson 欄位連資料一起丟掉。
-- 已經跑過 0002 的資料庫，要補遷移請只跑新的檔。
-- 搬資料到換表之間（毫秒內）舊伺服器寫進來的事件會漏掉，所以選流量低的時候執行。
CREATE TABLE IF NOT EXISTS events_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL CHECK (name IN ('visit', 'start', 'finish')),
  visit_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  version TEXT NOT NULL,
  opponent TEXT CHECK (opponent IN ('cpu', 'player', 'tutorial')),
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  active_ms INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO events_new (id, name, visit_id, device_id, version, opponent, created_at, last_seen_at, active_ms)
  SELECT id, name, visit_id, device_id, version, opponent, created_at, last_seen_at, active_ms FROM events;

DROP TABLE events;
ALTER TABLE events_new RENAME TO events;

CREATE UNIQUE INDEX IF NOT EXISTS idx_events_visit_once ON events (visit_id) WHERE name = 'visit';
CREATE INDEX IF NOT EXISTS idx_events_device_time ON events (device_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_time ON events (created_at);
