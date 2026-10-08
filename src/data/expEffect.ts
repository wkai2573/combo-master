import { getCard } from './cards';

// 卡文裡轉述別張卡（例如 Ex 卡）的說明，會以單獨一行「[卡名]：」開頭；那之後的 [經] 屬於別張卡
const EMBEDDED_HEADER = /^\[(?!(?:先|追|發|頂|經)\])[^\]]+\]：\s*$/m;

// 行首的標籤組：可有前綴 (回合X次)，例如 [經]、[經_怒3]、(回合1次)[經_蓋2]
const LINE_TAGS = /^(?:\([^)]*\))?\[([^\]]+)\]：/;

/** 這張卡自己的卡文有某一行以 [經] 標籤開頭（表側在經驗區時才有效果）。文字中引用 [經] 的說明、轉述別張卡的說明都不算 */
export function hasExpEffect(cardId: string): boolean {
  const own = getCard(cardId).text.split(EMBEDDED_HEADER)[0];
  return own.split('\n').some((line) => LINE_TAGS.exec(line.trim())?.[1].split('_').includes('經'));
}
