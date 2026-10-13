import { describe, expect, it, vi } from 'vitest';
import { deleteDeck, discardCorruptDeck, inspectSavedDecks, saveDeck } from '../src/deck/storage';

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

const good = { id: 'u1', name: '好牌組', charId: '劍士', cards: ['a', 'b'] };

describe('損壞牌組：整份資料讀不進來', () => {
  it('沒有資料、儲存拋錯、沒有儲存：沒有牌組也沒有損壞項目', () => {
    expect(inspectSavedDecks(memory())).toEqual({ decks: [], corrupt: [] });
    expect(inspectSavedDecks(broken)).toEqual({ decks: [], corrupt: [] });
    expect(inspectSavedDecks(null)).toEqual({ decks: [], corrupt: [] });
  });

  it('不是合法 JSON：回報一筆整份損壞，附上原始字串', () => {
    const r = inspectSavedDecks(memory('{壞掉的'));
    expect(r.decks).toEqual([]);
    expect(r.corrupt).toEqual([{ kind: 'whole', raw: '{壞掉的' }]);
  });

  it('合法 JSON 但不是陣列：同樣算整份損壞', () => {
    expect(inspectSavedDecks(memory('{"a":1}')).corrupt).toEqual([{ kind: 'whole', raw: '{"a":1}' }]);
  });

  it('刪除整份損壞：清掉整個 key，之後不再回報', () => {
    const s = memory('{壞掉的');
    discardCorruptDeck({ kind: 'whole', raw: '{壞掉的' }, s);
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
    expect(r.corrupt).toEqual([
      { kind: 'entry', raw: JSON.stringify(bad1, null, 2) },
      { kind: 'entry', raw: JSON.stringify(bad2, null, 2) },
      { kind: 'entry', raw: 'null' },
    ]);
  });

  it('刪除單筆損壞：只移除那一筆，好的牌組與其他損壞項目原樣保留', () => {
    const s = memory(JSON.stringify([good, bad1, bad2]));
    discardCorruptDeck({ kind: 'entry', raw: JSON.stringify(bad1, null, 2) }, s);
    expect(JSON.parse(s.getItem(KEY)!)).toEqual([good, bad2]);
    const r = inspectSavedDecks(s);
    expect(r.decks).toEqual([good]);
    expect(r.corrupt).toEqual([{ kind: 'entry', raw: JSON.stringify(bad2, null, 2) }]);
  });

  it('刪除時儲存壞掉不拋出', () => {
    expect(() => discardCorruptDeck({ kind: 'whole', raw: 'x' }, broken)).not.toThrow();
    expect(() => discardCorruptDeck({ kind: 'entry', raw: 'x' }, broken)).not.toThrow();
    expect(() => discardCorruptDeck({ kind: 'entry', raw: 'x' }, null)).not.toThrow();
  });
});

describe('損壞牌組：刪除要精準、儲存不能吃掉損壞資料', () => {
  it('兩筆內容相同的損壞項目：刪除一筆只移除一筆', () => {
    const bad = { name: 'x' };
    const s = memory(JSON.stringify([bad, good, bad]));
    discardCorruptDeck({ kind: 'entry', raw: JSON.stringify(bad, null, 2) }, s);
    expect(JSON.parse(s.getItem(KEY)!)).toEqual([good, bad]);
  });

  it('整份損壞的項目已過期（儲存內容已被改寫）：不刪除現在的資料', () => {
    const s = memory(JSON.stringify([good]));
    discardCorruptDeck({ kind: 'whole', raw: '{壞掉的' }, s);
    expect(JSON.parse(s.getItem(KEY)!)).toEqual([good]);
  });

  it('儲存或刪除牌組時，單筆損壞的資料原樣保留，仍會被回報', () => {
    const bad = { id: 'u9', name: '缺牌' };
    const s = memory(JSON.stringify([good, bad]));
    vi.stubGlobal('localStorage', s);
    try {
      const saved = saveDeck({ name: '新牌組', charId: '劍士', cards: ['a'] });
      expect(inspectSavedDecks(s).corrupt).toEqual([{ kind: 'entry', raw: JSON.stringify(bad, null, 2) }]);
      deleteDeck(saved.id);
      const r = inspectSavedDecks(s);
      expect(r.decks).toEqual([good]);
      expect(r.corrupt).toEqual([{ kind: 'entry', raw: JSON.stringify(bad, null, 2) }]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
