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
  db.prepare("INSERT INTO events (name, visit_id, device_id, version, opponent, created_at, last_seen_at) VALUES ('start', 'visit-0001', 'device-0001', '0.49.4', 'tutorial', 3000, 3000)").run();

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

// 第二個遷移：events 多一個可空的課程欄位。已上線的資料庫先跑 0001 再跑 0002
const lessonMigration = readFileSync(new URL('../server/migrations/0002-events-add-lesson.sql', import.meta.url), 'utf8');
const startLesson = (db: DatabaseSync, lesson: number) =>
  db.prepare("INSERT INTO events (name, visit_id, device_id, version, opponent, lesson, created_at, last_seen_at) VALUES ('start', 'visit-0001', 'device-0001', '0.50.1', 'tutorial', ?, 4000, 4000)").run(lesson);

describe('資料庫遷移：events 多一個課程欄位', () => {
  /** 已上線的資料庫：舊結構，加上一筆舊的教學事件，依序跑完 0001 */
  function migratedOnce() {
    const db = oldDb();
    db.exec(migration);
    startTutorial(db);
    return db;
  }

  it('遷移前沒有課程欄位', () => {
    expect(() => startLesson(migratedOnce(), 1)).toThrow();
  });

  it('遷移後存得進課程；既有的事件（含舊的教學事件）課程是空的，其他欄位不變', () => {
    const db = migratedOnce();
    db.exec(lessonMigration);
    startLesson(db, 2);
    const rows = db.prepare('SELECT name, opponent, lesson, created_at FROM events ORDER BY id').all();
    expect(rows).toEqual([
      { name: 'visit', opponent: null, lesson: null, created_at: 1000 },
      { name: 'start', opponent: 'cpu', lesson: null, created_at: 2000 },
      { name: 'start', opponent: 'tutorial', lesson: null, created_at: 3000 },
      { name: 'start', opponent: 'tutorial', lesson: 2, created_at: 4000 },
    ]);
  });

  it('遷移後索引與造訪代號的唯一限制還在', () => {
    const db = migratedOnce();
    db.exec(lessonMigration);
    expect(() => db.prepare("INSERT INTO events (name, visit_id, device_id, version, created_at, last_seen_at) VALUES ('visit', 'visit-0001', 'device-0009', '1.0.0', 1, 1)").run()).toThrow();
    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'events' AND name LIKE 'idx_%' ORDER BY name").all();
    expect(indexes.map((i) => i.name)).toEqual(['idx_events_device_time', 'idx_events_time', 'idx_events_visit_once']);
  });

  it('重複執行會報錯（欄位已存在），但資料一筆不少', () => {
    const db = migratedOnce();
    db.exec(lessonMigration);
    expect(() => db.exec(lessonMigration)).toThrow();
    expect(db.prepare('SELECT COUNT(*) AS n FROM events').get()).toEqual({ n: 3 });
  });

  it('順序顛倒（先 0002 再 0001）會丟掉課程欄位：所以兩個遷移要照編號執行', () => {
    const db = oldDb();
    db.exec(lessonMigration);
    db.exec(migration);
    expect(() => startLesson(db, 1)).toThrow();
  });

  it('新建的資料庫（schema.sql）一開始就有課程欄位，結構和依序遷移後一致', () => {
    const fresh = new DatabaseSync(':memory:');
    fresh.exec(readFileSync(new URL('../server/schema.sql', import.meta.url), 'utf8'));
    expect(() => startLesson(fresh, 1)).not.toThrow();
    const migrated = migratedOnce();
    migrated.exec(lessonMigration);
    const columns = (db: DatabaseSync) => db.prepare("SELECT name, type FROM pragma_table_info('events') ORDER BY name").all();
    expect(columns(fresh)).toEqual(columns(migrated));
  });
});
