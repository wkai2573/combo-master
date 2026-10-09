import { describe, expect, it } from 'vitest';
import { ALL_CARDS, getCard } from '../src/data/cards';
import { CLASS_COLOR, KIND_COLOR, cardBorderColor, cardColor } from '../src/ui/cardColor';

describe('卡面顏色：外框看職業，底色看卡種', () => {
  it('每張卡的外框是自己職業的顏色，共用是灰色', () => {
    for (const c of ALL_CARDS) {
      if (c.id.startsWith('Ex卡-')) continue;
      expect(cardBorderColor(c)).toBe(CLASS_COLOR[c.cls]);
    }
    expect(CLASS_COLOR.共用).toBe('#8a93a8');
  });

  it('同職業的不同卡種外框相同、底色不同', () => {
    const a = ALL_CARDS.find((c) => c.cls === '劍士' && c.kind === 'move')!;
    const b = ALL_CARDS.find((c) => c.cls === '劍士' && c.kind === 'equip')!;
    expect(cardBorderColor(a)).toBe(cardBorderColor(b));
    expect(cardColor(a)).not.toBe(cardColor(b));
  });

  it('Ex 卡外框與底色都是 Ex 青色，不看職業', () => {
    const ex = getCard('Ex卡-中毒');
    expect(cardBorderColor(ex)).toBe(KIND_COLOR.ex);
    expect(cardColor(ex)).toBe(KIND_COLOR.ex);
  });
});
