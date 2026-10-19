/**
 * 教學課程的完成紀錄：每一課各存一個旗標在這台瀏覽器，主畫面與課程清單據此顯示「推薦」與完成標記。
 * 所有讀寫都容錯：儲存讀不到或寫入失敗（私密模式）就視為還沒完成，不丟出錯誤。
 * 舊版只有一個「新手教學完成」旗標（lianji.tutorial.done），已作廢也不遷移，所以這裡用另一組名稱。
 */

const keyOf = (no: number) => `lianji.tutorial.done.${no}`;

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStore(): Store | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

export function isLessonDone(no: number, store: Store | null = defaultStore()): boolean {
  try {
    return store?.getItem(keyOf(no)) === '1';
  } catch {
    return false;
  }
}

export function setLessonDone(no: number, store: Store | null = defaultStore()): void {
  try {
    store?.setItem(keyOf(no), '1');
  } catch {
    // 無法寫入：忽略，下次還是顯示推薦
  }
}

/** 這些課程裡，已經完成的編號 */
export function doneLessons(nos: number[], store: Store | null = defaultStore()): Set<number> {
  return new Set(nos.filter((no) => isLessonDone(no, store)));
}

/** 主畫面入口的「推薦」標籤：只看第 1 課，沒完成就顯示 */
export const showRecommendTag = (done: ReadonlySet<number>, firstLesson: number): boolean => !done.has(firstLesson);

/**
 * 課程清單上的「推薦下一課」：第 1 課完成之後，尚未完成的最前面一課。
 * 第 1 課還沒完成時不標（那時推薦的是第 1 課本身，由主畫面的標籤負責）；全部完成也沒有。
 */
export function recommendedNext(nos: number[], done: ReadonlySet<number>): number | null {
  const [first, ...rest] = nos;
  if (first === undefined || !done.has(first)) return null;
  return rest.find((no) => !done.has(no)) ?? null;
}
