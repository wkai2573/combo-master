import { describe, expect, it } from 'vitest';
import { ALL_CHARACTERS, getCharacter } from '../src/data/cards';
import { PRESET_CHARACTER_IDS } from '../src/data/presetDecks';
import { validateDeck } from '../src/deck/validate';
import { listDecks } from '../src/deck/storage';

describe('教學角色', () => {
  it('依 id 查得到，職業共用、沒有效果', () => {
    for (const id of ['見習生', '教官']) {
      const ch = getCharacter(id);
      expect(ch.id).toBe(id);
      expect(ch.cls).toBe('共用');
      expect(ch.text).toBe('沒有效果');
      expect(ch.pending).toBe(false);
    }
  });

  it('不出現在任何角色清單：角色表、預設牌組、牌組驗證、已存牌組', () => {
    const ids = ['見習生', '教官'];
    for (const id of ids) {
      expect(ALL_CHARACTERS.some((c) => c.id === id)).toBe(false);
      expect(PRESET_CHARACTER_IDS).not.toContain(id);
      expect(validateDeck(id, []).ok).toBe(false);
    }
    expect(listDecks().some((d) => ids.includes(d.charId))).toBe(false);
  });

  it('不認得的角色仍然丟錯', () => {
    expect(() => getCharacter('不存在')).toThrow('未知的角色');
  });
});
