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
  addedCharacters?: CharacterData[];
  added: CardData[];
  keywords: Keyword[];
  exCards: CardData[];
  order?: Partial<Record<'cards' | 'characters', string[]>>;
  removedCards?: CardData[];
  removedCharacters?: CharacterData[];
  uids: Record<string, string>;
  uidSeq: Record<UidPrefix, number>;
}

export const cardTable = tableJson as CardTableData;
export const generatedCards = cardsJson as CardData[];
export const generatedCharacters = charsJson as CharacterData[];

export function sortByOrder<T>(items: T[], order: string[], key: (item: T) => string): T[] {
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...items].sort((a, b) => (rank.get(key(a)) ?? order.length) - (rank.get(key(b)) ?? order.length));
}

export function readTableCharacters(table: CardTableData): CharacterData[] {
  const removed = new Set(table.removedCharacters?.map(({ id }) => id));
  const characters = [...generatedCharacters, ...(table.addedCharacters ?? [])].filter(({ id }) => !removed.has(id)).map((character) => ({
    ...character,
    ...table.chars[character.id],
    ...characterText[character.id],
    id: character.id,
  }));
  return sortByOrder(characters, table.order?.characters ?? [], ({ id }) => id);
}

export function readTableCards(table: CardTableData): CardData[] {
  const addedIds = new Set(table.added.map((card) => card.id));
  const removed = new Set(table.removedCards?.map(({ id }) => id));
  const cards = [
    ...generatedCards.filter(({ id }) => !addedIds.has(id) && !removed.has(id)).map((card) => ({
      ...card,
      ...table.overrides[card.id],
    })),
    ...table.added,
  ];
  return [...sortByOrder(cards, table.order?.cards ?? [], ({ id }) => id), ...table.exCards];
}
