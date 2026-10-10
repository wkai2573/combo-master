import { createCloudStore, type RecordStore, type UploadRecord } from './cloud';
import { RECORDS_API } from './config';
import { flushOutbox, localOutbox, type Outbox } from './outbox';
import type { BattleRecord } from './records';

/** 隨機代號：長度 32、只含英數，符合伺服器對對局代號與裝置代號的格式 */
export function randomId(): string {
  try {
    return crypto.randomUUID().replace(/-/g, '');
  } catch {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }
}

const DEVICE_KEY = 'lianji.device.v1';
let deviceId: string | null = null;

/** 這個瀏覽器的匿名裝置代號，只用來讓伺服器限流；沒有任何個人資料。儲存失敗時整個頁面存活期間沿用同一個 */
export function getDeviceId(): string {
  if (deviceId) return deviceId;
  try {
    const saved = localStorage.getItem(DEVICE_KEY);
    if (saved && /^[A-Za-z0-9_-]{8,64}$/.test(saved)) return (deviceId = saved);
  } catch {
    // 讀不到：改用新的
  }
  deviceId = randomId();
  try {
    localStorage.setItem(DEVICE_KEY, deviceId);
  } catch {
    // 無法儲存：這一次頁面存活期間沿用
  }
  return deviceId;
}

export interface Uploader {
  /** 對局正常結束時呼叫：存進補傳佇列並嘗試上傳；任何失敗都不外洩，不影響對局 */
  submit(record: BattleRecord): void;
  /** 重送佇列裡尚未上傳的戰績（啟動時呼叫） */
  flush(): Promise<void>;
}

/** store 是 null 代表沒有設定伺服器：什麼都不做，也不佔本機儲存 */
export function createUploader(deps: { store: RecordStore | null; outbox: Outbox; deviceId: () => string; newId: () => string }): Uploader {
  const flush = async () => {
    if (!deps.store) return;
    try {
      await flushOutbox(deps.outbox, deps.store);
    } catch {
      // 上傳過程的任何錯誤都吞掉：戰績是附屬功能
    }
  };
  return {
    submit(record) {
      if (!deps.store) return;
      const upload: UploadRecord = { ...record, matchId: deps.newId(), deviceId: deps.deviceId() };
      deps.outbox.add(upload);
      void flush();
    },
    flush,
  };
}

let shared: Uploader | undefined;
/** 預設的上傳器：第一次使用時才建立，依設定的伺服器網址連線 */
export const defaultUploader = (): Uploader =>
  (shared ??= createUploader({
    store: RECORDS_API ? createCloudStore(RECORDS_API) : null,
    outbox: localOutbox(),
    deviceId: getDeviceId,
    newId: randomId,
  }));

/** 戰績頁用的倉庫；沒有設定伺服器時是 null */
export const defaultStore = (): RecordStore | null => (RECORDS_API ? createCloudStore(RECORDS_API) : null);
