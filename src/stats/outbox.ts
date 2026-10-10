import type { RecordStore, UploadRecord } from './cloud';
import { isRecord } from './records';

/** 補傳佇列：上傳失敗的戰績存在本機，下次啟動與每次對局結束後重試 */

const KEY = 'lianji.records.outbox.v1';
/** 佇列上限：伺服器一直連不上時，不讓本機儲存無限長大；超過就丟掉最舊的 */
export const OUTBOX_MAX = 200;

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface Outbox {
  list(): UploadRecord[];
  add(record: UploadRecord): void;
  remove(matchId: string): void;
}

const ID = /^[A-Za-z0-9_-]{8,64}$/;
const isUpload = (r: unknown): r is UploadRecord =>
  isRecord(r) && typeof (r as UploadRecord).matchId === 'string' && ID.test((r as UploadRecord).matchId) && typeof (r as UploadRecord).deviceId === 'string' && ID.test((r as UploadRecord).deviceId);

function defaultStorage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

/** 讀不到、資料損毀、格式不符的筆數都當成沒有 */
export function localOutbox(store: Storage | null = defaultStorage()): Outbox {
  const read = (): UploadRecord[] => {
    try {
      const raw = store?.getItem(KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw) as unknown;
      return Array.isArray(arr) ? arr.filter(isUpload) : [];
    } catch {
      return [];
    }
  };
  const write = (list: UploadRecord[]) => {
    try {
      if (list.length === 0) store?.removeItem(KEY);
      else store?.setItem(KEY, JSON.stringify(list));
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

/**
 * 依序重送佇列裡的戰績。成功與被明確拒絕的都移出佇列；碰到暫時失敗就停下來，
 * 不對連不上的伺服器連續重試。回傳這次移出的筆數與剩下的筆數。
 */
export async function flushOutbox(outbox: Outbox, store: RecordStore): Promise<{ sent: number; left: number }> {
  let sent = 0;
  for (const record of outbox.list()) {
    const result = await store.submit(record);
    if (result === 'retry') break;
    outbox.remove(record.matchId);
    if (result === 'ok') sent++;
  }
  return { sent, left: outbox.list().length };
}
