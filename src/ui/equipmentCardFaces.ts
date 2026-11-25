import { getCard } from '../data/cards';
import { cardTable } from '../data/cardTableData';
import type { CardData } from '../data/types';

const images = import.meta.glob<string>('./equipment-card-faces/E*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
});

const equipmentFaces = new Map<string, string>();
for (const [uid, id] of Object.entries(cardTable.uids)) {
  const image = images[`./equipment-card-faces/${uid}.webp`];
  if (image) equipmentFaces.set(id, image);
}

/** 卡表草稿改到圖內資訊時，改用即時卡文預覽。 */
export function equipmentCardFace(card: CardData): string | undefined {
  const image = card.kind === 'equip' ? equipmentFaces.get(card.id) : undefined;
  if (!image) return undefined;
  const base = getCard(card.id);
  if (
    card.name === base.name && card.cls === base.cls && card.slot === base.slot &&
    card.expReq === base.expReq && card.text === base.text &&
    card.traits.length === base.traits.length && card.traits.every((trait, i) => trait === base.traits[i])
  ) return image;
  return undefined;
}
