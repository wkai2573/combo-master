/**
 * 匿名流量統計：用 wrangler 讀遠端 D1 的 events 資料表，產生儀表板網頁並用瀏覽器開啟。
 * 用法：bun run stats            （遠端資料庫，要先 bunx wrangler@4 login）
 *       bun run stats --local    （本機試跑用的資料庫）
 *       bun run stats --text     （不產生網頁，改在終端機印文字摘要）
 * 儀表板存成專案根目錄的 traffic-report.html（已列入 .gitignore，不會進版本控制）。
 * 沒有任何對外讀取的路徑：資料只有站長能用自己的 Cloudflare 帳號讀。
 */
import { exec, spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderDashboard } from './trafficDashboard';
import { formatReport, summarize, type EventRow } from './trafficSummary';

const local = process.argv.includes('--local');
const text = process.argv.includes('--text');
const sql = 'SELECT name, visit_id, device_id, version, opponent, lesson, created_at, last_seen_at, active_ms FROM events ORDER BY id';

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
const summary = summarize(parsed[0]?.results ?? []);

if (text) {
  console.log(formatReport(summary));
} else {
  const file = resolve('traffic-report.html');
  writeFileSync(file, renderDashboard(summary, new Date()));
  console.log(`儀表板已產生：${file}`);
  const open = process.platform === 'win32' ? `start "" "${file}"` : process.platform === 'darwin' ? `open "${file}"` : `xdg-open "${file}"`;
  exec(open, (error) => {
    if (error) console.error('無法自動開啟瀏覽器，請自行開啟上面的檔案。');
  });
}
