import { describe, expect, it } from 'vitest';
import { getCard } from '../src/data/cards';
import { ENABLED_EFFECT_CARDS } from '../src/data/enabledCards';
import { presetDeck } from '../src/data/presetDecks';
import { totalAtk } from '../src/engine/combat';
import { hasEffect } from '../src/engine/effects';
import { draw, move, Z } from '../src/engine/ops';
import { atkOf, drive, pass, pick, scenario, setZones } from './helpers';

const hands = (n: number) => Array(n).fill('黑桃2') as string[];

/** 玩家 0（法師）的招式卡疊，雙方手牌各有指定張數 */
const nova = (moves: string[], mine: number, foe: number, extra: { pursuit?: string[] } = {}) => {
  const g = scenario({ chars: ['法師', '勇者'] });
  setZones(g, 0, { moves, hand: hands(mine), ...extra });
  setZones(g, 1, { hand: hands(foe) });
  return g;
};

describe('閃電新星：卡表資料與登記', () => {
  it('閃電新星是法師招式 5／0／4（法術、電）已開放，有效果來源', () => {
    expect(getCard('閃電新星')).toMatchObject({ cls: '法師', kind: 'move', atk: 5, def: 0, combo: 4, traits: ['法術', '電'] });
    expect(ENABLED_EFFECT_CARDS).toContain('閃電新星');
    expect(hasEffect('閃電新星')).toBe(true);
  });

  it('預設牌組：法師放 3 張閃電新星，其他職業沒有', () => {
    expect(presetDeck('法師').filter((c) => c === '閃電新星')).toHaveLength(3);
    for (const id of ['勇者', '後人', '刺客', '先人', '商人', '遊俠']) expect(presetDeck(id)).not.toContain('閃電新星');
  });
});

describe('閃電新星 [頂]：我方 +X+0，X＝我方手牌數量 − 對方手牌數量，最低為 0', () => {
  it('X 是雙方手牌差', () => {
    expect(totalAtk(nova(['閃電新星'], 5, 2), 0)).toBe(atkOf('閃電新星') + 3);
    expect(totalAtk(nova(['閃電新星'], 7, 0), 0)).toBe(atkOf('閃電新星') + 7);
  });

  it('我方手牌比對方少或相等時 X 為 0，不會變成減攻', () => {
    expect(totalAtk(nova(['閃電新星'], 3, 3), 0)).toBe(atkOf('閃電新星'));
    expect(totalAtk(nova(['閃電新星'], 1, 6), 0)).toBe(atkOf('閃電新星'));
    expect(totalAtk(nova(['閃電新星'], 0, 4), 0)).toBe(atkOf('閃電新星'));
  });

  it('只有位於招式卡疊最上方才有效：被疊在下面或成為追擊卡都沒有加成', () => {
    expect(totalAtk(nova(['黑桃1', '閃電新星'], 5, 0), 0)).toBe(atkOf('黑桃1') + atkOf('閃電新星') + 5);
    expect(totalAtk(nova(['閃電新星', '黑桃1'], 5, 0), 0)).toBe(atkOf('閃電新星') + atkOf('黑桃1'));
    expect(totalAtk(nova(['黑桃1'], 5, 0, { pursuit: ['閃電新星'] }), 0)).toBe(atkOf('黑桃1') + atkOf('閃電新星'));
  });

  it('只加我方：對方的閃電新星看的是對方自己的手牌差', () => {
    const g = scenario({ chars: ['勇者', '法師'] });
    setZones(g, 0, { moves: ['黑桃1'], hand: hands(1) });
    setZones(g, 1, { moves: ['閃電新星'], hand: hands(4) });
    expect(totalAtk(g, 0)).toBe(atkOf('黑桃1'));
    expect(totalAtk(g, 1)).toBe(atkOf('閃電新星') + 3);
  });

  it('X 在每次計算時即時取當下的手牌數：抽牌或出牌後重新計算，不鎖定', () => {
    const g = nova(['閃電新星'], 2, 1);
    setZones(g, 0, { moves: ['閃電新星'], hand: hands(2), deck: hands(10) });
    expect(totalAtk(g, 0)).toBe(atkOf('閃電新星') + 1);
    drive(draw(g, 0, 3));
    expect(totalAtk(g, 0)).toBe(atkOf('閃電新星') + 4); // 抽 3 張，手牌 5 對 1
    move(g, Z(g, 1, 'hand')[0], 'discard');
    expect(totalAtk(g, 0)).toBe(atkOf('閃電新星') + 5); // 對方少 1 張
    move(g, Z(g, 0, 'hand')[0], 'exp');
    move(g, Z(g, 0, 'hand')[0], 'exp');
    expect(totalAtk(g, 0)).toBe(atkOf('閃電新星') + 3); // 我方出掉 2 張，手牌 3 對 0
  });

  it('實際對局：出招後手牌少了 1 張，傷害計算用的總攻擊是出招後的手牌差，畫面的總攻擊跟著變', () => {
    const g = scenario({
      chars: ['法師', '勇者'], animate: true, singlePhase: true,
      p0: { hand: ['閃電新星', '黑桃2', '黑桃3'] }, p1: { hand: [] },
    });
    const before = g.drainFrames();
    expect(before.length).toBeGreaterThan(0);
    pick(g, '閃電新星'); // 手牌 3 → 2，對方 0 張
    if (g.pending) pass(g); // 先攻方還能繼續出招時選擇不出
    const frames = g.drainFrames();
    const calc = frames.find((f) => f.fx.type === 'calc');
    expect(calc).toBeDefined();
    if (calc?.fx.type === 'calc') expect(calc.fx.atk[0]).toBe(atkOf('閃電新星') + 2);
    // 出招後的影格，畫面上的總攻擊已經是 5 + 手牌差
    const played = frames.find((f) => f.views[0].players[0].moves.length === 1);
    expect(played?.views[0].players[0].atk).toBe(atkOf('閃電新星') + 2);
  });
});
