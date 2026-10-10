import { isRecord, type BattleRecord } from './records';

/** 上傳的一筆：戰績加上對局代號（補傳去重）與裝置代號（伺服器限流用） */
export interface UploadRecord extends BattleRecord {
  matchId: string;
  deviceId: string;
}

/**
 * 上傳結果：
 * - ok：伺服器已經有這一筆（新增或先前就收過）
 * - retry：暫時失敗（沒網路、伺服器忙碌、限流），之後再試
 * - drop：伺服器明確拒絕（內容不合法或來源不被允許），再試也沒用
 */
export type SubmitResult = 'ok' | 'retry' | 'drop';

export interface VersionCount {
  version: string;
  games: number;
}

/** 戰績倉庫：上傳與取得全站戰績；雲端版與測試用的記憶體版都實作它 */
export interface RecordStore {
  submit(record: UploadRecord): Promise<SubmitResult>;
  versions(): Promise<VersionCount[]>;
  /** 依版本取得全部戰績（自動分頁）；失敗時丟出說明原因的錯誤 */
  fetchRecords(versions: string[]): Promise<BattleRecord[]>;
}

const PAGE_LIMIT = 2000;
/** 分頁上限：避免伺服器異常時無止盡地翻頁 */
const MAX_PAGES = 100;

export function createCloudStore(base: string, fetchFn: typeof fetch = (...a) => fetch(...a)): RecordStore {
  const get = async (path: string): Promise<unknown> => {
    let res: Response;
    try {
      res = await fetchFn(`${base}${path}`);
    } catch {
      throw new Error('連不上戰績伺服器');
    }
    if (!res.ok) throw new Error(`戰績伺服器回應錯誤（${res.status}）`);
    try {
      return await res.json();
    } catch {
      throw new Error('戰績伺服器的回應格式不正確');
    }
  };

  return {
    async submit(record) {
      try {
        const res = await fetchFn(`${base}/records`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(record),
        });
        if (res.ok) return 'ok';
        // 429 限流與 408 逾時之外的 4xx 是伺服器明確拒絕，不必再試
        if (res.status >= 400 && res.status < 500 && res.status !== 429 && res.status !== 408) return 'drop';
        return 'retry';
      } catch {
        return 'retry';
      }
    },

    async versions() {
      const data = (await get('/versions')) as { versions?: unknown };
      if (!Array.isArray(data.versions)) throw new Error('戰績伺服器的回應格式不正確');
      return data.versions.filter(
        (v): v is VersionCount => typeof v === 'object' && v !== null && typeof (v as VersionCount).version === 'string' && Number.isInteger((v as VersionCount).games),
      );
    },

    async fetchRecords(versions) {
      if (versions.length === 0) return [];
      const out: BattleRecord[] = [];
      let after = 0;
      for (let page = 0; page < MAX_PAGES; page++) {
        const data = (await get(`/records?versions=${encodeURIComponent(versions.join(','))}&limit=${PAGE_LIMIT}&after=${after}`)) as { records?: unknown; next?: unknown };
        if (!Array.isArray(data.records)) throw new Error('戰績伺服器的回應格式不正確');
        out.push(...data.records.filter(isRecord));
        if (typeof data.next !== 'number') return out;
        after = data.next;
      }
      return out;
    },
  };
}

/** 記憶體版：測試與沒有伺服器時用。可以讓下一次上傳指定失敗的結果。 */
export function createMemoryStore(): RecordStore & { all(): UploadRecord[]; failNext(result: Exclude<SubmitResult, 'ok'>, times?: number): void } {
  const rows: UploadRecord[] = [];
  let fails: Array<Exclude<SubmitResult, 'ok'>> = [];
  return {
    all: () => [...rows],
    failNext(result, times = 1) {
      fails = Array.from({ length: times }, () => result);
    },
    async submit(record) {
      const fail = fails.shift();
      if (fail) return fail;
      if (!rows.some((r) => r.matchId === record.matchId)) rows.push(record);
      return 'ok';
    },
    async versions() {
      const counts = new Map<string, number>();
      for (const r of rows) counts.set(r.version, (counts.get(r.version) ?? 0) + 1);
      return [...counts].map(([version, games]) => ({ version, games }));
    },
    async fetchRecords(versions) {
      return rows
        .filter((r) => versions.includes(r.version))
        .map(({ matchId: _m, deviceId: _d, ...rec }) => rec);
    },
  };
}
