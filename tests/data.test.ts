import { describe, expect, it } from 'vitest';
import { ALL_CARDS, ALL_CHARACTERS, getCard, PLAYABLE_CARDS } from '../src/data/cards';
import { ENABLED_EFFECT_CARDS, isVanilla } from '../src/data/enabledCards';
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

  it('弓箭手（遊俠）資料已補上，可以選用', () => {
    const ch = ALL_CHARACTERS.find((c) => c.cls === '弓箭手')!;
    expect(ch.name).toBe('遊俠');
    expect(ch.pending).toBe(false);
    expect(ch.hp).toBe(50);
    expect(validateDeck('遊俠', presetDeck('遊俠')).ok).toBe(true);
  });

  it('全部角色都有預設牌組、都沒有待補', () => {
    expect(ALL_CHARACTERS.filter((c) => c.pending)).toEqual([]);
    expect([...PRESET_CHARACTER_IDS].sort()).toEqual(ALL_CHARACTERS.map((c) => c.id).sort());
  });

  it('效果卡目前全部停用：卡池只剩 36 張花色招式', () => {
    expect(PLAYABLE_CARDS).toHaveLength(36);
    expect(PLAYABLE_CARDS.every((c) => isVanilla(c))).toBe(true);
    expect(ENABLED_EFFECT_CARDS).toEqual([]);
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

  it.each(PRESET_CHARACTER_IDS)('%s 的預設牌組只含花色招式、每個連擊值至少 3 張', (id) => {
    const cards = presetDeck(id).map(getCard);
    expect(cards.every((c) => isVanilla(c))).toBe(true);
    for (let n = 1; n <= 9; n++) expect(cards.filter((c) => c.combo === n).length, `連擊值 ${n}`).toBeGreaterThanOrEqual(3);
  });

  it('驗證會擋下錯誤牌組', () => {
    const deck = presetDeck('勇者');
    expect(validateDeck('勇者', deck.slice(1)).ok).toBe(false); // 49 張
    expect(validateDeck('勇者', [...deck.slice(0, 45), ...Array(5).fill('黑桃1')]).errors.join()).toContain('最多 4');
  });

  it('停用的效果卡不能放進牌組（即使職業符合）', () => {
    const deck = presetDeck('刺客');
    const r = validateDeck('刺客', [...deck.slice(0, 49), '陷阱3']);
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toContain('停用');
    expect(validateDeck('商人', [...presetDeck('商人').slice(0, 49), '快速治療']).ok).toBe(false);
  });
});
