/**
 * 把遠端 D1 資料庫匯出成 SQLite 檔，可以用 Navicat 這類工具開來看。
 * 用法：bun run db:export            （遠端資料庫，要先 bunx wrangler@4 login）
 *       bun run db:export --local    （本機試跑用的資料庫）
 * 輸出：exports/combo-master.db（已列入 .gitignore）。檔案是匯出當下的快照，只拿來看，改了不會回寫到遠端。
 * 內容包含全部戰績與流量事件，不要放進版本控制或傳給別人。
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

const local = process.argv.includes('--local');
const dir = resolve('exports');
const sqlFile = resolve(dir, 'combo-master.sql');
const dbFile = resolve(dir, 'combo-master.db');
mkdirSync(dir, { recursive: true });

const result = spawnSync(
  'bunx',
  ['wrangler@4', 'd1', 'export', 'combo-master-records', local ? '--local' : '--remote', `--output=${sqlFile}`, '--config', 'server/wrangler.toml'],
  { encoding: 'utf8', shell: true, stdio: 'inherit' },
);
if (result.status !== 0) {
  console.error('匯出失敗。遠端要先登入（bunx wrangler@4 login）。');
  process.exit(1);
}

// 每次都從空檔重建，避免殘留上一次的資料
rmSync(dbFile, { force: true });
const db = new DatabaseSync(dbFile);
db.exec(readFileSync(sqlFile, 'utf8'));
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[];
for (const { name } of tables) {
  const n = (db.prepare(`SELECT COUNT(*) AS n FROM "${name}"`).get() as { n: number }).n;
  console.log(`${name}：${n} 筆`);
}
db.close();
rmSync(sqlFile, { force: true });
console.log(`已匯出：${dbFile}`);
