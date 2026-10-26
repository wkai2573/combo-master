import { describe, expect, it } from 'vitest';
import { presetDeck } from '../src/data/presetDecks';
import { checkInvariants, playOut } from '../src/engine/bot';
import { Game } from '../src/engine/game';
import { newCard, Z } from '../src/engine/ops';
import { Rng } from '../src/engine/rng';
import { scenario } from './helpers';

const counts = (g: Game): [number, number] => [0, 1].map((p) =>
  (Object.values(g.state.players[p].zones) as Array<Array<{ id: string }>>).flat().filter((c) => !c.id.startsWith('Ex-')).length) as [number, number];

describe('壓測用的卡片守恆檢查', () => {
  it('Ex 卡不算牌組的卡片總數，但只能待在它登記的區域（經驗區或增益區）', () => {
    const g = scenario({ p0: { exp: ['黑桃3'] } });
    const expected = counts(g);
    newCard(g, 'Ex-流血', 0, 'exp');
    newCard(g, 'Ex-中毒', 0, 'exp');
    expect(() => checkInvariants(g, expected)).not.toThrow();

    const bad = newCard(g, 'Ex-流血', 0, 'hand');
    expect(() => checkInvariants(g, expected)).toThrow('不在經驗區');
    Z(g, 0, 'hand').splice(Z(g, 0, 'hand').indexOf(bad), 1);
    expect(() => checkInvariants(g, expected)).not.toThrow();

    // 增益區的 Ex-狂怒是對的位置，放在經驗區反而不對
    const rage = newCard(g, 'Ex-狂怒', 0, 'buff');
    expect(() => checkInvariants(g, expected)).not.toThrow();
    Z(g, 0, 'buff').splice(Z(g, 0, 'buff').indexOf(rage), 1);
    newCard(g, 'Ex-狂怒', 0, 'exp');
    expect(() => checkInvariants(g, expected)).toThrow('不在增益區');
  });

  it('刺客（會把 Ex 卡放進對方經驗區）和塗毒的對局都能跑完，沒有違反守恆', () => {
    for (const [a, b] of [['刺客', '勇者'], ['勇者', '刺客'], ['刺客', '刺客']] as const) {
      for (let seed = 1; seed <= 6; seed++) {
        const decks = [{ charId: a, cards: presetDeck(a) }, { charId: b, cards: presetDeck(b) }] as const;
        const game = new Game({ decks: [decks[0], decks[1]], seed: seed * 7919 });
        const r = playOut(game, new Rng(seed), [decks[0].cards.length, decks[1].cards.length]);
        expect(r.finished, `${a} vs ${b} seed=${seed}`).toBe(true);
      }
    }
  });
});

describe('新卡（嘲諷、生命偷取、生命藥水、公開資訊）的對局壓測', () => {
  it('牌組裡塞了新卡的對局都能跑完，沒有卡死也沒有違反守恆', () => {
    const NEW = ['嘲諷', '生命偷取', '生命藥水', '公開資訊'];
    for (const [a, b] of [['勇者', '遊俠'], ['商人', '刺客'], ['法師', '先人']] as const) {
      for (let seed = 1; seed <= 8; seed++) {
        const mk = (charId: string) => {
          const cards = presetDeck(charId);
          const out = [...cards];
          // 把牌組最前面的 8 張換成新卡，每種各 2 張
          for (let i = 0; i < 8; i++) out[i] = NEW[i % NEW.length];
          return { charId, cards: out };
        };
        const decks = [mk(a), mk(b)] as const;
        const game = new Game({ decks: [decks[0], decks[1]], seed: seed * 104729 });
        const r = playOut(game, new Rng(seed), [decks[0].cards.length, decks[1].cards.length]);
        expect(r.finished, `${a} vs ${b} seed=${seed}`).toBe(true);
      }
    }
  });
});

describe('卡表更新批次（箭雨、天譴之箭、穿雲箭）的對局壓測', () => {
  it('牌組裡塞了新卡的對局，隨機與啟發式電腦都能跑完，沒有卡死也沒有違反守恆', () => {
    const NEW = ['箭雨', '天譴之箭', '穿雲箭', '魅影射擊', '二連矢'];
    for (const mode of ['mode1', 'mode2'] as const) {
      for (const [a, b] of [['遊俠', '勇者'], ['勇者', '遊俠'], ['遊俠', '遊俠']] as const) {
        for (let seed = 1; seed <= 6; seed++) {
          const mk = (charId: string) => {
            const out = [...presetDeck(charId)];
            // 把牌組最前面的 10 張換成新卡（職業不符的牌組也只是測試用，引擎不驗證牌組）
            for (let i = 0; i < 10; i++) out[i] = NEW[i % NEW.length];
            return { charId, cards: out };
          };
          const decks = [mk(a), mk(b)] as const;
          const game = new Game({ decks: [decks[0], decks[1]], seed: seed * 7907 });
          const r = playOut(game, new Rng(seed), [decks[0].cards.length, decks[1].cards.length], { mode });
          expect(r.finished, `${mode} ${a} vs ${b} seed=${seed}`).toBe(true);
        }
      }
    }
  });
});

describe('卡表更新批次（捕熊陷阱、作假帳、煉金印記、冰茅、威嚇戰吼）的對局壓測', () => {
  it('牌組裡塞了新卡的對局，隨機與啟發式電腦都能跑完，沒有卡死也沒有違反守恆', () => {
    const NEW = ['捕熊陷阱', '作假帳', '煉金印記', '冰茅', '威嚇戰吼'];
    for (const mode of ['mode1', 'mode2'] as const) {
      for (const [a, b] of [['商人', '勇者'], ['勇者', '法師'], ['法師', '商人'], ['商人', '商人']] as const) {
        for (let seed = 1; seed <= 6; seed++) {
          const mk = (charId: string) => {
            const out = [...presetDeck(charId)];
            // 把牌組最前面的 10 張換成新卡（職業不符的牌組也只是測試用，引擎不驗證牌組）
            for (let i = 0; i < 10; i++) out[i] = NEW[i % NEW.length];
            return { charId, cards: out };
          };
          const decks = [mk(a), mk(b)] as const;
          const game = new Game({ decks: [decks[0], decks[1]], seed: seed * 7907 });
          const r = playOut(game, new Rng(seed), [decks[0].cards.length, decks[1].cards.length], { mode });
          expect(r.finished, `${mode} ${a} vs ${b} seed=${seed}`).toBe(true);
        }
      }
    }
  });
});

describe('卡表更新批次（聖獸白虎、聖獸玄武、煙霧陷阱、冰凍陷阱、毒藥）的對局壓測', () => {
  it('牌組裡塞了新卡的對局，隨機與啟發式電腦都能跑完，沒有卡死也沒有違反守恆', () => {
    const NEW = ['聖獸白虎', '聖獸玄武', '煙霧陷阱', '冰凍陷阱', '毒藥', '塗毒', '生命藥水'];
    for (const mode of ['mode1', 'mode2'] as const) {
      for (const [a, b] of [['法師', '刺客'], ['刺客', '勇者'], ['法師', '法師'], ['刺客', '刺客']] as const) {
        for (let seed = 1; seed <= 6; seed++) {
          const mk = (charId: string) => {
            const out = [...presetDeck(charId)];
            // 把牌組最前面的 12 張換成新卡（職業不符的牌組也只是測試用，引擎不驗證牌組）
            for (let i = 0; i < 12; i++) out[i] = NEW[i % NEW.length];
            return { charId, cards: out };
          };
          const decks = [mk(a), mk(b)] as const;
          const game = new Game({ decks: [decks[0], decks[1]], seed: seed * 7907 });
          const r = playOut(game, new Rng(seed), [decks[0].cards.length, decks[1].cards.length], { mode });
          expect(r.finished, `${mode} ${a} vs ${b} seed=${seed}`).toBe(true);
        }
      }
    }
  });
});

describe('機器人決策模式壓測（playOut mode2 與跨模式）', () => {
  it('雙方皆採用 mode2 的對局能跑完，沒有卡死也沒有違反守恆', () => {
    for (const [a, b] of [['勇者', '刺客'], ['刺客', '遊俠']] as const) {
      for (let seed = 1; seed <= 3; seed++) {
        const decks = [{ charId: a, cards: presetDeck(a) }, { charId: b, cards: presetDeck(b) }] as const;
        const game = new Game({ decks: [decks[0], decks[1]], seed: seed * 7919 });
        const r = playOut(game, new Rng(seed), [decks[0].cards.length, decks[1].cards.length], { mode: 'mode2' });
        expect(r.finished, `${a} vs ${b} seed=${seed}`).toBe(true);
      }
    }
  });

  it('跨模式（mode1 vs mode2）對局能正常跑完', () => {
    for (const [a, b] of [['勇者', '刺客'], ['法師', '商人']] as const) {
      for (let seed = 1; seed <= 2; seed++) {
        const decks = [{ charId: a, cards: presetDeck(a) }, { charId: b, cards: presetDeck(b) }] as const;
        const game = new Game({ decks: [decks[0], decks[1]], seed: seed * 104729 });
        const r = playOut(game, new Rng(seed), [decks[0].cards.length, decks[1].cards.length], { modes: ['mode1', 'mode2'] });
        expect(r.finished, `${a}(mode1) vs ${b}(mode2) seed=${seed}`).toBe(true);
      }
    }
  });
});

describe('卡表更新批次（盛怒漩渦、狂戰）的對局壓測', () => {
  it('牌組裡塞了新卡的對局，隨機與啟發式電腦都能跑完，沒有卡死也沒有違反守恆', () => {
    const NEW = ['盛怒漩渦', '狂戰', '威嚇戰吼', '盾擊', '戒備打擊', '洩憤'];
    for (const mode of ['mode1', 'mode2'] as const) {
      for (const [a, b] of [['勇者', '刺客'], ['後人', '勇者'], ['勇者', '勇者'], ['後人', '法師']] as const) {
        for (let seed = 1; seed <= 6; seed++) {
          const mk = (charId: string) => {
            const out = [...presetDeck(charId)];
            // 把牌組最前面的 12 張換成新卡（職業不符的牌組也只是測試用，引擎不驗證牌組）
            for (let i = 0; i < 12; i++) out[i] = NEW[i % NEW.length];
            return { charId, cards: out };
          };
          const decks = [mk(a), mk(b)] as const;
          const game = new Game({ decks: [decks[0], decks[1]], seed: seed * 7907 });
          const r = playOut(game, new Rng(seed), [decks[0].cards.length, decks[1].cards.length], { mode });
          expect(r.finished, `${mode} ${a} vs ${b} seed=${seed}`).toBe(true);
        }
      }
    }
  });
});
