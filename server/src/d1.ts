import type { Repo, StoredRecord } from './repo';

/** Cloudflare D1 的最小介面；真正的 D1 與測試用的 SQLite 外殼都符合它 */
export interface D1Stmt {
  bind(...values: unknown[]): D1Stmt;
  run(): Promise<{ meta: { changes: number } }>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}
export interface D1Like {
  prepare(sql: string): D1Stmt;
}

interface Row {
  id: number;
  version: string;
  opponent: 'cpu' | 'player';
  mine: string;
  theirs: string;
  outcome: 'win' | 'lose' | 'draw';
  turns: number;
  opening_first: number | null;
}

const toStored = (r: Row): StoredRecord => ({
  version: r.version, opponent: r.opponent, mine: r.mine, theirs: r.theirs, outcome: r.outcome, turns: r.turns,
  ...(r.opening_first !== null && { first: r.opening_first === 1 }),
});

export function d1Repo(db: D1Like): Repo {
  return {
    async insert(r, now) {
      const res = await db
        .prepare(
          'INSERT OR IGNORE INTO records (match_id, device_id, version, opponent, mine, theirs, outcome, turns, opening_first, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(r.matchId, r.deviceId, r.version, r.opponent, r.mine, r.theirs, r.outcome, r.turns, r.first === undefined ? null : r.first ? 1 : 0, now)
        .run();
      return res.meta.changes > 0 ? 'inserted' : 'duplicate';
    },
    async countByDevice(deviceId, since) {
      const row = await db.prepare('SELECT COUNT(*) AS n FROM records WHERE device_id = ? AND created_at >= ?').bind(deviceId, since).first<{ n: number }>();
      return row?.n ?? 0;
    },
    async countAll(since) {
      const row = await db.prepare('SELECT COUNT(*) AS n FROM records WHERE created_at >= ?').bind(since).first<{ n: number }>();
      return row?.n ?? 0;
    },
    async versions() {
      const res = await db.prepare('SELECT version, COUNT(*) AS games FROM records GROUP BY version').all<{ version: string; games: number }>();
      return res.results.map((r) => ({ version: r.version, games: r.games }));
    },
    async list(versions, after, limit) {
      const marks = versions.map(() => '?').join(', ');
      const res = await db
        .prepare(`SELECT id, version, opponent, mine, theirs, outcome, turns, opening_first FROM records WHERE version IN (${marks}) AND id > ? ORDER BY id ASC LIMIT ?`)
        .bind(...versions, after, limit + 1)
        .all<Row>();
      const rows = res.results;
      const page = rows.slice(0, limit);
      return { records: page.map(toStored), next: rows.length > limit ? page[page.length - 1].id : null };
    },
  };
}
