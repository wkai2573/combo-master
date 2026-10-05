import { describe, expect, it } from 'vitest';
import { ALL_CARDS, ALL_CHARACTERS, getCard, PLAYABLE_CARDS } from '../src/data/cards';
import { ENABLED_EFFECT_CARDS, isCardEnabled, isVanilla } from '../src/data/enabledCards';
import { presetDeck, PRESET_CHARACTER_IDS } from '../src/data/presetDecks';
import { validateDeck } from '../src/deck/validate';

describe('卡表資料', () => {
  it('卡片數量：36 張花色招式（xlsx）；其餘都是卡表新增的新卡與裝備', () => {
    expect(ALL_CARDS.filter((c) => isVanilla(c))).toHaveLength(36);
    expect(ALL_CARDS.filter((c) => c.kind === 'equip').length).toBeGreaterThanOrEqual(5);
    expect(new Set(ALL_CARDS.map((c) => c.id)).size).toBe(ALL_CARDS.length); // 卡名不重複
  });

  it('招式連擊值在 1~9', () => {
    for (const c of ALL_CARDS.filter((c) => c.kind === 'move' && !c.id.startsWith('Ex卡-'))) {
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

  it('效果卡逐張開放：卡池＝36 張花色招式＋已開放的效果卡', () => {
    expect(PLAYABLE_CARDS).toHaveLength(36 + ENABLED_EFFECT_CARDS.length);
    for (const id of ENABLED_EFFECT_CARDS) expect(ALL_CARDS.some((c) => c.id === id), id).toBe(true);
    expect(PLAYABLE_CARDS.filter((c) => !isVanilla(c)).map((c) => c.id).sort()).toEqual([...ENABLED_EFFECT_CARDS].sort());
    // 每個職業都有開放的新卡
    const classes = new Set(ENABLED_EFFECT_CARDS.map((id) => getCard(id).cls));
    for (const cls of ['劍士', '盜賊', '商人', '法師', '弓箭手']) expect(classes.has(cls as never), cls).toBe(true);
  });

  it('Ex 卡不能放進牌組', () => {
    expect(PLAYABLE_CARDS.some((c) => c.id.startsWith('Ex卡-'))).toBe(false);
  });

  it('卡表新卡的職業與文字', () => {
    expect(getCard('戒備打擊').cls).toBe('劍士');
    expect(getCard('戒備打擊').text).toContain('總防禦 +2');
    expect(getCard('力量爆破').text).toContain('總攻擊 −3');
    expect(getCard('狙擊印記').cls).toBe('弓箭手');
    expect(getCard('黑桃1').cls).toBe('共用');
  });

  it('每張卡都有職業', () => {
    const classes = ['共用', '劍士', '盜賊', '商人', '弓箭手', '法師'];
    for (const c of ALL_CARDS) expect(classes, c.id).toContain(c.cls);
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

  it.each(PRESET_CHARACTER_IDS)('%s 的預設牌組只含開放的卡、每個連擊值至少 3 張', (id) => {
    const cards = presetDeck(id).map(getCard);
    expect(cards.every((c) => isCardEnabled(c))).toBe(true);
    for (let n = 1; n <= 9; n++) expect(cards.filter((c) => c.combo === n).length, `連擊值 ${n}`).toBeGreaterThanOrEqual(3);
  });

  it('驗證會擋下錯誤牌組', () => {
    const deck = presetDeck('勇者');
    expect(validateDeck('勇者', deck.slice(1)).ok).toBe(false); // 49 張
    expect(validateDeck('勇者', [...deck.slice(0, 45), ...Array(5).fill('黑桃1')]).errors.join()).toContain('最多 4');
  });

  it('不在開放清單的效果卡不能放進牌組（即使職業符合）', () => {
    const deck = presetDeck('法師');
    expect(validateDeck('法師', [...deck.slice(0, 49), '電弧']).ok).toBe(true); // 開放中
    const i = ENABLED_EFFECT_CARDS.indexOf('電弧');
    ENABLED_EFFECT_CARDS.splice(i, 1); // 暫時關掉
    try {
      const r = validateDeck('法師', [...deck.slice(0, 49), '電弧']);
      expect(r.ok).toBe(false);
      expect(r.errors.join()).toContain('停用');
    } finally {
      ENABLED_EFFECT_CARDS.splice(i, 0, '電弧');
    }
  });
});
