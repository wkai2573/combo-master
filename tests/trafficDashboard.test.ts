import { describe, expect, it } from 'vitest';
import { renderDashboard } from '../scripts/trafficDashboard';
import { summarize, type EventRow } from '../scripts/trafficSummary';

const T = Date.UTC(2026, 9, 11, 0, 0, 0);
const MIN = 60_000;
const DAY = 24 * 60 * MIN;
let n = 0;
const visit = (device: string, at: number, stayMs = 0, version = '0.41.0'): EventRow => ({
  name: 'visit', visit_id: `v${++n}`, device_id: device, version, opponent: null, created_at: at, last_seen_at: at + stayMs, active_ms: stayMs,
});
const play = (name: 'start' | 'finish', device: string, at: number, opponent: 'cpu' | 'player' | 'tutorial' = 'cpu'): EventRow => ({
  name, visit_id: `p${++n}`, device_id: device, version: '0.41.0', opponent, created_at: at, last_seen_at: at, active_ms: 0,
});

const rows = [
  visit('a', T, 120_000), visit('b', T, 30_000), visit('a', T + DAY, 60_000), visit('c', T + DAY),
  play('start', 'a', T + MIN), play('finish', 'a', T + 5 * MIN), play('start', 'b', T + 2 * MIN, 'player'),
];
const html = renderDashboard(summarize(rows), new Date(Date.UTC(2026, 9, 12, 4, 0, 0)));

describe('流量儀表板', () => {
  it('是完整、可獨立開啟的網頁：不載入任何外部資源', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<title>');
    expect(html).not.toMatch(/(src|href)="https?:/);
    expect(html).not.toContain('<script');
  });

  it('標示產生時間（台北時間）', () => {
    expect(html).toContain('2026-10-12 12:00');
  });

  it('總覽的數字：造訪、裝置、玩過與玩完的比例', () => {
    expect(html).toContain('不重複裝置');
    expect(html).toMatch(/玩過[\s\S]*?67%/);
    expect(html).toMatch(/玩完[\s\S]*?33%/);
  });

  it('每日圖表每一天一根長條，滑鼠移上去看得到數字', () => {
    expect(html.match(/<rect class="bar-new"/g)).toHaveLength(2);
    expect(html).toContain('2026-10-11：新訪客 2、回訪 0');
    expect(html).toContain('2026-10-12：新訪客 1、回訪 1');
  });

  it('列出版本與對戰類型的表格', () => {
    expect(html).toContain('0.41.0');
    expect(html).toContain('對電腦');
    expect(html).toContain('對玩家');
  });

  it('沒有資料時說明還沒有資料，不會出現 NaN', () => {
    const empty = renderDashboard(summarize([]), new Date(Date.UTC(2026, 9, 12)));
    expect(empty).toContain('還沒有資料');
    expect(empty).not.toContain('NaN');
  });

  it('資料裡的文字會被跳脫，不會變成網頁標記', () => {
    const evil = summarize([{ ...visit('a', T), version: '<img src=x>' as string }]);
    expect(renderDashboard(evil, new Date(T))).not.toContain('<img src=x>');
  });
});

describe('流量儀表板：教學', () => {
  it('依對戰類型的表有「教學」一列', () => {
    const page = renderDashboard(summarize([...rows, play('start', 'c', T + MIN, 'tutorial'), play('finish', 'c', T + 2 * MIN, 'tutorial')]), new Date(Date.UTC(2026, 9, 12, 4, 0, 0)));
    // 教學一列：開始 1 場、打完 1 場、玩過 1 個裝置、玩完 1 個裝置；對電腦那一列不含教學
    const cells = (label: string) => [...(page.match(new RegExp(`<tr><td>${label}</td>((?:<td class="num">\\d+</td>){4})`))?.[1].matchAll(/>(\d+)</g) ?? [])].map((m) => Number(m[1]));
    expect(cells('教學')).toEqual([1, 1, 1, 1]);
    expect(cells('對電腦')).toEqual([1, 1, 1, 1]);
  });
});
