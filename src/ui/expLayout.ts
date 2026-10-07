/** 小卡寬度與間距（與樣式中的 .card.sm 一致） */
export const EXP_CARD_W = 76;
export const EXP_GAP = 6;
/** 水平重疊時，每張牌至少露出的寬度 */
export const MIN_STEP = 14;

export type ExpLayout = {
  /** one：單列完整小卡；two：兩列矮卡；overlap：兩列矮卡再水平重疊 */
  mode: 'one' | 'two' | 'overlap';
  /** 第一列放幾張：經驗區順序的前 firstRow 張在第一列，其餘依序在第二列 */
  firstRow: number;
  /** 欄數（兩列中較長那列的張數） */
  cols: number;
  /** 相鄰兩欄左緣的距離（像素） */
  step: number;
};

/**
 * 依經驗區的張數與可用寬度，決定單列、兩列還是重疊。
 * 排列順序＝經驗區順序：第一列由左向右放滿，剩下的放第二列，所以最前方是第一列最左。
 * 重疊時前半放第一列、後半放第二列，兩列欄距相同
 */
export function expLayout(count: number, width: number, cardW = EXP_CARD_W, gap = EXP_GAP): ExpLayout {
  const full = cardW + gap;
  if (width <= 0) return { mode: 'one', firstRow: count, cols: count, step: full };
  const fit = Math.max(1, Math.floor((width + gap) / full));
  if (count <= fit) return { mode: 'one', firstRow: count, cols: count, step: full };
  if (count <= fit * 2) return { mode: 'two', firstRow: fit, cols: fit, step: full };
  const cols = Math.ceil(count / 2);
  return { mode: 'overlap', firstRow: cols, cols, step: Math.max(MIN_STEP, (width - cardW) / (cols - 1)) };
}
