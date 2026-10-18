import { beforeEach, describe, expect, it } from 'vitest';
import { d1Repo } from '../server/src/d1';
import { EVENT_DEVICE_MAX, EVENT_DEVICE_WINDOW_MS, EVENT_GLOBAL_MAX, EVENT_GLOBAL_WINDOW_MS, handle } from '../server/src/handler';
import type { Repo } from '../server/src/repo';
import { sqliteD1 } from './sqliteD1';

const ORIGIN = 'https://wkai2573.github.io';
const NOW = 1_800_000_000_000;

const visit = (over: Record<string, unknown> = {}) => ({ name: 'visit', visitId: 'visit-0001', deviceId: 'device-0001', version: '0.41.0', ...over });
const beat = (activeMs: number, over: Record<string, unknown> = {}) => visit({ name: 'beat', activeMs, ...over });

let db: ReturnType<typeof sqliteD1>;
let repo: Repo;
beforeEach(() => {
  db = sqliteD1();
  repo = d1Repo(db);
});

const postEvent = (payload: unknown, now = NOW, origin: string | null = ORIGIN) => {
  const headers = new Headers({ 'content-type': 'text/plain' });
  if (origin) headers.set('origin', origin);
  return handle(new Request('https://records.example.workers.dev/events', { method: 'POST', headers, body: JSON.stringify(payload) }), repo, { now });
};

const rows = async () =>
  (await db.prepare('SELECT name, visit_id, device_id, version, opponent, created_at, last_seen_at, active_ms FROM events ORDER BY id').all()).results;

describe('流量事件：造訪', () => {
  it('新的造訪寫入一筆，最後活動時間從造訪時間起算', async () => {
    const res = await postEvent(visit());
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, duplicate: false });
    expect(await rows()).toEqual([
      { name: 'visit', visit_id: 'visit-0001', device_id: 'device-0001', version: '0.41.0', opponent: null, created_at: NOW, last_seen_at: NOW, active_ms: 0 },
    ]);
  });

  it('同一個造訪代號重送只存一筆，回應仍是成功', async () => {
    await postEvent(visit());
    const again = await postEvent(visit(), NOW + 5000);
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ ok: true, duplicate: true });
    expect(await rows()).toHaveLength(1);
  });
});

describe('流量事件：開始與打完對局', () => {
  it('同一次造訪可以有很多場，各帶對戰類型', async () => {
    await postEvent(visit());
    expect((await postEvent({ ...visit(), name: 'start', opponent: 'cpu' }, NOW + 1000)).status).toBe(201);
    expect((await postEvent({ ...visit(), name: 'finish', opponent: 'cpu' }, NOW + 60_000)).status).toBe(201);
    expect((await postEvent({ ...visit(), name: 'start', opponent: 'player' }, NOW + 70_000)).status).toBe(201);
    const all = await rows();
    expect(all.map((r) => [r.name, r.opponent])).toEqual([['visit', null], ['start', 'cpu'], ['finish', 'cpu'], ['start', 'player']]);
  });

  it('對戰類型可以是教學', async () => {
    await postEvent(visit());
    expect((await postEvent({ ...visit(), name: 'start', opponent: 'tutorial' }, NOW + 1000)).status).toBe(201);
    expect((await postEvent({ ...visit(), name: 'finish', opponent: 'tutorial' }, NOW + 60_000)).status).toBe(201);
    expect((await rows()).map((r) => [r.name, r.opponent])).toEqual([['visit', null], ['start', 'tutorial'], ['finish', 'tutorial']]);
  });

  it('開始與打完對局一定要有對戰類型', async () => {
    expect((await postEvent({ ...visit(), name: 'start' })).status).toBe(400);
    expect((await postEvent({ ...visit(), name: 'finish', opponent: 'robot' })).status).toBe(400);
  });

  it('造訪帶了對戰類型也不會存下來', async () => {
    await postEvent(visit({ opponent: 'cpu' }));
    expect((await rows())[0].opponent).toBeNull();
  });
});

describe('流量事件：心跳', () => {
  it('回報分頁可見的累計時間，停留時間就是這個數字', async () => {
    await postEvent(visit());
    const res = await postEvent(beat(28_000), NOW + 30_000);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, updated: true });
    const [row] = await rows();
    expect(row.created_at).toBe(NOW);
    expect(row.last_seen_at).toBe(NOW + 30_000);
    expect(row.active_ms).toBe(28_000);
  });

  it('切到別的分頁掛著的時間不算：隔很久才回來的心跳只帶可見的累計時間', async () => {
    await postEvent(visit());
    await postEvent(beat(60_000), NOW + 60_000);
    // 之後切走 2 小時，回來又看了 10 秒
    await postEvent(beat(70_000), NOW + 2 * 60 * 60 * 1000 + 70_000);
    expect((await rows())[0].active_ms).toBe(70_000);
  });

  it('可見時間不會比真實經過的時間多，也不會倒退', async () => {
    await postEvent(visit());
    await postEvent(beat(80_000_000), NOW + 30_000);
    expect((await rows())[0].active_ms).toBe(30_000);
    await postEvent(beat(5_000), NOW + 60_000);
    expect((await rows())[0].active_ms).toBe(30_000);
  });

  it('心跳不新增任何資料', async () => {
    await postEvent(visit());
    await postEvent(beat(30_000), NOW + 30_000);
    expect(await rows()).toHaveLength(1);
  });

  it('距離上次活動不到 10 秒的心跳被忽略，滿 10 秒就收', async () => {
    await postEvent(visit());
    const tooSoon = await postEvent(beat(9_000), NOW + 9_999);
    expect(await tooSoon.json()).toEqual({ ok: true, updated: false });
    expect((await rows())[0].active_ms).toBe(0);
    const ok = await postEvent(beat(10_000), NOW + 10_000);
    expect(await ok.json()).toEqual({ ok: true, updated: true });
    expect((await rows())[0].active_ms).toBe(10_000);
  });

  it('造訪不存在，或造訪屬於別的裝置：不更新', async () => {
    await postEvent(visit());
    const unknown = await postEvent(beat(30_000, { visitId: 'visit-9999' }), NOW + 30_000);
    expect(await unknown.json()).toEqual({ ok: true, updated: false });
    const other = await postEvent(beat(30_000, { deviceId: 'device-9999' }), NOW + 30_000);
    expect(await other.json()).toEqual({ ok: true, updated: false });
    expect((await rows())[0].active_ms).toBe(0);
  });

  it('心跳只更新造訪那一列，不動同一造訪的開始與打完對局', async () => {
    await postEvent(visit());
    await postEvent({ ...visit(), name: 'start', opponent: 'cpu' }, NOW + 1000);
    await postEvent(beat(29_000), NOW + 30_000);
    const all = await rows();
    expect(all.map((r) => [r.last_seen_at, r.active_ms])).toEqual([[NOW + 30_000, 29_000], [NOW + 1000, 0]]);
  });

  it('心跳一定要帶可見時間，而且是合理的整數', async () => {
    await postEvent(visit());
    expect((await postEvent(visit({ name: 'beat' }), NOW + 30_000)).status).toBe(400);
    expect((await postEvent(beat(-1), NOW + 30_000)).status).toBe(400);
    expect((await postEvent(beat(1.5), NOW + 30_000)).status).toBe(400);
    expect((await postEvent(beat(86_400_001), NOW + 30_000)).status).toBe(400);
  });
});

describe('流量事件：驗證與來源', () => {
  it.each([
    ['事件名稱不認得', { name: 'click' }],
    ['缺少造訪代號', { visitId: undefined }],
    ['造訪代號格式不正確', { visitId: 'a b' }],
    ['裝置代號格式不正確', { deviceId: 'x' }],
    ['版本格式不正確', { version: '1.2' }],
  ])('%s：回 400', async (_label, over) => {
    expect((await postEvent(visit(over))).status).toBe(400);
    expect(await rows()).toHaveLength(0);
  });

  it('不是 JSON、不是物件、內容太大都拒絕', async () => {
    const send = (text: string) =>
      handle(new Request('https://x.example/events', { method: 'POST', headers: { origin: ORIGIN }, body: text }), repo, { now: NOW });
    expect((await send('不是 json')).status).toBe(400);
    expect((await send('[1]')).status).toBe(400);
    expect((await send(JSON.stringify({ ...visit(), pad: 'x'.repeat(3000) }))).status).toBe(413);
  });

  it('來源不在允許名單或沒有來源：拒絕；只認 POST', async () => {
    expect((await postEvent(visit(), NOW, 'https://evil.example')).status).toBe(403);
    expect((await postEvent(visit(), NOW, null)).status).toBe(403);
    const get = await handle(new Request('https://x.example/events', { headers: { origin: ORIGIN } }), repo, { now: NOW });
    expect(get.status).toBe(405);
    expect(await rows()).toHaveLength(0);
  });

  it('不需要預檢的簡單請求也會帶回允許的來源標頭', async () => {
    const res = await postEvent(visit());
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN);
  });
});

describe('流量事件：限流', () => {
  it('同一個裝置在時間窗內超過上限就被拒絕，時間窗過了又可以寫', async () => {
    for (let i = 0; i < EVENT_DEVICE_MAX; i++) {
      expect((await postEvent(visit({ visitId: `visit-${String(i).padStart(4, '0')}` }), NOW + i)).status).toBe(201);
    }
    expect((await postEvent(visit({ visitId: 'visit-over0' }), NOW + EVENT_DEVICE_MAX)).status).toBe(429);
    expect((await postEvent(visit({ visitId: 'visit-over1', deviceId: 'device-0002' }), NOW + EVENT_DEVICE_MAX)).status).toBe(201);
    expect((await postEvent(visit({ visitId: 'visit-later' }), NOW + EVENT_DEVICE_WINDOW_MS + EVENT_DEVICE_MAX)).status).toBe(201);
  });

  it('心跳不計入新增額度，額度滿了心跳照樣更新', async () => {
    await postEvent(visit());
    for (let i = 2; i <= EVENT_DEVICE_MAX; i++) await postEvent(visit({ visitId: `visit-${String(i).padStart(4, '0')}` }), NOW + i);
    expect((await postEvent(visit({ visitId: 'visit-over0' }), NOW + 100)).status).toBe(429);
    const res = await postEvent(beat(30_000), NOW + 30_000);
    expect(await res.json()).toEqual({ ok: true, updated: true });
  });

  it('全站洪水式新增也會被擋', async () => {
    for (let i = 0; i < EVENT_GLOBAL_MAX; i++) {
      const res = await postEvent(visit({ visitId: `visit-${i}-xxxx`, deviceId: `device-${i}-xxxx` }), NOW);
      expect(res.status).toBe(201);
    }
    expect((await postEvent(visit({ visitId: 'visit-over0', deviceId: 'device-over0' }), NOW)).status).toBe(429);
    expect((await postEvent(visit({ visitId: 'visit-over1', deviceId: 'device-over1' }), NOW + EVENT_GLOBAL_WINDOW_MS + 1)).status).toBe(201);
  });
});
