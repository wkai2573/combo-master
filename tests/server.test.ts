import { beforeEach, describe, expect, it } from 'vitest';
import { ALL_CHARACTERS } from '../src/data/cards';
import { d1Repo } from '../server/src/d1';
import { KNOWN_CHARACTERS } from '../server/src/characters';
import { ALLOWED_ORIGINS, DEVICE_MAX, DEVICE_WINDOW_MS, GLOBAL_MAX, handle } from '../server/src/handler';
import type { Repo } from '../server/src/repo';
import { sqliteD1 } from './sqliteD1';

const ORIGIN = 'https://wkai2573.github.io';
const NOW = 1_800_000_000_000;

const body = (over: Record<string, unknown> = {}) => ({
  matchId: 'match-0001', deviceId: 'device-0001', version: '0.37.0', opponent: 'cpu', mine: '勇者', theirs: '刺客', outcome: 'win', turns: 6, first: true, ...over,
});

const send = (repo: Repo, path: string, init: RequestInit & { origin?: string | null } = {}, now = NOW) => {
  const { origin = ORIGIN, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (origin) headers.set('origin', origin);
  return handle(new Request(`https://records.example.workers.dev${path}`, { ...rest, headers }), repo, { now });
};
const post = (repo: Repo, payload: unknown, init: RequestInit & { origin?: string | null } = {}, now = NOW) =>
  send(repo, '/records', { method: 'POST', body: JSON.stringify(payload), ...init }, now);

let repo: Repo;
beforeEach(() => {
  repo = d1Repo(sqliteD1());
});

describe('戰績伺服器：新增一筆', () => {
  it('合法的戰績寫入，之後可以取得，而且不回傳對局代號與裝置代號', async () => {
    const res = await post(repo, body());
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, duplicate: false });
    const list = await (await send(repo, '/records?versions=0.37.0')).json();
    expect(list).toEqual({
      records: [{ version: '0.37.0', opponent: 'cpu', mine: '勇者', theirs: '刺客', outcome: 'win', turns: 6, first: true }],
      next: null,
    });
  });

  it('沒有先後攻資料的紀錄不帶 first', async () => {
    const { first: _first, ...noFirst } = body();
    await post(repo, noFirst);
    const list = (await (await send(repo, '/records?versions=0.37.0')).json()) as { records: Array<Record<string, unknown>> };
    expect('first' in list.records[0]).toBe(false);
  });

  it('同一個對局代號重送只存一筆，回應仍是成功（補傳是安全的）', async () => {
    expect((await post(repo, body())).status).toBe(201);
    const again = await post(repo, body({ outcome: 'lose' }));
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ ok: true, duplicate: true });
    const list = (await (await send(repo, '/records?versions=0.37.0')).json()) as { records: Array<{ outcome: string }> };
    expect(list.records).toHaveLength(1);
    expect(list.records[0].outcome).toBe('win');
  });

  it.each([
    ['缺少對局代號', { matchId: undefined }],
    ['對局代號太短', { matchId: 'abc' }],
    ['對局代號含不合法字元', { matchId: 'match 0001!' }],
    ['裝置代號格式不正確', { deviceId: 'x' }],
    ['版本格式不正確', { version: '1.2' }],
    ['版本帶了字母', { version: '1.2.x' }],
    ['對手類型不認得', { opponent: 'robot' }],
    ['未知角色', { mine: '路人甲' }],
    ['對手角色未知', { theirs: '' }],
    ['非法結果', { outcome: 'won' }],
    ['回合數是 0', { turns: 0 }],
    ['回合數太大', { turns: 501 }],
    ['回合數不是整數', { turns: 3.5 }],
    ['回合數是字串', { turns: '6' }],
    ['first 不是布林值', { first: 1 }],
  ])('欄位不合法一律拒絕：%s', async (_name, over) => {
    const res = await post(repo, body(over));
    expect(res.status).toBe(400);
    const list = (await (await send(repo, '/records?versions=0.37.0')).json()) as { records: unknown[] };
    expect(list.records).toHaveLength(0);
  });

  it('不是 JSON、不是物件、內容太大都拒絕', async () => {
    expect((await send(repo, '/records', { method: 'POST', body: '{壞掉' })).status).toBe(400);
    expect((await post(repo, [1, 2])).status).toBe(400);
    expect((await post(repo, null)).status).toBe(400);
    expect((await post(repo, body({ extra: 'x'.repeat(3000) }))).status).toBe(413);
  });

  it('多餘的欄位直接忽略', async () => {
    expect((await post(repo, body({ admin: true }))).status).toBe(201);
  });
});

describe('戰績伺服器：限流', () => {
  it('同一個裝置在時間窗內超過上限就被拒絕，時間窗過了又可以寫', async () => {
    for (let i = 0; i < DEVICE_MAX; i++) expect((await post(repo, body({ matchId: `match-${1000 + i}` }))).status).toBe(201);
    const blocked = await post(repo, body({ matchId: 'match-9999' }));
    expect(blocked.status).toBe(429);
    // 別的裝置不受影響
    expect((await post(repo, body({ matchId: 'match-8888', deviceId: 'device-0002' }))).status).toBe(201);
    // 時間窗過後恢復
    expect((await post(repo, body({ matchId: 'match-7777' }), {}, NOW + DEVICE_WINDOW_MS + 1)).status).toBe(201);
  });

  it('全站洪水式寫入也會被擋', async () => {
    const stub: Repo = {
      ...repo,
      countByDevice: async () => 0,
      countAll: async () => GLOBAL_MAX,
    };
    expect((await post(stub, body())).status).toBe(429);
  });
});

describe('戰績伺服器：取得', () => {
  const seed = async () => {
    const rows = [
      body({ matchId: 'match-0001', version: '0.36.0', opponent: 'cpu', turns: 4 }),
      body({ matchId: 'match-0002', version: '0.37.0', opponent: 'player', turns: 5 }),
      body({ matchId: 'match-0003', version: '0.37.0', opponent: 'cpu', turns: 6, deviceId: 'device-0002' }),
      body({ matchId: 'match-0004', version: '0.10.0', opponent: 'cpu', turns: 7, deviceId: 'device-0003' }),
    ];
    for (const r of rows) await post(repo, r);
  };

  it('各版本的場數', async () => {
    await seed();
    const res = (await (await send(repo, '/versions')).json()) as { versions: Array<{ version: string; games: number }> };
    expect(res.versions.sort((a, b) => a.version.localeCompare(b.version))).toEqual([
      { version: '0.10.0', games: 1 }, { version: '0.36.0', games: 1 }, { version: '0.37.0', games: 2 },
    ]);
  });

  it('依版本篩選，只回傳選到的版本', async () => {
    await seed();
    const res = (await (await send(repo, '/records?versions=0.37.0,0.10.0')).json()) as { records: Array<{ version: string }> };
    expect(res.records.map((r) => r.version).sort()).toEqual(['0.10.0', '0.37.0', '0.37.0']);
  });

  it('分頁：依 id 由小到大，next 是下一頁的起點，最後一頁是 null', async () => {
    await seed();
    const first = (await (await send(repo, '/records?versions=0.36.0,0.37.0,0.10.0&limit=3')).json()) as { records: Array<{ turns: number }>; next: number | null };
    expect(first.records.map((r) => r.turns)).toEqual([4, 5, 6]);
    expect(first.next).toBe(3);
    const second = (await (await send(repo, `/records?versions=0.36.0,0.37.0,0.10.0&limit=3&after=${first.next}`)).json()) as { records: Array<{ turns: number }>; next: number | null };
    expect(second.records.map((r) => r.turns)).toEqual([7]);
    expect(second.next).toBeNull();
  });

  it('刻好剛好一頁時不會多出空的下一頁', async () => {
    await seed();
    const res = (await (await send(repo, '/records?versions=0.36.0,0.37.0,0.10.0&limit=4')).json()) as { records: unknown[]; next: number | null };
    expect(res.records).toHaveLength(4);
    expect(res.next).toBeNull();
  });

  it.each([
    ['沒有 versions', '/records'],
    ['versions 格式不正確', '/records?versions=abc'],
    ['限制不是數字', '/records?versions=0.37.0&limit=x'],
    ['限制是 0', '/records?versions=0.37.0&limit=0'],
    ['after 是負數', '/records?versions=0.37.0&after=-1'],
    ['版本太多', `/records?versions=${Array.from({ length: 51 }, (_, i) => `0.${i}.0`).join(',')}`],
  ])('參數不正確一律拒絕：%s', async (_name, path) => {
    expect((await send(repo, path)).status).toBe(400);
  });
});

describe('戰績伺服器：來源與路徑', () => {
  it('允許本站與本機開發網址，其他來源與沒有來源的請求一律拒絕', async () => {
    for (const origin of ALLOWED_ORIGINS) {
      const res = await send(repo, '/versions', { origin });
      expect(res.status, origin).toBe(200);
      expect(res.headers.get('access-control-allow-origin')).toBe(origin);
    }
    expect((await send(repo, '/versions', { origin: 'https://evil.example.com' })).status).toBe(403);
    expect((await send(repo, '/versions', { origin: null })).status).toBe(403);
    expect((await post(repo, body(), { origin: 'https://evil.example.com' })).status).toBe(403);
    expect((await post(repo, body(), { origin: null })).status).toBe(403);
  });

  it('預檢請求：允許的來源回 204 與允許的方法，其他來源 403', async () => {
    const ok = await send(repo, '/records', { method: 'OPTIONS' });
    expect(ok.status).toBe(204);
    expect(ok.headers.get('access-control-allow-methods')).toBe('GET, POST, OPTIONS');
    expect((await send(repo, '/records', { method: 'OPTIONS', origin: 'https://evil.example.com' })).status).toBe(403);
  });

  it('沒有任何刪除或修改的路徑：只認得新增與取得', async () => {
    await post(repo, body());
    for (const method of ['DELETE', 'PUT', 'PATCH']) {
      expect((await send(repo, '/records', { method })).status, method).toBe(405);
    }
    expect((await send(repo, '/versions', { method: 'POST', body: '{}' })).status).toBe(405);
    expect((await send(repo, '/records/match-0001', { method: 'DELETE' })).status).toBe(404);
    expect((await send(repo, '/nothing')).status).toBe(404);
    const list = (await (await send(repo, '/records?versions=0.37.0')).json()) as { records: unknown[] };
    expect(list.records).toHaveLength(1);
  });

  it('健康檢查不需要來源', async () => {
    const res = await send(repo, '/health', { origin: null });
    expect(res.status).toBe(200);
  });
});

describe('戰績伺服器：角色清單', () => {
  it('和遊戲的角色清單一致（新增角色時伺服器要一起改）', () => {
    const game = ALL_CHARACTERS.filter((c) => !c.pending).map((c) => c.id).sort();
    expect([...KNOWN_CHARACTERS].sort()).toEqual(game);
  });
});

describe('戰績伺服器：問卷轉址 /feedback', () => {
  const FORM = 'https://docs.google.com/forms/d/e/EXAMPLE/viewform';
  const feedback = (path: string, feedbackUrl: string | undefined, init: RequestInit = {}) =>
    handle(new Request(`https://records.example.workers.dev${path}`, init), repo, { now: NOW, feedbackUrl });

  it('瀏覽器直接開啟（沒有來源標頭）也會 302 轉址到設定的網址，而且不快取', async () => {
    const res = await feedback('/feedback', FORM);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(FORM);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('查詢字串不會被帶到目的網址', async () => {
    const res = await feedback('/feedback?utm=abc&redirect=https://evil.example.com', FORM);
    expect(res.headers.get('location')).toBe(FORM);
  });

  it('沒有設定或設定的不是 https 網址：不轉址，回 503', async () => {
    for (const bad of [undefined, '', '   ', 'javascript:alert(1)', 'http://docs.google.com/forms', 'not a url']) {
      const res = await feedback('/feedback', bad);
      expect(res.status, String(bad)).toBe(503);
      expect(res.headers.get('location'), String(bad)).toBeNull();
    }
  });

  it('只接受 GET 與 HEAD', async () => {
    expect((await feedback('/feedback', FORM, { method: 'HEAD' })).status).toBe(302);
    for (const method of ['POST', 'PUT', 'DELETE']) {
      expect((await feedback('/feedback', FORM, { method })).status, method).toBe(405);
    }
  });
});
