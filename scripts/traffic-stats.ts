/**
 * 匿名流量統計：用 wrangler 讀遠端 D1 的 events 資料表，在終端機印摘要。
 * 用法：bun run stats            （遠端資料庫，要先 bunx wrangler@4 login）
 *       bun run stats --local （本機試跑用的資料庫）
 * 沒有任何對外讀取的路徑：資料只有站長能用自己的 Cloudflare 帳號讀。
 */
import { spawnSync } from 'node:child_process';
import { formatReport, summarize, type EventRow } from './trafficSummary';

const local = process.argv.includes('--local');
const sql = 'SELECT name, visit_id, device_id, version, opponent, created_at, last_seen_at, active_ms FROM events ORDER BY id';

const result = spawnSync(
  'bunx',
  ['wrangler@4', 'd1', 'execute', 'combo-master-records', local ? '--local' : '--remote', '--json', '--config', 'server/wrangler.toml', '--command', `"${sql}"`],
  { encoding: 'utf8', shell: true, maxBuffer: 256 * 1024 * 1024 },
);
if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  console.error('讀取失敗。遠端要先登入（bunx wrangler@4 login），而且要先建立資料表（bun run server:db）。');
  process.exit(1);
}

// wrangler 可能在 JSON 前面印提示文字：JSON 從行首的 [ 開始
const start = result.stdout.search(/^\[/m);
const parsed = JSON.parse(result.stdout.slice(start)) as Array<{ results?: EventRow[] }>;
console.log(formatReport(summarize(parsed[0]?.results ?? [])));
