/**
 * 作弊解鎖：作弊模式預設隱藏，瀏覽器裡有解鎖旗標才看得到開關與面板。
 * 這只是介面層級的隱藏，不是安全防護：旗標存在本機儲存，不做任何驗證。
 * 解鎖方式：網址帶參數（進站時處理，之後都生效），或在首頁連點版本號。
 * 所有讀寫都容錯：儲存讀不到或寫入失敗（私密模式）就視為未解鎖。
 */

const KEY = 'lianji.cheat.unlocked';
const PARAM = 'cheat';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStore(): Store | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

export function isCheatUnlocked(store: Store | null = defaultStore()): boolean {
  try {
    return store?.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setCheatUnlocked(on: boolean, store: Store | null = defaultStore()): void {
  try {
    if (on) store?.setItem(KEY, '1');
    else store?.removeItem(KEY);
  } catch {
    // 無法寫入：忽略，維持目前狀態
  }
}

/**
 * 處理網址的搜尋字串：cheat=1 解鎖、cheat=0 關閉解鎖。
 * 回傳去掉這個參數後的搜尋字串（沒有這個參數時原樣回傳）與有沒有處理過。
 */
export function applyCheatParam(search: string, store: Store | null = defaultStore()): { search: string; changed: boolean } {
  const params = new URLSearchParams(search);
  const value = params.get(PARAM);
  if (value === null) return { search, changed: false };
  if (value === '1') setCheatUnlocked(true, store);
  else if (value === '0') setCheatUnlocked(false, store);
  params.delete(PARAM);
  const rest = params.toString();
  return { search: rest ? `?${rest}` : '', changed: value === '1' || value === '0' };
}

/** 連點計數：在時間窗內點滿次數就回傳 true 並重新計算；超過時間窗的舊點擊不算 */
export function createTapCounter(needed = 7, windowMs = 3000): { tap(now: number): boolean } {
  let taps: number[] = [];
  return {
    tap(now) {
      taps = [...taps.filter((t) => now - t <= windowMs), now];
      if (taps.length < needed) return false;
      taps = [];
      return true;
    },
  };
}
