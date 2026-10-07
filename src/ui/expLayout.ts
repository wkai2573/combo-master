/** 小卡寬度與間距（與樣式中的 .card.sm 一致） */
export const EXP_CARD_W = 76;
export const EXP_GAP = 6;
/** 水平重疊時，每張牌至少露出的寬度 */
export const MIN_STEP = 14;

export type ExpLayout = {
  /** one：單列完整小卡；two：兩列矮卡；overlap：兩列矮卡再水平重疊 */
  mode: 'one' | 'two' | 'overlap';
  /** 兩列時的欄數（單列時等於張數） */
  cols: number;
  /** 相鄰兩欄左緣的距離（像素） */
  step: number;
};

/** 依經驗區的張數與可用寬度，決定單列、兩列還是重疊。兩列由上到下再往右排，左側仍是最前方 */
export function expLayout(count: number, width: number, cardW = EXP_CARD_W, gap = EXP_GAP): ExpLayout {
  const full = cardW + gap;
  if (width <= 0) return { mode: 'one', cols: count, step: full };
  const fit = Math.max(1, Math.floor((width + gap) / full));
  if (count <= fit) return { mode: 'one', cols: count, step: full };
  const cols = Math.ceil(count / 2);
  if (cols <= fit) return { mode: 'two', cols, step: full };
  return { mode: 'overlap', cols, step: Math.max(MIN_STEP, (width - cardW) / (cols - 1)) };
}
