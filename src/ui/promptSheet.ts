import type { PlayerId, Request } from '../engine/types';
import type { GameView } from '../engine/view';
import type { SheetTarget } from './components/PhoneBoard';

/**
 * 手機版面：提示要選的牌放在某個牌區（經驗區、裝備增益區、棄牌區、怒氣區）時，該自動打開哪個牌區的面板。
 * 選項是手牌、或是沒有牌可看（按鈕）就不用開；排序提示本來就在提示欄裡排。怒氣區只有擁有者看得到，所以不替對手的怒氣區開面板
 */
export function promptSheet(v: GameView, prompt: Request | null): SheetTarget | null {
  if (!prompt || prompt.ordered) return null;
  const want = new Set(prompt.options.map((o) => o.uid).filter((u): u is number => u !== undefined));
  if (want.size === 0) return null;
  for (const p of [v.me, v.me === 0 ? 1 : 0] as PlayerId[]) {
    const pv = v.players[p];
    const zones: [SheetTarget['tab'], { uid: number }[]][] = [['exp', pv.exp], ['gear', [...pv.gear, ...pv.buff]], ['discard', pv.discard], ['rage', pv.rage]];
    const hit = zones.find(([, cards]) => cards.some((c) => want.has(c.uid)));
    if (hit && (hit[0] !== 'rage' || p === v.me)) return { p, tab: hit[0] };
  }
  return null;
}

/** 提示顯示的位置：提示欄、牌區面板（要選的牌在牌區裡）、或單獨的底部提示面板 */
export type PromptPlace = 'bar' | 'zone' | 'panel';

/** 提示欄一列放得下的按鈕數 */
export const BAR_MAX_BUTTONS = 2;

/**
 * 手機版面的提示欄固定高度，放不下的提示要換地方：
 * - 要選的牌在牌區裡：交給牌區面板（提示欄跟著面板出現）
 * - 排序提示、或選項是不在手牌上的卡：用底部提示面板
 * - 按鈕超過兩顆（多選的確定鈕也算一顆）：用底部提示面板；但選項有手牌時手牌要留在手牌列上選，面板會蓋住它，所以仍放提示欄
 */
export function promptPlacement(v: GameView, prompt: Request | null): PromptPlace {
  if (!prompt) return 'bar';
  if (promptSheet(v, prompt)) return 'zone';
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
