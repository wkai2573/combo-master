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
  it('Ex 卡不算牌組的卡片總數，但只能待在經驗區', () => {
    const g = scenario({ p0: { exp: ['黑桃3'] } });
    const expected = counts(g);
    newCard(g, 'Ex-流血', 0, 'exp');
    newCard(g, 'Ex-中毒', 0, 'exp');
    expect(() => checkInvariants(g, expected)).not.toThrow();

    const bad = newCard(g, 'Ex-流血', 0, 'hand');
    expect(() => checkInvariants(g, expected)).toThrow('不在經驗區');
    Z(g, 0, 'hand').splice(Z(g, 0, 'hand').indexOf(bad), 1);
    expect(() => checkInvariants(g, expected)).not.toThrow();
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
