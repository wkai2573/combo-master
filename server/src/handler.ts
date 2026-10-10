import type { Repo } from './repo';
import { validateNewRecord, VERSION_PATTERN } from './validate';

/** 允許的來源：本站與本機開發網址。這是擋掉一般濫用的第一道門，不是安全邊界（來源標頭可以偽造） */
export const ALLOWED_ORIGINS: readonly string[] = [
  'https://wkai2573.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

/** 單一裝置在這段時間內最多新增幾筆 */
export const DEVICE_WINDOW_MS = 10 * 60 * 1000;
export const DEVICE_MAX = 20;
/** 全站在這段時間內最多新增幾筆，避免洪水式的寫入 */
export const GLOBAL_WINDOW_MS = 60 * 1000;
export const GLOBAL_MAX = 200;

const MAX_BODY_CHARS = 2048;
const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 2000;
const MAX_VERSIONS = 50;

export interface HandleOptions {
  /** 目前時間（毫秒），測試用 */
  now?: number;
  origins?: readonly string[];
}

function json(status: number, body: unknown, origin: string | null): Response {
  const headers: Record<string, string> = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  if (origin) {
    headers['access-control-allow-origin'] = origin;
    headers.vary = 'Origin';
  }
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * 處理一個請求。只有三個路徑：
 *   POST /records            新增一筆戰績（驗證、限流、同對局代號只收一次）
 *   GET  /versions           各版本的場數
 *   GET  /records?versions=  依版本取得戰績（分頁）
 * 沒有任何刪除或修改的路徑；來源不在允許名單上的請求一律拒絕。
 */
export async function handle(request: Request, repo: Repo, opts: HandleOptions = {}): Promise<Response> {
  const now = opts.now ?? Date.now();
  const origins = opts.origins ?? ALLOWED_ORIGINS;
  const url = new URL(request.url);
  const originHeader = request.headers.get('origin');
  const origin = originHeader && origins.includes(originHeader) ? originHeader : null;

  if (request.method === 'OPTIONS') {
    if (!origin) return new Response(null, { status: 403 });
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': origin,
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
        'access-control-max-age': '86400',
        vary: 'Origin',
      },
    });
  }

  if (url.pathname === '/health') return json(200, { ok: true }, origin);
  if (!origin) return json(403, { error: '來源不被允許' }, null);

  if (url.pathname === '/records') {
    if (request.method === 'POST') return postRecord(request, repo, now, origin);
    if (request.method === 'GET') return getRecords(url, repo, origin);
    return json(405, { error: '不支援的方法' }, origin);
  }
  if (url.pathname === '/versions') {
    if (request.method !== 'GET') return json(405, { error: '不支援的方法' }, origin);
    return json(200, { versions: await repo.versions() }, origin);
  }
  return json(404, { error: '找不到' }, origin);
}

async function postRecord(request: Request, repo: Repo, now: number, origin: string): Promise<Response> {
  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) return json(413, { error: '內容太大' }, origin);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json(400, { error: '不是合法的 JSON' }, origin);
  }
  const checked = validateNewRecord(body);
  if (!checked.ok) return json(400, { error: checked.error }, origin);
  const record = checked.value;
  if ((await repo.countByDevice(record.deviceId, now - DEVICE_WINDOW_MS)) >= DEVICE_MAX) return json(429, { error: '這個裝置寫入太頻繁，請稍後再試' }, origin);
  if ((await repo.countAll(now - GLOBAL_WINDOW_MS)) >= GLOBAL_MAX) return json(429, { error: '伺服器忙碌，請稍後再試' }, origin);
  const result = await repo.insert(record, now);
  return json(result === 'inserted' ? 201 : 200, { ok: true, duplicate: result === 'duplicate' }, origin);
}

async function getRecords(url: URL, repo: Repo, origin: string): Promise<Response> {
  const versions = (url.searchParams.get('versions') ?? '').split(',').filter(Boolean);
  if (versions.length === 0 || versions.length > MAX_VERSIONS || !versions.every((v) => VERSION_PATTERN.test(v))) {
    return json(400, { error: 'versions 必須是 1 到 50 個版本，以逗號分隔' }, origin);
  }
  const num = (key: string, fallback: number) => {
    const raw = url.searchParams.get(key);
    const n = raw === null ? fallback : Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : NaN;
  };
  const after = num('after', 0);
  const limit = num('limit', DEFAULT_LIMIT);
  if (Number.isNaN(after) || Number.isNaN(limit) || limit < 1) return json(400, { error: 'after 或 limit 不正確' }, origin);
  const page = await repo.list(versions, after, Math.min(limit, MAX_LIMIT));
  return json(200, page, origin);
}
