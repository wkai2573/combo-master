import cardsJson from './generated/cards.json';
import charsJson from './generated/characters.json';
import { characterText } from './characterText';
import { EX_CARDS } from './exCards';
import tableJson from './cardTable.json';
import { isCardEnabled } from './enabledCards';
import type { CardData, CharacterData } from './types';

const table = tableJson as {
  overrides: Record<string, Partial<CardData>>;
  chars: Record<string, Partial<CharacterData>>;
  added: CardData[];
};

/**
 * 36 張花色招式來自 xlsx，套上卡表網頁同步來的數值（cardTable.json，由 npm run table 產生）；
 * 其餘的卡（各職業的新卡、裝備）全部是卡表新增的。
 */
const addedIds = new Set(table.added.map((c) => c.id));
export const ALL_CARDS: CardData[] = [
  ...(cardsJson as CardData[]).filter((c) => !addedIds.has(c.id)).map((c) => ({
    ...c,
    ...table.overrides[c.id],
  })),
  ...table.added,
  ...EX_CARDS,
];

/** 目前開放使用的卡（組牌卡池與牌組驗證以此為準；引擎仍能處理全部卡片） */
export const PLAYABLE_CARDS: CardData[] = ALL_CARDS.filter(isCardEnabled);

export const ALL_CHARACTERS: CharacterData[] = (charsJson as CharacterData[]).map((c) => ({
  ...c,
  ...table.chars[c.name],
  ...characterText[c.name],
}));

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

