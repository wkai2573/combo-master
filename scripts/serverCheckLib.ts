/**
 * 線上戰績伺服器的唯讀檢查：玩家實際開遊戲的來源，能不能讀戰績、通過上傳的預檢。
 * 來源不寫死，從正式站的入口網址跟著轉址走到最後的網域，網站換網域時才查得出來。
 */

export interface CheckOptions {
  /** 正式站的入口網址 */
  entry: string;
  /** 戰績伺服器的網址 */
  api: string;
  fetchFn?: typeof fetch;
}

export interface CheckResult {
  /** 玩家開遊戲的來源；正式站打不開時是 null */
  origin: string | null;
  /** 沒有問題時是空的 */
  failures: string[];
}

const TIMEOUT_MS = 20_000;
/** 瀏覽器上傳戰績前會先預檢；流量事件不需要預檢，這裡用同樣方式確認它接受這個來源 */
const PREFLIGHT_PATHS = ['/records', '/events'];

const reason = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const listed = (header: string | null, value: string): boolean =>
  (header ?? '').split(',').some((item) => item.trim().toLowerCase() === value.toLowerCase());

export async function checkRecordsServer({ entry, api, fetchFn = fetch }: CheckOptions): Promise<CheckResult> {
  const request = (url: string, init: RequestInit = {}) => fetchFn(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });

  let origin: string;
  try {
    const page = await request(entry);
    if (!page.ok) return { origin: null, failures: [`正式站打不開：${entry} 回應 ${page.status}`] };
    origin = new URL(page.url).origin;
  } catch (e) {
    return { origin: null, failures: [`正式站打不開：${entry}（${reason(e)}）`] };
  }

  /** 瀏覽器要看到成功的狀態與允許這個來源的標頭，才會放行 */
  const rejected = (res: Response): string | null => {
    if (!res.ok) return `回應 ${res.status}`;
    if (res.headers.get('access-control-allow-origin') !== origin) return `沒有允許來源 ${origin}`;
    return null;
  };

  const checkVersions = async (): Promise<string | null> => {
    const res = await request(`${api}/versions`, { headers: { origin } });
    const problem = rejected(res);
    if (problem) return problem;
    const data = (await res.json().catch(() => null)) as { versions?: unknown } | null;
    return Array.isArray(data?.versions) ? null : '回應格式不正確';
  };

  const checkPreflight = async (path: string): Promise<string | null> => {
    const res = await request(`${api}${path}`, {
      method: 'OPTIONS',
      headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' },
    });
    const problem = rejected(res);
    if (problem) return problem;
    if (!listed(res.headers.get('access-control-allow-methods'), 'POST')) return '預檢沒有允許 POST';
    if (!listed(res.headers.get('access-control-allow-headers'), 'content-type')) return '預檢沒有允許 content-type 標頭';
    return null;
  };

  const checks: Array<[string, () => Promise<string | null>]> = [
    ['GET /versions', checkVersions],
    ...PREFLIGHT_PATHS.map((path): [string, () => Promise<string | null>] => [`OPTIONS ${path}`, () => checkPreflight(path)]),
  ];
  const failures: string[] = [];
  for (const [name, run] of checks) {
    const problem = await run().catch((e: unknown) => `連線失敗（${reason(e)}）`);
    if (problem) failures.push(`${name}：${problem}`);
  }
  return { origin, failures };
}
