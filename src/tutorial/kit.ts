import type { PlayerId } from '../engine/types';
import type { PlayerView } from '../engine/view';
import type { TextContext } from './script';

/** 第 2 課起共用的牌面配置：簡短戰鬥裡雙方各出一招，之後雙方手中都沒有範圍內的招式，會自動收招 */

/** 學習的玩家的起始手牌：打出的招式是紅心5，爆發放進經驗區的是梅花9，其餘都不在紅心5 與梅花6 之間 */
export const MY_HAND = ['黑桃1', '紅心2', '紅心5', '梅花9', '黑桃8', '方塊4'];
/** 簡短戰鬥裡玩家先攻打出的招式 */
export const MY_OPENING = '紅心5';
/** 爆發階段放進經驗區的手牌 */
export const MY_BURST = '梅花9';
/** 對手的起始手牌：回應玩家的是梅花6，其餘都不在範圍內 */
export const FOE_HAND = ['梅花6', '紅心9', '黑桃8', '方塊3'];
export const FOE_REPLY = '梅花6';

/** 我方的牌面（停在影格時是那一格的桌面） */
export const mine = ({ view }: TextContext): PlayerView => view.players[view.me];
export const foe = ({ view }: TextContext): PlayerView => view.players[view.me === 0 ? 1 : 0];
export const meOf = ({ view }: TextContext): PlayerId => view.me;
