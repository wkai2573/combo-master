import { describe, expect, it } from 'vitest';
import { applyTrackParam, createAnalytics, createEventSender, isTrackingOff, type AnalyticsEvent } from '../src/stats/analytics';

function setup(over: { visible?: boolean; off?: boolean } = {}) {
  const sent: AnalyticsEvent[] = [];
  const state = { visible: over.visible ?? true, off: over.off ?? false, now: 1_000_000 };
  let n = 0;
  const analytics = createAnalytics({
    send: (e) => sent.push(e),
    deviceId: () => 'device-0001',
    newId: () => `visit-000${++n}`,
    version: '0.41.0',
    visible: () => state.visible,
    now: () => state.now,
    optedOut: () => state.off,
  });
  return { analytics, sent, state };
}

describe('流量統計：造訪與心跳', () => {
  it('造訪送出一筆事件，帶裝置代號、版本與這次造訪的代號', () => {
    const { analytics, sent } = setup();
    analytics.visit();
    expect(sent).toEqual([{ name: 'visit', visitId: 'visit-0001', deviceId: 'device-0001', version: '0.41.0' }]);
  });

  it('同一次頁面載入重複呼叫造訪只送一次', () => {
    const { analytics, sent } = setup();
    analytics.visit();
    analytics.visit();
    expect(sent).toHaveLength(1);
  });

  it('心跳帶同一個造訪代號與到目前為止分頁可見的累計毫秒數', () => {
    const { analytics, sent, state } = setup();
    analytics.visit();
    state.now += 30_000;
    analytics.heartbeat();
    expect(sent[1]).toEqual({ name: 'beat', visitId: 'visit-0001', deviceId: 'device-0001', version: '0.41.0', activeMs: 30_000 });
  });

  it('分頁不可見時的定時心跳不送，所以掛機不會拉長停留時間', () => {
    const { analytics, sent, state } = setup();
    analytics.visit();
    state.visible = false;
    state.now += 30_000;
    analytics.heartbeat();
    expect(sent).toHaveLength(1);
  });

  it('分頁被切走的當下補送一次心跳，把最後的可見時間算進去', () => {
    const { analytics, sent, state } = setup();
    analytics.visit();
    state.now += 12_000;
    state.visible = false;
    analytics.hidden();
    expect(sent.map((e) => e.name)).toEqual(['visit', 'beat']);
    expect(sent[1].activeMs).toBe(12_000);
  });

  it('切走的那段時間不算：回到前景後的心跳只加上回來之後的時間', () => {
    const { analytics, sent, state } = setup();
    analytics.visit();
    state.now += 20_000;
    state.visible = false;
    analytics.hidden();
    state.now += 2 * 60 * 60 * 1000; // 掛在背景 2 小時
    state.visible = true;
    analytics.shown();
    state.now += 10_000;
    analytics.heartbeat();
    expect(sent.at(-1)!.activeMs).toBe(30_000);
  });

  it('從背景開啟的分頁：一開始不算可見，回到前景才開始累計', () => {
    const { analytics, sent, state } = setup({ visible: false });
    analytics.visit();
    state.now += 60_000;
    state.visible = true;
    analytics.shown();
    state.now += 5_000;
    analytics.heartbeat();
    expect(sent.at(-1)!.activeMs).toBe(5_000);
  });

  it('還沒有造訪就不會送心跳', () => {
    const { analytics, sent } = setup();
    analytics.heartbeat();
    analytics.hidden();
    expect(sent).toEqual([]);
  });
});

describe('流量統計：開始與打完對局', () => {
  it('帶對戰類型與同一個造訪代號', () => {
    const { analytics, sent } = setup();
    analytics.visit();
    analytics.play('start', 'cpu');
    analytics.play('finish', 'cpu');
    expect(sent.slice(1)).toEqual([
      { name: 'start', visitId: 'visit-0001', deviceId: 'device-0001', version: '0.41.0', opponent: 'cpu' },
      { name: 'finish', visitId: 'visit-0001', deviceId: 'device-0001', version: '0.41.0', opponent: 'cpu' },
    ]);
  });

  it('教學也是一種對戰類型', () => {
    const { analytics, sent } = setup();
    analytics.visit();
    analytics.play('start', 'tutorial');
    analytics.play('finish', 'tutorial');
    expect(sent.slice(1).map((e) => [e.name, e.opponent])).toEqual([['start', 'tutorial'], ['finish', 'tutorial']]);
  });

  it('頁面還沒登記造訪就開打：先補一筆造訪，對局事件不會沒有對應的造訪', () => {
    const { analytics, sent } = setup();
    analytics.play('start', 'player');
    expect(sent.map((e) => e.name)).toEqual(['visit', 'start']);
    expect(sent[1].visitId).toBe(sent[0].visitId);
  });
});

describe('流量統計：排除自己', () => {
  it('關閉統計時什麼都不送', () => {
    const { analytics, sent } = setup({ off: true });
    analytics.visit();
    analytics.heartbeat();
    analytics.hidden();
    analytics.play('start', 'cpu');
    expect(sent).toEqual([]);
  });

  it('網址帶 notrack 關閉統計，track 恢復，並把參數從網址拿掉', () => {
    const data = new Map<string, string>();
    const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
    expect(isTrackingOff(store)).toBe(false);
    expect(applyTrackParam('?notrack&room=A', store)).toEqual({ search: '?room=A', changed: true });
    expect(isTrackingOff(store)).toBe(true);
    expect(applyTrackParam('?track', store)).toEqual({ search: '', changed: true });
    expect(isTrackingOff(store)).toBe(false);
  });

  it('沒有相關參數時網址原樣回傳，旗標不變', () => {
    const store = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    expect(applyTrackParam('?cheat=1', store)).toEqual({ search: '?cheat=1', changed: false });
  });

  it('儲存讀不到時視為沒有關閉', () => {
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => { throw new Error('denied'); } };
    expect(isTrackingOff(broken)).toBe(false);
    expect(applyTrackParam('?notrack', broken).changed).toBe(true);
  });
});

describe('流量統計：送出', () => {
  const event: AnalyticsEvent = { name: 'visit', visitId: 'visit-0001', deviceId: 'device-0001', version: '0.41.0' };

  it('用不需要預檢的純文字 POST 送到伺服器的 /events', () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    createEventSender('https://records.example', ((url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(new Response(null, { status: 201 }));
    }) as unknown as typeof fetch)(event);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://records.example/events');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>)['content-type']).toBe('text/plain');
    expect(calls[0].init.keepalive).toBe(true);
    expect(JSON.parse(calls[0].init.body as string)).toEqual(event);
  });

  it('連線失敗或同步丟錯都吞掉，不影響遊戲', async () => {
    const rejecting = createEventSender('https://records.example', (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch);
    expect(() => rejecting(event)).not.toThrow();
    const throwing = createEventSender('https://records.example', (() => { throw new Error('boom'); }) as unknown as typeof fetch);
    expect(() => throwing(event)).not.toThrow();
    await Promise.resolve();
  });
});
