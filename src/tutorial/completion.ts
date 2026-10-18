/**
 * 新手教學的完成紀錄：存在這台瀏覽器，主畫面據此決定要不要顯示「推薦」。
 * 所有讀寫都容錯：儲存讀不到或寫入失敗（私密模式）就視為還沒完成，不丟出錯誤。
 */

const KEY = 'lianji.tutorial.done';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStore(): Store | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

export function isTutorialDone(store: Store | null = defaultStore()): boolean {
  try {
    return store?.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setTutorialDone(store: Store | null = defaultStore()): void {
  try {
    store?.setItem(KEY, '1');
  } catch {
    // 無法寫入：忽略，下次還是顯示推薦
  }
}
