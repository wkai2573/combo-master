import type { Opt } from '../engine/types';

/** 放棄類的選項：不發動、不使用、收招、結束。它們排在左邊用一般色，其他選項排在右邊用強調色 */
const DECLINE_KEYS = new Set(['no', 'skip', 'pass', 'end', '0']);

export interface PromptButton {
  opt: Opt;
  primary: boolean;
}

/** 提示的按鈕選項依「放棄類在左、其他在右」排好，並標出哪些要用強調色；同類之間維持原順序 */
export function orderPromptButtons(options: Opt[]): PromptButton[] {
  const buttons = options.map((opt) => ({ opt, primary: !DECLINE_KEYS.has(opt.key) }));
  return [...buttons.filter((b) => !b.primary), ...buttons.filter((b) => b.primary)];
}
