import { createCloudStore, type RecordStore, type UploadRecord } from './cloud';
import { RECORDS_API } from './config';
import { isRecord, type BattleRecord } from './records';

/** 隨機代號：長度 32、只含英數，符合伺服器對對局代號與裝置代號的格式 */
export function randomId(): string {
  try {
    return crypto.randomUUID().replace(/-/g, '');
  } catch {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }
}

const DEVICE_KEY = 'lianji.device.v1';
let cachedDeviceId: string | null = null;

export type StorageLike = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

/** 這個瀏覽器的匿名裝置代號，只用來讓伺服器限流；沒有任何個人資料。儲存失敗時整個頁面存活期間沿用同一個 */
export function getDeviceId(store: StorageLike | null = defaultStorage()): string {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    const saved = store?.getItem(DEVICE_KEY);
    if (saved && /^[A-Za-z0-9_-]{8,64}$/.test(saved)) return (cachedDeviceId = saved);
  } catch {
    // 讀不到：改用新的
  }
  const id = randomId();
  try {
    store?.setItem(DEVICE_KEY, id);
  } catch {
    // 無法儲存：這一次頁面存活期間沿用
  }
  return (cachedDeviceId = id);
}

/** 戰績回報模組介面：對局結束時提交，啟動時重送佇列 */
export interface RecordReporter {
  /** 對局正常結束時呼叫：存進補傳佇列並嘗試上傳；任何失敗都不外洩，不影響對局 */
  submit(record: BattleRecord): void;
  /** 重送佇列裡尚未上傳的戰績（啟動時或對局結束後呼叫） */
  flush(): Promise<{ sent: number; left: number }>;
}

const OUTBOX_KEY = 'lianji.records.outbox.v1';
/** 佇列上限：伺服器一直連不上時，不讓本機儲存無限長大；超過就丟掉最舊的 */
export const OUTBOX_MAX = 200;

const ID = /^[A-Za-z0-9_-]{8,64}$/;
const isUpload = (r: unknown): r is UploadRecord =>
  isRecord(r)
  && typeof (r as UploadRecord).matchId === 'string'
  && ID.test((r as UploadRecord).matchId)
  && typeof (r as UploadRecord).deviceId === 'string'
  && ID.test((r as UploadRecord).deviceId);

interface InternalOutbox {
  list(): UploadRecord[];
  add(record: UploadRecord): void;
  remove(matchId: string): void;
}

function createOutbox(store: StorageLike | null): InternalOutbox {
  const read = (): UploadRecord[] => {
    try {
      const raw = store?.getItem(OUTBOX_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw) as unknown;
      return Array.isArray(arr) ? arr.filter(isUpload) : [];
    } catch {
      return [];
    }
  };
  const write = (list: UploadRecord[]) => {
    try {
      if (list.length === 0) store?.removeItem(OUTBOX_KEY);
      else store?.setItem(OUTBOX_KEY, JSON.stringify(list));
    } catch {
      // 儲存失敗（私密模式或容量滿）：忽略，不影響遊戲
    }
  };
  return {
    list: read,
    add(record) {
      const list = read().filter((r) => r.matchId !== record.matchId);
      list.push(record);
      write(list.slice(-OUTBOX_MAX));
    },
    remove(matchId) {
      write(read().filter((r) => r.matchId !== matchId));
    },
  };
}

export interface RecordReporterDeps {
  store: RecordStore | null;
  deviceId?: () => string;
  newId?: () => string;
  storage?: StorageLike | null;
}

/** store 是 null 代表沒有設定伺服器：什麼都不做，也不佔本機儲存 */
export function createRecordReporter(deps: RecordReporterDeps): RecordReporter {
  const storage = deps.storage !== undefined ? deps.storage : defaultStorage();
  const getDevice = deps.deviceId ?? (() => getDeviceId(storage));
  const newId = deps.newId ?? randomId;
  const outbox = createOutbox(storage);

  const flush = async (): Promise<{ sent: number; left: number }> => {
    if (!deps.store) return { sent: 0, left: outbox.list().length };
    let sent = 0;
    try {
      for (const record of outbox.list()) {
        const result = await deps.store.submit(record);
        if (result === 'retry') break;
        outbox.remove(record.matchId);
        if (result === 'ok') sent++;
      }
    } catch {
      // 上傳過程的任何錯誤都吞掉：戰績是附屬功能
    }
    return { sent, left: outbox.list().length };
  };

  return {
    submit(record: BattleRecord): void {
      if (!deps.store) return;
      const upload: UploadRecord = {
        ...record,
        matchId: newId(),
        deviceId: getDevice(),
      };
      outbox.add(upload);
      void flush();
    },
    flush,
  };
}

let shared: RecordReporter | undefined;

/** 預設的戰績回報器：第一次使用時才建立，依設定的伺服器網址連線 */
export const defaultRecordReporter = (): RecordReporter =>
  (shared ??= createRecordReporter({
    store: RECORDS_API ? createCloudStore(RECORDS_API) : null,
  }));
