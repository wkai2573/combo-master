import type { CardData, CardKind } from './types';

export type CardScope = 'all' | 'class' | 'common';

export function matchesCard(card: CardData, kind: 'all' | CardKind, combo: number, scope: CardScope, query: string): boolean {
  return (kind === 'all' || card.kind === kind)
    && (combo === 0 || (card.kind === 'move' && card.combo === combo))
    && (scope === 'all' || (scope === 'common' ? card.cls === '共用' : card.cls !== '共用'))
    && (!query || card.name.includes(query) || card.text.includes(query) || card.traits.some((trait) => trait.includes(query)));
}
