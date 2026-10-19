import { describe, expect, it } from 'vitest';
import { KNOWN_CHARACTERS } from '../server/src/characters';
import { ALL_CHARACTERS, getCard, getCharacter } from '../src/data/cards';
import { Game } from '../src/engine/game';
import { newCard } from '../src/engine/ops';
import { viewFor } from '../src/engine/view';
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

describe('教學角色：修行者', () => {
  it('依 id 查得到：職業共用、覺醒經驗 8、效果欄沒有效果、覺醒欄是總攻擊 +2', () => {
    const ch = getCharacter('修行者');
    expect(ch.cls).toBe('共用');
    expect(ch.expReq).toBe(8);
    expect(ch.text).toBe('沒有效果');
    expect(ch.awakenText).toBe('（追加）我方總攻擊 +2');
    expect(ch.pending).toBe(false);
  });

  it('不出現在任何角色清單：角色表、預設牌組、牌組驗證、已存牌組、戰績的已知角色', () => {
    expect(ALL_CHARACTERS.some((c) => c.id === '修行者')).toBe(false);
    expect(PRESET_CHARACTER_IDS).not.toContain('修行者');
    expect(validateDeck('修行者', []).ok).toBe(false);
    expect(listDecks().some((d) => d.charId === '修行者')).toBe(false);
    expect(KNOWN_CHARACTERS).not.toContain('修行者');
  });

  // 引擎的視角：玩家視角裡的總攻擊（players[p].atk）就是畫面上的總攻擊
  const totalAtk = (expCount: number) => {
    const g = new Game({
      decks: [{ charId: '修行者', cards: Array(30).fill('黑桃1') }, { charId: '教官', cards: Array(30).fill('黑桃1') }],
      first: 0, seed: 1, noShuffle: true, startPhase: '先手',
      afterSetup: (c) => {
        const pl = c.state.players[0].zones;
        pl.hand = [];
        pl.exp = [];
        for (let i = 0; i < expCount; i++) newCard(c, '黑桃1', 0, 'exp');
        newCard(c, '黑桃3', 0, 'moves');
      },
    });
    return { atk: viewFor(g, 0).players[0].atk, card: getCard('黑桃3').atk };
  };

  it('覺醒中（經驗區達 8 張）總攻擊 +2；沒覺醒時沒有加成', () => {
    const awake = totalAtk(8);
    const sleeping = totalAtk(7);
    expect(sleeping.atk).toBe(sleeping.card);
    expect(awake.atk).toBe(awake.card + 2);
  });

  it('加成是數值，不是事件：覺醒時不彈任何提示', () => {
    const g = new Game({
      decks: [{ charId: '修行者', cards: Array(30).fill('黑桃1') }, { charId: '教官', cards: Array(30).fill('黑桃1') }],
      first: 0, seed: 1, noShuffle: true, startPhase: '爆發',
      afterSetup: (c) => {
        c.state.players[0].zones.exp = [];
        for (let i = 0; i < 7; i++) newCard(c, '黑桃1', 0, 'exp');
      },
    });
    // 爆發階段放進第 8 張而覺醒：之後直接是對手的爆發提示，中間沒有任何覺醒效果的窗口
    g.submit(0, [g.pending!.options[0].key]);
    expect(g.pending!.title).toContain('爆發階段');
    expect(g.pending!.player).toBe(1);
  });
});
