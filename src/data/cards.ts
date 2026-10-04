import cardsJson from './generated/cards.json';
import charsJson from './generated/characters.json';
import { classMap } from './classMap';
import type { CardData, CharacterData } from './types';

/** xlsx 職業欄為「共用」的卡，若在 classMap 有提案歸屬則採用 */
export const ALL_CARDS: CardData[] = (cardsJson as CardData[]).map((c) => ({
  ...c,
  cls: c.cls === '共用' && classMap[c.id] ? classMap[c.id] : c.cls,
}));

export const ALL_CHARACTERS: CharacterData[] = charsJson as CharacterData[];

const cardMap = new Map(ALL_CARDS.map((c) => [c.id, c]));
const charMap = new Map(ALL_CHARACTERS.map((c) => [c.id, c]));

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

export const isTrap = (c: CardData) => c.traits.includes('陷阱');
