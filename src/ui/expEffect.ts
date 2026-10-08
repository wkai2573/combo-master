import { getCard } from '../data/cards';
import type { CardView } from '../engine/view';

// [經]、[經_怒3]、[先_經] 這類標籤：以底線分隔的標籤裡有「經」
const EXP_TAG = /\[(?:[^\]_]*_)*經(?:_[^\]_]*)*\]/;

// 卡文裡轉述別張卡（例如 Ex 卡）的說明，會以單獨一行「[卡名]：」開頭；那之後的 [經] 屬於別張卡
const EMBEDDED_HEADER = /^\[(?!(?:先|追|發|頂|經|覺)\])[^\]]+\]：\s*$/m;

/** 這張卡自己的卡文帶 [經] 標籤（在經驗區正面時才有效果）。轉述別張卡的說明不算 */
export function hasExpEffect(cardId: string): boolean {
  const text = getCard(cardId).text;
  const own = text.split(EMBEDDED_HEADER)[0];
  return EXP_TAG.test(own);
}

/** 經驗區裡的這張卡，其經驗效果目前是否生效中：看得到牌面、正面朝上、且帶 [經]。覆蓋中的牌是隱藏資訊，不提示 */
export function expEffectActive(c: Pick<CardView, 'id' | 'covered'>): boolean {
  return c.id !== null && !c.covered && hasExpEffect(c.id);
}
