import { cardTable } from '../data/cardTableData';
import type { CardData, ClassName, EquipSlot } from '../data/types';
import initial from './game-faces.json';
import { parseFaceLibrary } from './library';
import { templateFor, type FaceCard, type FaceImageLayer } from './model';

export const gameFaces = parseFaceLibrary(initial);

const portraits = import.meta.glob<string>('../../assets/portraits/*.webp', { query: '?url', import: 'default', eager: true });
const moveFrames = import.meta.glob<string>('../../assets/frames/move/*.webp', { query: '?url', import: 'default', eager: true });
const equipmentFrames = import.meta.glob<string>('../../assets/frames/equipment/*.webp', { query: '?url', import: 'default', eager: true });
const exFrames = import.meta.glob<string>('../../assets/frames/ex/*.webp', { query: '?url', import: 'default', eager: true });
const uidById = new Map(Object.entries(cardTable.uids)
  .filter(([uid]) => /^[AEBX]/.test(uid)).map(([uid, id]) => [id, uid]));

const classSlug: Record<ClassName, string> = {
  共用: 'neutral', 劍士: 'swordswoman', 盜賊: 'rogue', 商人: 'merchant', 弓箭手: 'archer', 法師: 'mage',
};
const frameName: Record<ClassName, string> = {
  共用: '通用', 劍士: '劍士', 盜賊: '盜賊', 商人: '商人', 弓箭手: '遊俠', 法師: '法師',
};
const slots: Record<EquipSlot, string> = { 武器: 'weapon', 防具: 'armor', 飾品: 'accessory' };

export function imageFor(layer: FaceImageLayer, uid: string, card: CardData, content: FaceCard): string | undefined {
  const upload = content.images?.[layer.id];
  if (typeof upload === 'string') return upload;
  if (layer.source === 'art') return portraits['../../assets/portraits/' + uid + '.webp'];
  if (layer.source === 'frame') {
    if (content.template === 'ex-move') return exFrames['../../assets/frames/ex/move.webp'];
    if (content.template === 'ex-buff') return exFrames['../../assets/frames/ex/buff.webp'];
    const slug = classSlug[card.cls];
    if (card.kind === 'equip' && card.slot) return equipmentFrames['../../assets/frames/equipment/' + slug + '-' + slots[card.slot] + '.webp'];
    if (card.kind === 'move') return moveFrames['../../assets/frames/move/' + slug + '-' + frameName[card.cls] + '.webp'];
  }
}

export function gameFaceFor(id: string) {
  const uid = uidById.get(id);
  if (!uid) return undefined;
  const content = gameFaces.cards[uid];
  if (!content) return undefined;
  const template = templateFor(gameFaces, content);
  if (template) return { uid, content, template };
}
