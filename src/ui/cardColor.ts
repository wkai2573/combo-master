import { isExCardId } from '../data/exCards';
import type { CardData, ClassName } from '../data/types';

/** 卡面底色與標籤看卡種：招式、裝備、增益、Ex 卡各一色 */
export const KIND_COLOR = { move: '#9aa4c0', equip: '#c58a5a', buff: '#d97aa6', ex: '#7aa8a6' } as const;

/** 外框看職業；共用是灰色 */
export const CLASS_COLOR: Record<ClassName, string> = {
  共用: '#8a93a8',
  劍士: '#e0583f',
  盜賊: '#a56ae0',
  商人: '#e0b03f',
  法師: '#3f8fe0',
  弓箭手: '#4fc98b',
};

/** Ex 卡是效果生成的臨時卡，不屬於任何職業 */
const isEx = (c: CardData): boolean => isExCardId(c.id);

export function cardColor(c: CardData): string {
  return isEx(c) ? KIND_COLOR.ex : KIND_COLOR[c.kind];
}

/** Ex 卡整張用 Ex 青色，其餘外框看職業 */
export function cardBorderColor(c: CardData): string {
  return isEx(c) ? KIND_COLOR.ex : CLASS_COLOR[c.cls];
}
