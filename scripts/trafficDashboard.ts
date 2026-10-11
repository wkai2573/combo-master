import type { Summary } from './trafficSummary';

const esc = (text: string | number) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
const duration = (seconds: number) => (seconds >= 60 ? `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒` : `${seconds} 秒`);
const OPPONENT_LABEL = { cpu: '對電腦', player: '對玩家' } as const;
/** 台北時間 YYYY-MM-DD HH:mm */
const taipei = (d: Date) => new Date(d.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16).replace('T', ' ');

const MAX_DAYS = 30;

/** 每日新訪客與回訪的堆疊長條圖：最近 30 天，由舊到新 */
function dailyChart(s: Summary): string {
  const days = s.byDay.slice(0, MAX_DAYS).reverse();
  const W = 720, H = 220, L = 36, R = 8, T = 12, B = 28;
  const peak = Math.max(1, ...days.map((d) => d.newDevices + d.returningDevices));
  const top = peak <= 4 ? 4 : Math.ceil(peak / 4) * 4;
  const slot = (W - L - R) / days.length;
  const bar = Math.min(28, slot * 0.7);
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const grid = [0, 1, 2, 3, 4]
    .map((i) => {
      const v = (top / 4) * i;
      return `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 6}" y="${y(v) + 4}" class="axis" text-anchor="end">${Math.round(v * 10) / 10}</text>`;
    })
    .join('');
  const bars = days
    .map((d, i) => {
      const x = L + slot * i + (slot - bar) / 2;
      const hNew = (H - T - B) * (d.newDevices / top);
      const hOld = (H - T - B) * (d.returningDevices / top);
      const tip = `${d.day}：新訪客 ${d.newDevices}、回訪 ${d.returningDevices}`;
      const label = i % Math.ceil(days.length / 8) === 0 ? `<text x="${x + bar / 2}" y="${H - 8}" class="axis" text-anchor="middle">${esc(d.day.slice(5))}</text>` : '';
      return `<g><rect class="bar-new" x="${x}" y="${y(0) - hNew}" width="${bar}" height="${hNew}" rx="2"><title>${esc(tip)}</title></rect>`
        + `<rect class="bar-old" x="${x}" y="${y(0) - hNew - hOld}" width="${bar}" height="${hOld}" rx="2"><title>${esc(tip)}</title></rect>${label}</g>`;
    })
    .join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="每日不重複裝置，分新訪客與回訪">${grid}${bars}</svg>`;
}

/** 進站、玩過、玩完的漏斗：以不重複裝置計 */
function funnel(s: Summary): string {
  const a = s.all;
  const rows = [
    { label: '進站', value: a.devices, share: 100 },
    { label: '玩過', value: a.playedDevices, share: pct(a.playedDevices, a.devices) },
    { label: '玩完', value: a.finishedDevices, share: pct(a.finishedDevices, a.devices) },
  ];
  return rows
    .map((r) => `<div class="funnel-row"><span class="funnel-label">${r.label}</span><div class="funnel-track"><div class="funnel-fill" style="width:${Math.min(100, r.share)}%"></div></div><span class="funnel-num">${r.value}（${r.share}%）</span></div>`)
    .join('');
}

const table = (head: string[], body: Array<Array<string | number>>) =>
  `<div class="scroll"><table><thead><tr>${head.map((h, i) => `<th${i ? ' class="num"' : ''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${body
    .map((row) => `<tr>${row.map((c, i) => `<td${i ? ' class="num"' : ''}>${esc(c)}</td>`).join('')}</tr>`)
    .join('')}</tbody></table></div>`;

/** 流量儀表板：一個不依賴任何外部資源的網頁，圖表是內嵌的 SVG，深淺色跟著系統 */
export function renderDashboard(s: Summary, generatedAt: Date): string {
  const a = s.all;
  const empty = a.visits === 0 && a.starts === 0;
  const tiles = [
    ['造訪次數', a.visits, '每次載入頁面算一次'],
    ['不重複裝置', a.devices, `${a.returnedDevices} 個在 2 天以上來過`],
    ['停留中位數', duration(a.medianStaySeconds), `平均 ${duration(a.avgStaySeconds)}`],
    ['玩過', `${pct(a.playedDevices, a.devices)}%`, `${a.playedDevices} 個裝置，共開始 ${a.starts} 場`],
    ['玩完', `${pct(a.finishedDevices, a.devices)}%`, `${a.finishedDevices} 個裝置，共打完 ${a.finishes} 場`],
  ]
    .map(([k, v, note]) => `<div class="tile"><div class="tile-k">${esc(k)}</div><div class="tile-v">${esc(v)}</div><div class="tile-n">${esc(note)}</div></div>`)
    .join('');

  const body = empty
    ? '<p class="empty">還沒有資料。遊戲上線並有人進站之後，這裡才會出現數字。</p>'
    : `<section class="tiles">${tiles}</section>
<section><h2>每日不重複裝置</h2><div class="legend"><span><i class="sw sw-new"></i>新訪客</span><span><i class="sw sw-old"></i>回訪</span></div>${dailyChart(s)}</section>
<section><h2>從進站到玩完</h2>${funnel(s)}</section>
<section><h2>依版本</h2>${table(['版本', '造訪', '裝置', '停留中位數', '玩過', '玩完'], s.byVersion.map((v) => [v.version, v.visits, v.devices, duration(v.medianStaySeconds), v.playedDevices, v.finishedDevices]))}</section>
<section><h2>依對戰類型</h2>${table(['類型', '開始場次', '打完場次', '玩過裝置', '玩完裝置'], s.byOpponent.map((o) => [OPPONENT_LABEL[o.opponent], o.starts, o.finishes, o.playedDevices, o.finishedDevices]))}</section>
<section><h2>每日明細</h2>${table(['日期', '造訪', '裝置', '新訪客', '回訪', '停留中位數', '玩過', '玩完'], s.byDay.map((d) => [d.day, d.visits, d.devices, d.newDevices, d.returningDevices, duration(d.medianStaySeconds), d.playedDevices, d.finishedDevices]))}</section>`;

  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>連擊大師流量</title>
<style>
:root { --bg: #f6f7f9; --panel: #fff; --text: #1b1f27; --muted: #5d6675; --line: #e2e5eb; --new: #2f6fe4; --old: #e49a1f; --fill: #2f6fe4; }
@media (prefers-color-scheme: dark) { :root { --bg: #14171d; --panel: #1d222b; --text: #e8ebf1; --muted: #9aa4b5; --line: #2e3542; --new: #6ea0ff; --old: #f0b84d; --fill: #6ea0ff; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.6 system-ui, "Microsoft JhengHei", sans-serif; }
main { max-width: 860px; margin: 0 auto; padding: 24px 16px 48px; }
h1 { font-size: 22px; margin: 0 0 4px; }
h2 { font-size: 16px; margin: 0 0 12px; }
.sub { color: var(--muted); font-size: 13px; margin: 0 0 20px; }
section { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 16px; margin-bottom: 16px; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; background: none; border: 0; padding: 0; }
.tile { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
.tile-k { color: var(--muted); font-size: 13px; }
.tile-v { font-size: 26px; font-weight: 700; line-height: 1.3; }
.tile-n { color: var(--muted); font-size: 12px; }
svg { width: 100%; height: auto; display: block; }
.grid { stroke: var(--line); stroke-width: 1; }
.axis { fill: var(--muted); font-size: 11px; }
.bar-new { fill: var(--new); }
.bar-old { fill: var(--old); }
.legend { display: flex; gap: 16px; color: var(--muted); font-size: 13px; margin-bottom: 8px; }
.sw { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; }
.sw-new { background: var(--new); }
.sw-old { background: var(--old); }
.funnel-row { display: grid; grid-template-columns: 48px 1fr 110px; align-items: center; gap: 10px; margin: 8px 0; }
.funnel-track { background: var(--line); border-radius: 6px; height: 14px; overflow: hidden; }
.funnel-fill { background: var(--fill); height: 100%; border-radius: 6px; }
.funnel-num { text-align: right; font-variant-numeric: tabular-nums; }
.scroll { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
th, td { padding: 6px 10px; border-bottom: 1px solid var(--line); text-align: left; white-space: nowrap; }
th { color: var(--muted); font-weight: 600; font-size: 13px; }
.num { text-align: right; }
.empty { color: var(--muted); }
</style>
</head>
<body>
<main>
<h1>連擊大師流量</h1>
<p class="sub">產生於 ${esc(taipei(generatedAt))}（台北時間）。人以匿名裝置代號去重；停留只算分頁在前景可見的時間，誤差約 30 秒。</p>
${body}
</main>
</body>
</html>
`;
}
