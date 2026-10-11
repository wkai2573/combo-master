import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { D1Like, D1Stmt } from '../server/src/d1';

/** 用 Node 內建的 SQLite 做出符合 D1 介面的外殼：真正執行 schema.sql 與 d1.ts 裡的 SQL */
export function sqliteD1(): D1Like {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../server/schema.sql', import.meta.url), 'utf8'));
  const stmt = (sql: string, params: unknown[] = []): D1Stmt => ({
    bind: (...values) => stmt(sql, values),
    run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...(params as never[])).changes) } }),
    all: async <T,>() => ({ results: db.prepare(sql).all(...(params as never[])) as T[] }),
    first: async <T,>() => (db.prepare(sql).get(...(params as never[])) as T | undefined) ?? null,
  });
  return { prepare: (sql) => stmt(sql) };
}
