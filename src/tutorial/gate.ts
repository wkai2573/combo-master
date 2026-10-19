import type { Request } from '../engine/types';
import type { TutorialProgress } from './script';

/**
 * 教學中玩家看得到、能選的提示：教學封鎖所有操作，只有腳本要求選擇時，才留下指定的那個選項。
 * 要求選牌時只留下指定的牌，要求選按鈕時只留下指定的按鈕；其他牌、收招與不發動都拿掉。
 * 等點擊或腳本走完時什麼都不能選。要求選擇時，可略過的提示改成必選，所以不會出現「略過」。
 * 不是教學（progress 為 null）就原樣給。
 */
export function gatePrompt(progress: TutorialProgress | null, prompt: Request | null): Request | null {
  if (!progress || !prompt) return prompt;
  const { awaiting } = progress;
  if (awaiting === null || awaiting === 'click') return null;
  const options = prompt.options.filter((o) => ('play' in awaiting ? o.cardId === awaiting.play : o.key === awaiting.choose));
  return options.length > 0 ? { ...prompt, options, min: Math.min(Math.max(prompt.min, 1), prompt.max) } : null;
}
