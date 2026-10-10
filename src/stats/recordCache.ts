import type { VersionCount } from './cloud';
import { isRecord, type BattleRecord } from './records';

/**
 * 上次成功取得的全站戰績，存在本機。伺服器連不上時戰績頁拿它當備援顯示。
 * 讀寫都容錯；資料太大（超過上限）就不存。
 */
export interface RecordCache {
  versions: VersionCount[];
  /** 每個版本取得過的戰績；沒有這個版本的鍵代表沒取過 */
  byVersion: Record<string, BattleRecord[]>;
}

const KEY = 'lianji.records.cache.v1';
/** 序列化後的字數上限，避免撐爆本機儲存 */
export const CACHE_MAX_CHARS = 1_500_000;

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

export function readRecordCache(store: Storage | null = defaultStorage()): RecordCache | null {
  try {
    const raw = store?.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { versions?: unknown; byVersion?: unknown };
    if (!Array.isArray(data.versions) || typeof data.byVersion !== 'object' || data.byVersion === null) return null;
    const versions = data.versions.filter(
      (v): v is VersionCount => typeof v === 'object' && v !== null && typeof (v as VersionCount).version === 'string' && Number.isInteger((v as VersionCount).games),
    );
    const byVersion: Record<string, BattleRecord[]> = {};
    for (const [version, list] of Object.entries(data.byVersion as Record<string, unknown>)) {
      if (Array.isArray(list)) byVersion[version] = list.filter(isRecord);
    }
    return { versions, byVersion };
  } catch {
    return null;
  }
}

export function writeRecordCache(cache: RecordCache, store: Storage | null = defaultStorage()): void {
  try {
    const text = JSON.stringify(cache);
    if (text.length > CACHE_MAX_CHARS) store?.removeItem(KEY);
    else store?.setItem(KEY, text);
  } catch {
    // 儲存失敗（私密模式或容量滿）：忽略
  }
}
