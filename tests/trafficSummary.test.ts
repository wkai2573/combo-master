import { describe, expect, it } from 'vitest';
import { formatReport, summarize, type EventRow } from '../scripts/trafficSummary';

// 時間用台北時間的日子來看：2026-10-11 08:00 台北 = 00:00 UTC
const T = Date.UTC(2026, 9, 11, 0, 0, 0);
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

let n = 0;
const visit = (device: string, at: number, stayMs = 0, version = '0.41.0'): EventRow => ({
  name: 'visit', visit_id: `v${++n}`, device_id: device, version, opponent: null, created_at: at, last_seen_at: at + stayMs, active_ms: stayMs,
});
const play = (name: 'start' | 'finish', device: string, at: number, opponent: 'cpu' | 'player' = 'cpu', version = '0.41.0'): EventRow => ({
  name, visit_id: `p${++n}`, device_id: device, version, opponent, created_at: at, last_seen_at: at, active_ms: 0,
});

describe('流量摘要：總覽', () => {
  const rows: EventRow[] = [
    visit('a', T, 120_000), // 停留 2 分鐘
    visit('a', T + 10 * MIN, 0), // 同一個人再來一次
    visit('b', T + MIN, 60_000), // 停留 1 分鐘
    visit('c', T + 2 * MIN, 0),
    play('start', 'a', T + MIN),
    play('finish', 'a', T + 5 * MIN),
    play('start', 'b', T + 2 * MIN),
  ];
  const { all } = summarize(rows);

  it('造訪次數與不重複裝置數分開算', () => {
    expect(all.visits).toBe(4);
    expect(all.devices).toBe(3);
  });

  it('停留時間用造訪回報的可見時間，平均與中位數都以秒計', () => {
    // 120、0、60、0 秒
    expect(all.avgStaySeconds).toBe(45);
    expect(all.medianStaySeconds).toBe(30);
  });

  it('玩過與玩完以裝置計，開始與打完以場次計', () => {
    expect(all.playedDevices).toBe(2);
    expect(all.finishedDevices).toBe(1);
    expect(all.starts).toBe(2);
    expect(all.finishes).toBe(1);
  });

  it('停留時間不看最後活動時間：切走分頁掛很久的造訪只算可見的部分', () => {
    const idle: EventRow = { ...visit('z', T), last_seen_at: T + 2 * 60 * 60 * 1000, active_ms: 40_000 };
    expect(summarize([idle]).all.avgStaySeconds).toBe(40);
  });

  it('有開始對局但造訪沒記到的裝置（造訪被限流）也算一個人，玩過比例不會超過 100%', () => {
    const { all } = summarize([play('start', 'ghost', T), play('finish', 'ghost', T + MIN)]);
    expect(all.devices).toBe(1);
    expect(all.playedDevices).toBe(1);
  });

  it('跨過午夜才開打：開打那天的裝置數也算到那個人', () => {
    const s = summarize([visit('a', T + 15 * 60 * MIN), play('start', 'a', T + 17 * 60 * MIN)]);
    const day2 = s.byDay.find((d) => d.day === '2026-10-12')!;
    expect(day2.devices).toBe(1);
    expect(day2.playedDevices).toBe(1);
  });

  it('沒有任何資料時各項是 0，不會算出 NaN', () => {
    const empty = summarize([]).all;
    expect(empty).toMatchObject({ visits: 0, devices: 0, avgStaySeconds: 0, medianStaySeconds: 0, playedDevices: 0, finishedDevices: 0 });
  });
});

describe('流量摘要：新訪客與回訪', () => {
  const rows: EventRow[] = [
    visit('a', T), visit('b', T),
    visit('a', T + DAY), visit('c', T + DAY),
    visit('a', T + 2 * DAY),
  ];
  const s = summarize(rows);

  it('依台北時間的日子分組，新到舊排列', () => {
    expect(s.byDay.map((d) => d.day)).toEqual(['2026-10-13', '2026-10-12', '2026-10-11']);
  });

  it('某天裝置第一次出現算新訪客，之前來過算回訪', () => {
    const byDay = Object.fromEntries(s.byDay.map((d) => [d.day, [d.newDevices, d.returningDevices]]));
    expect(byDay).toEqual({ '2026-10-11': [2, 0], '2026-10-12': [1, 1], '2026-10-13': [0, 1] });
  });

  it('總覽的回訪是在 2 個以上不同日子來過的裝置', () => {
    expect(s.all.returnedDevices).toBe(1);
  });

  it('日子的分界在台北時間午夜（UTC 16:00）', () => {
    const late = summarize([visit('a', Date.UTC(2026, 9, 11, 15, 59)), visit('b', Date.UTC(2026, 9, 11, 16, 0))]);
    expect(late.byDay.map((d) => d.day).sort()).toEqual(['2026-10-11', '2026-10-12']);
  });
});

describe('流量摘要：拆分', () => {
  const rows: EventRow[] = [
    visit('a', T, 0, '0.40.0'), visit('b', T, 60_000, '0.41.0'),
    play('start', 'a', T, 'cpu', '0.40.0'), play('start', 'b', T, 'player', '0.41.0'), play('finish', 'b', T + MIN, 'player', '0.41.0'),
  ];
  const s = summarize(rows);

  it('依版本拆分，新版本在前', () => {
    expect(s.byVersion.map((v) => [v.version, v.devices, v.playedDevices, v.finishedDevices])).toEqual([['0.41.0', 1, 1, 1], ['0.40.0', 1, 1, 0]]);
  });

  it('依對戰類型拆分開始與打完的場次與裝置', () => {
    const byOpp = Object.fromEntries(s.byOpponent.map((o) => [o.opponent, [o.starts, o.finishes, o.playedDevices, o.finishedDevices]]));
    expect(byOpp).toEqual({ cpu: [1, 0, 1, 0], player: [1, 1, 1, 1] });
  });
});

describe('流量摘要：文字報告', () => {
  it('列出總覽、玩過與玩完的比例', () => {
    const text = formatReport(summarize([visit('a', T, 90_000), visit('b', T), play('start', 'a', T), play('finish', 'a', T + MIN)]));
    expect(text).toContain('不重複裝置　2');
    expect(text).toContain('玩過　1（50%）');
    expect(text).toContain('玩完　1（50%）');
    expect(text).toContain('2026-10-11');
  });

  it('沒有資料時說明還沒有資料', () => {
    expect(formatReport(summarize([]))).toContain('還沒有資料');
  });
});
