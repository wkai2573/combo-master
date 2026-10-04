import { ALL_CARDS, ALL_CHARACTERS } from '../data/cards';

export const MAX_COPIES = 4;

export interface DeckCheck {
  ok: boolean;
  errors: string[];
}

/** 驗證牌組：角色可用、張數＝生命值、同名≤4、卡片職業合法 */
export function validateDeck(charId: string, cards: string[]): DeckCheck {
  const errors: string[] = [];
  const ch = ALL_CHARACTERS.find((c) => c.id === charId);
  if (!ch) return { ok: false, errors: [`未知的角色：${charId}`] };
  if (ch.pending) errors.push(`${ch.name} 的資料尚未補齊，不能使用`);

  const byName = new Map<string, number>();
  for (const id of cards) byName.set(id, (byName.get(id) ?? 0) + 1);

  if (!ch.pending && cards.length !== ch.hp) {
    errors.push(`牌組需為 ${ch.hp} 張（目前 ${cards.length} 張）`);
  }
  for (const [id, n] of byName) {
    const card = ALL_CARDS.find((c) => c.id === id);
    if (!card) {
      errors.push(`未知的卡片：${id}`);
      continue;
    }
    if (n > MAX_COPIES) errors.push(`【${id}】最多 ${MAX_COPIES} 張（目前 ${n} 張）`);
    if (card.cls !== '共用' && card.cls !== ch.cls) {
      errors.push(`【${id}】是${card.cls}專用卡，${ch.name}不能使用`);
    }
  }
  return { ok: errors.length === 0, errors };
}
