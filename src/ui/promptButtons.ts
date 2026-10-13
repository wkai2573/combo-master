import type { Opt } from '../engine/types';

/** 放棄類的選項：不發動、不使用、收招、結束。它們排在左邊用一般色，其他選項排在右邊用強調色 */
const DECLINE_KEYS = new Set(['no', 'skip', 'pass', 'end', '0']);

export interface PromptButton {
  opt: Opt;
  primary: boolean;
}

/**
 * 多選提示的確定鈕：一張都沒選又允許不選就是「略過」，屬於放棄類，用一般色；選了牌才是用強調色的「確定」。
 * 完全不能選（max 為 0，看完牌只能按略過繼續）的提示，這顆鈕是唯一的前進鈕，仍用強調色
 */
export function confirmButton(selectedCount: number, min: number, max: number): { label: string; primary: boolean } {
  const skip = selectedCount === 0 && min === 0;
  return { label: skip ? '略過' : `確定（${selectedCount}）`, primary: !skip || max === 0 };
}

/** 提示的按鈕選項依「放棄類在左、其他在右」排好，並標出哪些要用強調色；同類之間維持原順序 */
export function orderPromptButtons(options: Opt[]): PromptButton[] {
  const buttons = options.map((opt) => ({ opt, primary: !DECLINE_KEYS.has(opt.key) }));
  return [...buttons.filter((b) => !b.primary), ...buttons.filter((b) => b.primary)];
}
