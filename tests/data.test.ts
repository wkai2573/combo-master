import { describe, expect, it } from 'vitest';
import { ALL_CARDS, ALL_CHARACTERS, getCard } from '../src/data/cards';
import { presetDeck, PRESET_CHARACTER_IDS } from '../src/data/presetDecks';
import { validateDeck } from '../src/deck/validate';

describe('卡表資料', () => {
  it('卡片數量符合 docs', () => {
    expect(ALL_CARDS.filter((c) => c.kind === 'move')).toHaveLength(63);
    expect(ALL_CARDS.filter((c) => c.kind === 'equip')).toHaveLength(3);
    expect(ALL_CARDS.filter((c) => c.kind === 'buff')).toHaveLength(2);
  });

  it('招式連擊值在 1~9', () => {
    for (const c of ALL_CARDS.filter((c) => c.kind === 'move')) {
      expect(c.combo, c.id).toBeGreaterThanOrEqual(1);
      expect(c.combo, c.id).toBeLessThanOrEqual(9);
    }
  });

  it('弓箭手是待補角色', () => {
    expect(ALL_CHARACTERS.find((c) => c.cls === '弓箭手')?.pending).toBe(true);
    expect(validateDeck('弓箭手（待補）', []).ok).toBe(false);
  });

  it('特殊招式都有職業歸屬或共用', () => {
    expect(getCard('陷阱3').cls).toBe('盜賊');
    expect(getCard('快速治療').cls).toBe('共用');
    expect(getCard('黑桃1').cls).toBe('共用');
  });
});

describe('預設牌組', () => {
  it.each(PRESET_CHARACTER_IDS)('%s 的預設牌組合法', (id) => {
    const deck = presetDeck(id);
    const r = validateDeck(id, deck);
    expect(r.errors).toEqual([]);
    expect(deck).toHaveLength(50);
  });

  it.each(PRESET_CHARACTER_IDS)('%s 的預設牌組涵蓋連擊值 1~9', (id) => {
    const combos = new Set(presetDeck(id).map(getCard).filter((c) => c.kind === 'move').map((c) => c.combo));
    for (let n = 1; n <= 9; n++) expect(combos.has(n), `缺少連擊值 ${n}`).toBe(true);
  });

  it('驗證會擋下錯誤牌組', () => {
    const deck = presetDeck('勇者');
    expect(validateDeck('勇者', deck.slice(1)).ok).toBe(false); // 49 張
    expect(validateDeck('勇者', [...deck.slice(0, 49), '陷阱3']).errors.join()).toContain('盜賊專用');
    expect(validateDeck('勇者', [...deck.slice(0, 45), ...Array(5).fill('黑桃1')]).errors.join()).toContain('最多 4');
  });
});
