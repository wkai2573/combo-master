import { getCard } from '../data/cards';
import type { CardView } from '../engine/view';

// [經]、[經_怒3]、[起_經] 這類標籤：以底線分隔的標籤裡有「經」
const EXP_TAG = /\[(?:[^\]_]*_)*經(?:_[^\]_]*)*\]/;

/** 這張卡的卡文帶 [經] 標籤（在經驗區正面時才有效果） */
export function hasExpEffect(cardId: string): boolean {
  return EXP_TAG.test(getCard(cardId).text);
}

/** 經驗區裡的這張卡，其經驗效果目前是否生效中：看得到牌面、正面朝上、且帶 [經]。覆蓋中的牌是隱藏資訊，不提示 */
export function expEffectActive(c: Pick<CardView, 'id' | 'covered'>): boolean {
  return c.id !== null && !c.covered && hasExpEffect(c.id);
}
