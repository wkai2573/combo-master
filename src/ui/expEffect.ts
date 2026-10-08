import { hasExpEffect } from '../data/expEffect';
import type { CardView } from '../engine/view';

export { hasExpEffect };

/** 經驗區裡的這張卡，其經驗效果目前是否生效中：看得到牌面、表側、且帶 [經]。裏側的牌經驗效果無效，不提示 */
export function expEffectActive(c: Pick<CardView, 'id' | 'covered'>): boolean {
  return c.id !== null && !c.covered && hasExpEffect(c.id);
}
