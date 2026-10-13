import type { Request } from '../engine/types';
import type { GameView } from '../engine/view';

/** 提示顯示的位置：提示欄、或單獨的底部提示面板 */
export type PromptPlace = 'bar' | 'panel';

/** 提示欄一列放得下的按鈕數 */
export const BAR_MAX_BUTTONS = 2;

/**
 * 手機版面的提示欄固定高度，放不下的提示要換地方：
 * - 排序提示、或選項是不在手牌上的卡（包含經驗區、棄牌區等牌區裡的牌）：用底部提示面板，把可選的卡列在面板裡；
 *   牌區的全螢幕列表只給玩家手動查看，不拿來選牌
 * - 按鈕超過兩顆（多選的確定鈕也算一顆）：用底部提示面板；但選項有手牌時手牌要留在手牌列上選，面板會蓋住它，所以仍放提示欄
 */
export function promptPlacement(v: GameView, prompt: Request | null): PromptPlace {
  if (!prompt) return 'bar';
  if (prompt.ordered) return 'panel';
  const handUids = new Set(v.players[v.me].hand.map((c) => c.uid));
  const onHand = (o: Request['options'][number]) => o.uid !== undefined && handUids.has(o.uid);
  const isCard = (o: Request['options'][number]) => o.cardId !== undefined || o.hidden;
  if (prompt.options.some((o) => isCard(o) && !onHand(o))) return 'panel';
  const single = prompt.min === 1 && prompt.max === 1;
  const buttons = prompt.options.filter((o) => !isCard(o)).length + (single ? 0 : 1);
  if (buttons > BAR_MAX_BUTTONS && !prompt.options.some(onHand)) return 'panel';
  return 'bar';
}
