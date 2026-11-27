import { describe, expect, it } from 'vitest';
import { checkRecordsServer } from '../scripts/serverCheckLib';
import { d1Repo } from '../server/src/d1';
import { ALLOWED_ORIGINS, handle } from '../server/src/handler';
import { sqliteD1 } from './sqliteD1';

const ENTRY = 'https://entry.example/combo-master/';
const API = 'https://records.example';
const LIVE_ORIGIN = 'https://game.tempura.page';

/** 假的網路：入口網址轉址到 landing，戰績伺服器的請求直接交給真正的處理函式 */
function network(opts: { landing?: string; landingStatus?: number; origins?: readonly string[] } = {}) {
  const requests: Array<{ method: string; url: string }> = [];
  const repo = d1Repo(sqliteD1());
  const fetchFn: typeof fetch = async (input, init) => {
    const url = String(input);
    requests.push({ method: init?.method ?? 'GET', url });
    if (url === ENTRY) {
      const res = new Response('', { status: opts.landingStatus ?? 200 });
      Object.defineProperty(res, 'url', { value: opts.landing ?? `${LIVE_ORIGIN}/combo-master/` });
      return res;
    }
    return handle(new Request(url, init), repo, { origins: opts.origins ?? ALLOWED_ORIGINS });
  };
  return { fetchFn, requests };
}

const check = (fetchFn: typeof fetch) => checkRecordsServer({ entry: ENTRY, api: API, fetchFn });

describe('戰績伺服器的線上檢查', () => {
  it('伺服器允許玩家最後到達的來源時，沒有任何問題', async () => {
    const { fetchFn } = network();
    expect(await check(fetchFn)).toEqual({ origin: LIVE_ORIGIN, failures: [] });
  });

  it('只讀不寫：對戰績伺服器只送 GET 與預檢', async () => {
    const { fetchFn, requests } = network();
    await check(fetchFn);
    expect(requests.map((r) => `${r.method} ${r.url}`)).toEqual([
      `GET ${ENTRY}`,
      `GET ${API}/versions`,
      `OPTIONS ${API}/records`,
      `OPTIONS ${API}/events`,
    ]);
  });

  it('網站轉到伺服器不認得的網域時，三個端點都回報問題', async () => {
    const { fetchFn } = network({ landing: 'https://moved.example/combo-master/' });
    const { origin, failures } = await check(fetchFn);
    expect(origin).toBe('https://moved.example');
    expect(failures).toHaveLength(3);
    expect(failures[0]).toContain('/versions');
    expect(failures[0]).toContain('403');
    expect(failures[1]).toContain('/records');
    expect(failures[2]).toContain('/events');
  });

  it('正式站本身打不開時直接回報，不拿它的網域去檢查伺服器', async () => {
    const { fetchFn, requests } = network({ landingStatus: 404 });
    const { origin, failures } = await check(fetchFn);
    expect(origin).toBeNull();
    expect(failures).toEqual([expect.stringContaining('404')]);
    expect(requests).toHaveLength(1);
  });

  it('回應成功但沒有允許來源的標頭，瀏覽器一樣會擋，要回報', async () => {
    const base = network();
    const stripped: typeof fetch = async (input, init) => {
      const res = await base.fetchFn(input, init);
      if (String(input) === ENTRY) return res;
      const headers = new Headers(res.headers);
      headers.delete('access-control-allow-origin');
      return new Response(res.body, { status: res.status, headers });
    };
    expect((await check(stripped)).failures).toHaveLength(3);
  });

  it('各版本場數的內容格式不對時回報', async () => {
    const base = network();
    const broken: typeof fetch = async (input, init) => {
      const res = await base.fetchFn(input, init);
      return String(input) === `${API}/versions` ? new Response('<html>', { status: 200, headers: res.headers }) : res;
    };
    expect((await check(broken)).failures).toEqual([expect.stringContaining('/versions')]);
  });

  it('連線失敗不丟例外，寫進問題清單', async () => {
    const base = network();
    const offline: typeof fetch = async (input, init) => {
      if (String(input) === ENTRY) return base.fetchFn(input, init);
      throw new Error('getaddrinfo ENOTFOUND');
    };
    const { failures } = await check(offline);
    expect(failures).toHaveLength(3);
    expect(failures[0]).toContain('ENOTFOUND');
  });
});
