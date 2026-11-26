import { cardTable as table, readTableCards, readTableCharacters } from './cardTableData';
import { isCardEnabled } from './enabledCards';
import { TUTORIAL_CHARACTERS } from './tutorialCharacters';
import type { CardData, CharacterData } from './types';

export const ALL_CARDS: CardData[] = readTableCards(table);

/** 目前開放使用的卡（組牌卡池與牌組驗證以此為準；引擎仍能處理全部卡片） */
export const PLAYABLE_CARDS: CardData[] = ALL_CARDS.filter(isCardEnabled);

export const ALL_CHARACTERS = readTableCharacters(table);

// 教學與既有對局仍可能依內部 id 讀取已移出卡池的項目。
const cardMap = new Map([...(table.removedCards ?? []), ...ALL_CARDS].map((c) => [c.id, c]));
// 教學角色只供依 id 查詢，不在 ALL_CHARACTERS
const charMap = new Map([...(table.removedCharacters ?? []), ...ALL_CHARACTERS, ...TUTORIAL_CHARACTERS].map((c) => [c.id, c]));

export function getCard(id: string): CardData {
  const c = cardMap.get(id);
  if (!c) throw new Error(`未知的卡片：${id}`);
  return c;
}

export function getCharacter(id: string): CharacterData {
  const c = charMap.get(id);
  if (!c) throw new Error(`未知的角色：${id}`);
  return c;
}

