import cardsJson from './generated/cards.json';
import charsJson from './generated/characters.json';
import { characterText } from './characterText';
import tableJson from './cardTable.json';
import type { Keyword } from './keywords';
import type { CardData, CharacterData } from './types';

export type UidPrefix = 'A' | 'B' | 'C' | 'E' | 'K' | 'X';

export interface CardTableData {
  overrides: Record<string, Partial<CardData>>;
  chars: Record<string, Partial<CharacterData>>;
  added: CardData[];
  keywords: Keyword[];
  exCards: CardData[];
  uids: Record<string, string>;
  uidSeq: Record<UidPrefix, number>;
}

export const cardTable = tableJson as CardTableData;
export const generatedCards = cardsJson as CardData[];
export const generatedCharacters = charsJson as CharacterData[];

export function readTableCharacters(table: CardTableData): CharacterData[] {
  return generatedCharacters.map((character) => ({
    ...character,
    ...table.chars[character.id],
    ...characterText[character.id],
    id: character.id,
  }));
}

export function readTableCards(table: CardTableData): CardData[] {
  const addedIds = new Set(table.added.map((card) => card.id));
  return [
    ...generatedCards.filter((card) => !addedIds.has(card.id)).map((card) => ({
      ...card,
      ...table.overrides[card.id],
    })),
    ...table.added,
    ...table.exCards,
  ];
}
