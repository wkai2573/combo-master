import { describe, expect, it, vi } from 'vitest';
import { PRESET_CHARACTER_IDS, presetDeck } from '../src/data/presetDecks';
import { deleteDeck, discardCorruptDeck, inspectSavedDecks, listDecks, saveDeck } from '../src/deck/storage';

const KEY = 'lianji.decks.v1';

const memory = (initial?: string) => {
  const m = new Map<string, string>();
  if (initial !== undefined) m.set(KEY, initial);
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};
const broken = {
  getItem: () => { throw new Error('讀取失敗'); },
  setItem: () => { throw new Error('寫入失敗'); },
  removeItem: () => { throw new Error('刪除失敗'); },
};

const charId = PRESET_CHARACTER_IDS[0];
const good = { id: 'u1', name: '好牌組', charId, cards: presetDeck(charId) };
const STRUCT = '資料格式損壞（缺少 id，或 cards 不是陣列）';
const entry = (d: unknown, reason: string) => ({ kind: 'entry' as const, raw: JSON.stringify(d, null, 2), reason });

describe('損壞牌組：整份資料讀不進來', () => {
  it('沒有資料、儲存拋錯、沒有儲存：沒有牌組也沒有損壞項目', () => {
    expect(inspectSavedDecks(memory())).toEqual({ decks: [], corrupt: [] });
    expect(inspectSavedDecks(broken)).toEqual({ decks: [], corrupt: [] });
    expect(inspectSavedDecks(null)).toEqual({ decks: [], corrupt: [] });
  });

  it('不是合法 JSON：回報一筆整份損壞，附上原始字串', () => {
    const r = inspectSavedDecks(memory('{壞掉的'));
    expect(r.decks).toEqual([]);
    expect(r.corrupt).toEqual([{ kind: 'whole', raw: '{壞掉的', reason: '整份牌組資料無法讀取' }]);
  });

  it('合法 JSON 但不是陣列：同樣算整份損壞', () => {
    expect(inspectSavedDecks(memory('{"a":1}')).corrupt).toEqual([{ kind: 'whole', raw: '{"a":1}', reason: '整份牌組資料無法讀取' }]);
  });

  it('刪除整份損壞：清掉整個 key，之後不再回報', () => {
    const s = memory('{壞掉的');
    discardCorruptDeck({ kind: 'whole', raw: '{壞掉的', reason: '' }, s);
    expect(s.getItem(KEY)).toBeNull();
    expect(inspectSavedDecks(s)).toEqual({ decks: [], corrupt: [] });
  });
});

describe('損壞牌組：單筆結構損壞', () => {
  const bad1 = { id: 'u2', name: '缺牌' };
  const bad2 = { name: '缺 id', cards: [] };

  it('缺 id 或 cards 不是陣列的項目被分到損壞，好的牌組照常讀出', () => {
    const r = inspectSavedDecks(memory(JSON.stringify([good, bad1, bad2, null])));
    expect(r.decks).toEqual([good]);
    expect(r.corrupt).toEqual([entry(bad1, STRUCT), entry(bad2, STRUCT), entry(null, STRUCT)]);
  });

  it('刪除單筆損壞：只移除那一筆，好的牌組與其他損壞項目原樣保留', () => {
    const s = memory(JSON.stringify([good, bad1, bad2]));
    discardCorruptDeck(entry(bad1, STRUCT), s);
    expect(JSON.parse(s.getItem(KEY)!)).toEqual([good, bad2]);
    const r = inspectSavedDecks(s);
    expect(r.decks).toEqual([good]);
    expect(r.corrupt).toEqual([entry(bad2, STRUCT)]);
  });

  it('刪除時儲存壞掉不拋出', () => {
    expect(() => discardCorruptDeck({ kind: 'whole', raw: 'x', reason: '' }, broken)).not.toThrow();
    expect(() => discardCorruptDeck({ kind: 'entry', raw: 'x', reason: '' }, broken)).not.toThrow();
    expect(() => discardCorruptDeck({ kind: 'entry', raw: 'x', reason: '' }, null)).not.toThrow();
  });
});

describe('損壞牌組：含已不存在的卡片或角色', () => {
  const ghostCard = { id: 'u3', name: '舊牌組', charId, cards: [...good.cards.slice(1), '皮甲', '皮甲', '鐵甲'] };
  const ghostChar = { id: 'u4', name: '舊角色', charId: '已移除的角色', cards: good.cards };

  it('牌組含不存在的卡片：算失效，原因列出卡名（不重複），不出現在牌組列表', () => {
    const r = inspectSavedDecks(memory(JSON.stringify([good, ghostCard])));
    expect(r.decks).toEqual([good]);
    expect(r.corrupt).toEqual([entry(ghostCard, '含已不存在的卡片：皮甲、鐵甲')]);
  });

  it('牌組的角色不存在：算失效', () => {
    const r = inspectSavedDecks(memory(JSON.stringify([ghostChar])));
    expect(r.decks).toEqual([]);
    expect(r.corrupt).toEqual([entry(ghostChar, '角色已不存在：已移除的角色')]);
  });

  it('cards 裡有非字串的項目也算含不存在的卡片', () => {
    const odd = { id: 'u5', name: '怪', charId, cards: [1, null] };
    expect(inspectSavedDecks(memory(JSON.stringify([odd]))).corrupt).toEqual([entry(odd, '含已不存在的卡片：1、null')]);
  });

  it('其他驗證錯誤（張數不符）不算失效，仍在列表讓玩家在編輯器修', () => {
    const short = { id: 'u6', name: '少張', charId, cards: good.cards.slice(1) };
    const r = inspectSavedDecks(memory(JSON.stringify([short])));
    expect(r.decks).toEqual([short]);
    expect(r.corrupt).toEqual([]);
  });

  it('失效牌組不會出現在 listDecks，刪除後從儲存移除', () => {
    const s = memory(JSON.stringify([good, ghostCard]));
    vi.stubGlobal('localStorage', s);
    try {
      expect(listDecks().some((d) => d.id === 'u3')).toBe(false);
      discardCorruptDeck(inspectSavedDecks(s).corrupt[0], s);
      expect(JSON.parse(s.getItem(KEY)!)).toEqual([good]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('損壞牌組：刪除要精準、儲存不能吃掉損壞資料', () => {
  it('兩筆內容相同的損壞項目：刪除一筆只移除一筆', () => {
    const bad = { name: 'x' };
    const s = memory(JSON.stringify([bad, good, bad]));
    discardCorruptDeck(entry(bad, STRUCT), s);
    expect(JSON.parse(s.getItem(KEY)!)).toEqual([good, bad]);
  });

  it('整份損壞的項目已過期（儲存內容已被改寫）：不刪除現在的資料', () => {
    const s = memory(JSON.stringify([good]));
    discardCorruptDeck({ kind: 'whole', raw: '{壞掉的', reason: '' }, s);
    expect(JSON.parse(s.getItem(KEY)!)).toEqual([good]);
  });

  it('儲存或刪除牌組時，損壞的資料原樣保留，仍會被回報', () => {
    const bad = { id: 'u9', name: '缺牌' };
    const ghost = { id: 'u8', name: '舊牌組', charId, cards: ['皮甲'] };
    const s = memory(JSON.stringify([good, bad, ghost]));
    vi.stubGlobal('localStorage', s);
    try {
      const saved = saveDeck({ name: '新牌組', charId, cards: good.cards });
      expect(inspectSavedDecks(s).corrupt).toEqual([entry(bad, STRUCT), entry(ghost, '含已不存在的卡片：皮甲')]);
      deleteDeck(saved.id);
      const r = inspectSavedDecks(s);
      expect(r.decks).toEqual([good]);
      expect(r.corrupt).toEqual([entry(bad, STRUCT), entry(ghost, '含已不存在的卡片：皮甲')]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
