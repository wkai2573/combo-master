export type HandLayout = {
  overlap: boolean;
  /** 相鄰兩張左緣的距離（像素）；不重疊時為卡寬加間距 */
  step: number;
};

/** 手牌沒有上限：一列放得下就並排，放不下就水平重疊，每張至少露出 minStep */
export function handLayout(count: number, width: number, cardW: number, minStep: number, gap = 6): HandLayout {
  const full = cardW + gap;
  if (width <= 0 || cardW <= 0 || count <= 1) return { overlap: false, step: full };
  if (count * cardW + (count - 1) * gap <= width) return { overlap: false, step: full };
  return { overlap: true, step: Math.max(minStep, (width - cardW) / (count - 1)) };
}
