import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { d1Repo, type D1Like, type D1Stmt } from '../server/src/d1';
import { handle } from '../server/src/handler';
import { createCloudStore, createMemoryStore, type UploadRecord } from '../src/stats/cloud';
import { flushOutbox, localOutbox, OUTBOX_MAX, type Outbox } from '../src/stats/outbox';
import type { BattleRecord } from '../src/stats/records';
import { createUploader, getDeviceId } from '../src/stats/upload';

const rec = (over: Partial<BattleRecord> = {}): BattleRecord => ({
  version: '0.37.0', opponent: 'cpu', mine: '勇者', theirs: '刺客', outcome: 'win', turns: 6, first: true, ...over,
});
const up = (n: number, over: Partial<UploadRecord> = {}): UploadRecord => ({ ...rec(), matchId: `match-${String(n).padStart(4, '0')}`, deviceId: 'device-0001', ...over });

const memoryStorage = () => {
  const m = new Map<string, string>();
  return { map: m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};
const brokenStorage = {
  getItem: () => { throw new Error('讀取失敗'); },
  setItem: () => { throw new Error('寫入失敗'); },
  removeItem: () => { throw new Error('刪除失敗'); },
};

/** 把戰績倉庫的 fetch 直接接到伺服器的處理函式，驗證前後端的介面對得上 */
function sqliteD1(): D1Like {
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
const serverFetch = (repo = d1Repo(sqliteD1())): typeof fetch => async (input, init) => {
  const headers = new Headers(init?.headers);
  headers.set('origin', 'https://wkai2573.github.io');
  return handle(new Request(String(input), { ...init, headers }), repo);
};

describe('戰績倉庫（雲端版）：上傳結果', () => {
  const store = (fetchFn: typeof fetch) => createCloudStore('https://records.example', fetchFn);
  const respond = (status: number) => (async () => new Response('{}', { status })) as unknown as typeof fetch;

  it('2xx 是成功；非 429、408 的 4xx 是被明確拒絕；其餘是暫時失敗', async () => {
    expect(await store(respond(201)).submit(up(1))).toBe('ok');
    expect(await store(respond(200)).submit(up(1))).toBe('ok');
    expect(await store(respond(400)).submit(up(1))).toBe('drop');
    expect(await store(respond(403)).submit(up(1))).toBe('drop');
    expect(await store(respond(413)).submit(up(1))).toBe('drop');
    expect(await store(respond(429)).submit(up(1))).toBe('retry');
    expect(await store(respond(408)).submit(up(1))).toBe('retry');
    expect(await store(respond(500)).submit(up(1))).toBe('retry');
    expect(await store(respond(503)).submit(up(1))).toBe('retry');
  });

  it('連不上伺服器也是暫時失敗，不會丟出錯誤', async () => {
    const down = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    expect(await store(down).submit(up(1))).toBe('retry');
  });

  it('上傳的是 POST /records，內容是戰績加上兩個代號', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fn = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response('{}', { status: 201 });
    }) as unknown as typeof fetch;
    await store(fn).submit(up(7));
    expect(calls[0].url).toBe('https://records.example/records');
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual(up(7));
  });
});

describe('戰績倉庫（雲端版）：取得', () => {
  it('versions 解析場數；回應格式不對或不是 2xx 時丟出說明原因的錯誤', async () => {
    const ok = (async () => new Response(JSON.stringify({ versions: [{ version: '0.37.0', games: 3 }, { oops: 1 }] }))) as unknown as typeof fetch;
    expect(await createCloudStore('https://x', ok).versions()).toEqual([{ version: '0.37.0', games: 3 }]);
    const bad = (async () => new Response('{"nope":1}')) as unknown as typeof fetch;
    await expect(createCloudStore('https://x', bad).versions()).rejects.toThrow('回應格式不正確');
    const err = (async () => new Response('x', { status: 500 })) as unknown as typeof fetch;
    await expect(createCloudStore('https://x', err).versions()).rejects.toThrow('500');
    const down = (async () => { throw new TypeError('x'); }) as unknown as typeof fetch;
    await expect(createCloudStore('https://x', down).versions()).rejects.toThrow('連不上');
  });

  it('自動分頁到沒有下一頁，並濾掉格式不符的筆數', async () => {
    const pages = [
      { records: [rec({ turns: 3 }), { bad: true }], next: 5 },
      { records: [rec({ turns: 4 })], next: null },
    ];
    const urls: string[] = [];
    const fn = (async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify(pages[urls.length - 1]));
    }) as unknown as typeof fetch;
    const got = await createCloudStore('https://x', fn).fetchRecords(['0.37.0', '0.36.0']);
    expect(got.map((r) => r.turns)).toEqual([3, 4]);
    expect(urls[0]).toBe('https://x/records?versions=0.37.0%2C0.36.0&limit=2000&after=0');
    expect(urls[1]).toContain('after=5');
  });

  it('沒有選版本就不連線', async () => {
    const fn = vi.fn();
    expect(await createCloudStore('https://x', fn as unknown as typeof fetch).fetchRecords([])).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('前後端串接：戰績倉庫直接接到伺服器的處理函式', () => {
  it('上傳後可以依版本取回；重送同一場不會重複；取回的內容不含代號', async () => {
    const store = createCloudStore('https://records.example', serverFetch());
    expect(await store.submit(up(1))).toBe('ok');
    expect(await store.submit(up(1))).toBe('ok');
    expect(await store.submit(up(2, { version: '0.36.0', outcome: 'lose', first: undefined }))).toBe('ok');
    expect(await store.versions()).toEqual(expect.arrayContaining([{ version: '0.37.0', games: 1 }, { version: '0.36.0', games: 1 }]));
    const got = await store.fetchRecords(['0.37.0']);
    expect(got).toEqual([rec()]);
    const old = await store.fetchRecords(['0.36.0']);
    expect(old).toEqual([{ version: '0.36.0', opponent: 'cpu', mine: '勇者', theirs: '刺客', outcome: 'lose', turns: 6 }]);
  });

  it('伺服器拒絕不合法的內容時是 drop', async () => {
    const store = createCloudStore('https://records.example', serverFetch());
    expect(await store.submit(up(1, { mine: '路人甲' }))).toBe('drop');
  });
});

describe('補傳佇列', () => {
  it('新增、列出、移除；同一場不重複', () => {
    const box = localOutbox(memoryStorage());
    box.add(up(1));
    box.add(up(2));
    box.add(up(1));
    expect(box.list().map((r) => r.matchId)).toEqual(['match-0002', 'match-0001']);
    box.remove('match-0002');
    expect(box.list().map((r) => r.matchId)).toEqual(['match-0001']);
  });

  it('超過上限就丟掉最舊的', () => {
    const box = localOutbox(memoryStorage());
    for (let i = 0; i < OUTBOX_MAX + 5; i++) box.add(up(i));
    expect(box.list()).toHaveLength(OUTBOX_MAX);
    expect(box.list()[0].matchId).toBe('match-0005');
  });

  it('資料損毀、格式不符的筆數、儲存壞掉都當成沒有，不拋出', () => {
    const s = memoryStorage();
    s.setItem('lianji.records.outbox.v1', '{壞掉');
    expect(localOutbox(s).list()).toEqual([]);
    s.setItem('lianji.records.outbox.v1', JSON.stringify([up(1), { nope: 1 }, up(2, { matchId: 'x' })]));
    expect(localOutbox(s).list().map((r) => r.matchId)).toEqual(['match-0001']);
    const box = localOutbox(brokenStorage);
    expect(box.list()).toEqual([]);
    expect(() => box.add(up(1))).not.toThrow();
    expect(() => box.remove('match-0001')).not.toThrow();
    expect(() => localOutbox(null).add(up(1))).not.toThrow();
  });

  it('依序重送：成功與被明確拒絕的移出佇列，碰到暫時失敗就停下來', async () => {
    const box = localOutbox(memoryStorage());
    for (let i = 1; i <= 4; i++) box.add(up(i));
    const store = createMemoryStore();
    // 第 1 筆成功、第 2 筆被拒絕、第 3 筆暫時失敗：停在第 3 筆，第 4 筆不碰
    const results: Array<'ok' | 'drop' | 'retry'> = ['ok', 'drop', 'retry'];
    const calls: string[] = [];
    const scripted = { ...store, submit: async (r: UploadRecord) => { calls.push(r.matchId); return results.shift() ?? 'ok'; } };
    expect(await flushOutbox(box, scripted)).toEqual({ sent: 1, left: 2 });
    expect(calls).toEqual(['match-0001', 'match-0002', 'match-0003']);
    expect(box.list().map((r) => r.matchId)).toEqual(['match-0003', 'match-0004']);
    expect(await flushOutbox(box, store)).toEqual({ sent: 2, left: 0 });
  });
});

describe('上傳器', () => {
  const make = (store: ReturnType<typeof createMemoryStore> | null, box: Outbox = localOutbox(memoryStorage())) => {
    let n = 0;
    return { box, up: createUploader({ store, outbox: box, deviceId: () => 'device-xyz1', newId: () => `match-${String(++n).padStart(4, '0')}` }) };
  };

  it('沒有設定伺服器：什麼都不做，也不佔本機儲存', async () => {
    const { box, up: u } = make(null);
    u.submit(rec());
    await u.flush();
    expect(box.list()).toEqual([]);
  });

  it('交出戰績就送到伺服器，帶對局代號與裝置代號，成功後佇列清空', async () => {
    const store = createMemoryStore();
    const { box, up: u } = make(store);
    u.submit(rec());
    await vi.waitFor(() => expect(store.all()).toHaveLength(1));
    expect(store.all()[0]).toMatchObject({ ...rec(), matchId: 'match-0001', deviceId: 'device-xyz1' });
    expect(box.list()).toEqual([]);
  });

  it('上傳失敗留在佇列，補傳用同一個對局代號，伺服器只收一筆', async () => {
    const memory = createMemoryStore();
    let calls = 0;
    const flaky = { ...memory, submit: async (r: UploadRecord) => (++calls === 1 ? ('retry' as const) : memory.submit(r)) };
    const { box, up: u } = make(flaky);
    u.submit(rec());
    await vi.waitFor(() => expect(calls).toBe(1));
    expect(box.list().map((r) => r.matchId)).toEqual(['match-0001']); // 暫時失敗，留在佇列
    await u.flush();
    expect(memory.all().map((r) => r.matchId)).toEqual(['match-0001']); // 補傳用同一個對局代號
    expect(box.list()).toEqual([]);
    await u.flush();
    expect(memory.all()).toHaveLength(1);
  });

  it('倉庫丟出任何錯誤都不外洩，戰績留在佇列', async () => {
    const boom = { ...createMemoryStore(), submit: async () => { throw new Error('壞掉了'); } };
    const { box, up: u } = make(boom);
    expect(() => u.submit(rec())).not.toThrow();
    await expect(u.flush()).resolves.toBeUndefined();
    expect(box.list()).toHaveLength(1);
  });
});

describe('裝置代號', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('同一個瀏覽器沿用同一個代號，格式符合伺服器要求；儲存壞掉時頁面存活期間沿用同一個', async () => {
    const s = memoryStorage();
    vi.stubGlobal('localStorage', s);
    const { getDeviceId: fresh } = await import('../src/stats/upload');
    const id = fresh();
    expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(s.map.get('lianji.device.v1')).toBe(id);
    expect(fresh()).toBe(id);

    vi.resetModules();
    const { getDeviceId: again } = await import('../src/stats/upload');
    expect(again()).toBe(id);

    vi.resetModules();
    vi.stubGlobal('localStorage', brokenStorage);
    const { getDeviceId: noStore } = await import('../src/stats/upload');
    const first = noStore();
    expect(first).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(noStore()).toBe(first);
  });

  it('匯出可用', () => {
    expect(typeof getDeviceId).toBe('function');
  });
});
