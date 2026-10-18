import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

// 已上線的資料庫是舊結構：events.opponent 的限制只允許電腦與玩家，SQLite 不能直接改限制，
// 所以要用遷移檔重建資料表。這裡用舊結構建庫，確認遷移後舊資料都在、能存教學，而且可以重複執行
const OLD_EVENTS = `
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL CHECK (name IN ('visit', 'start', 'finish')),
  visit_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  version TEXT NOT NULL,
  opponent TEXT CHECK (opponent IN ('cpu', 'player')),
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  active_ms INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX idx_events_visit_once ON events (visit_id) WHERE name = 'visit';
CREATE INDEX idx_events_device_time ON events (device_id, created_at);
CREATE INDEX idx_events_time ON events (created_at);
`;
const migration = readFileSync(new URL('../server/migrations/0001-events-allow-tutorial.sql', import.meta.url), 'utf8');

function oldDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(OLD_EVENTS);
  const ins = db.prepare('INSERT INTO events (name, visit_id, device_id, version, opponent, created_at, last_seen_at, active_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  ins.run('visit', 'visit-0001', 'device-0001', '0.41.0', null, 1000, 5000, 4000);
  ins.run('start', 'visit-0001', 'device-0001', '0.41.0', 'cpu', 2000, 2000, 0);
  return db;
}
const startTutorial = (db: DatabaseSync) =>
  db.prepare("INSERT INTO events (name, visit_id, device_id, version, opponent, created_at, last_seen_at) VALUES ('start', 'visit-0001', 'device-0001', '0.48.4', 'tutorial', 3000, 3000)").run();

describe('資料庫遷移：events 允許教學', () => {
  it('遷移前存不進教學（舊結構的限制）', () => {
    expect(() => startTutorial(oldDb())).toThrow();
  });

  it('遷移後存得進教學，舊資料一筆不少、內容不變', () => {
    const db = oldDb();
    db.exec(migration);
    startTutorial(db);
    const rows = db.prepare('SELECT name, visit_id, opponent, created_at, last_seen_at, active_ms FROM events ORDER BY id').all();
    expect(rows).toEqual([
      { name: 'visit', visit_id: 'visit-0001', opponent: null, created_at: 1000, last_seen_at: 5000, active_ms: 4000 },
      { name: 'start', visit_id: 'visit-0001', opponent: 'cpu', created_at: 2000, last_seen_at: 2000, active_ms: 0 },
      { name: 'start', visit_id: 'visit-0001', opponent: 'tutorial', created_at: 3000, last_seen_at: 3000, active_ms: 0 },
    ]);
  });

  it('仍然擋掉不認得的對戰類型，造訪代號的唯一限制與索引還在', () => {
    const db = oldDb();
    db.exec(migration);
    expect(() => db.prepare("INSERT INTO events (name, visit_id, device_id, version, opponent, created_at, last_seen_at) VALUES ('start', 'v', 'd', '1.0.0', 'robot', 1, 1)").run()).toThrow();
    expect(() => db.prepare("INSERT INTO events (name, visit_id, device_id, version, created_at, last_seen_at) VALUES ('visit', 'visit-0001', 'device-0009', '1.0.0', 1, 1)").run()).toThrow();
    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'events' AND name LIKE 'idx_%' ORDER BY name").all();
    expect(indexes.map((i) => i.name)).toEqual(['idx_events_device_time', 'idx_events_time', 'idx_events_visit_once']);
  });

  it('可以重複執行，資料不會多也不會少', () => {
    const db = oldDb();
    db.exec(migration);
    db.exec(migration);
    expect(db.prepare('SELECT COUNT(*) AS n FROM events').get()).toEqual({ n: 2 });
  });

  it('中途失敗（舊表已刪、還沒改名）後重跑：不會把已經搬好的資料清掉', () => {
    const db = oldDb();
    db.exec(migration);
    // 模擬上一次跑到一半：搬好的資料在 events_new，events 已經不在
    db.exec('ALTER TABLE events RENAME TO events_new');
    expect(() => db.exec(migration)).toThrow();
    expect(db.prepare('SELECT COUNT(*) AS n FROM events_new').get()).toEqual({ n: 2 });
  });

  it('新建的資料庫（schema.sql）一開始就允許教學', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(readFileSync(new URL('../server/schema.sql', import.meta.url), 'utf8'));
    expect(() => startTutorial(db)).not.toThrow();
  });
});
