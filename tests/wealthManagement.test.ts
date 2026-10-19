import { describe, expect, it } from 'vitest';
import { getCard } from '../src/data/cards';
import { ENABLED_EFFECT_CARDS } from '../src/data/enabledCards';
import { Z } from '../src/engine/ops';
import { names, pick, scenario } from './helpers';

const filler = Array(20).fill('黑桃1') as string[];

// 財富管理：
//   [發_蓋1] 必須將牌組上方 3 張卡以裏側放入經驗區
//   [經] 當此卡被蓋為裏側時，必須捨棄此卡，然後選擇 2 張經驗放回牌組底
describe('財富管理', () => {
  it('卡表資料：商人招式，市場特徵，已開放', () => {
    expect(getCard('財富管理')).toMatchObject({ name: '財富管理', cls: '商人', kind: 'move', traits: ['市場'] });
    expect(ENABLED_EFFECT_CARDS).toContain('財富管理');
  });

  const play = (deck: string[], exp = ['黑桃5']) =>
    scenario({
      chars: ['商人', '勇者'],
      phase: '先手',
      singlePhase: true,
      p0: { hand: ['財富管理'], exp, deck },
      p1: { hand: [] },
    });

  it('[發_蓋1]：付蓋1，牌組上方 3 張以裏側放進經驗區最後方；紀錄不洩漏卡名', () => {
    const g = play(['黑桃6', '黑桃7', '黑桃8', ...filler]);
    const deck = Z(g, 0, 'deck').length;
    pick(g, '發動');
    // 流程跑完會歸還：財富管理自己最後回到經驗區（表側）
    expect(names(g, 0, 'exp')).toEqual(['黑桃5', '黑桃6', '黑桃7', '黑桃8', '財富管理']);
    expect(Z(g, 0, 'exp').map((c) => c.covered)).toEqual([true, true, true, true, false]);
    expect(Z(g, 0, 'deck').length).toBeLessThanOrEqual(deck - 3);
    const log = g.state.log.join('\n');
    expect(log).toContain('將牌組上方 3 張卡以裏側放入經驗區');
    for (const n of ['黑桃6', '黑桃7', '黑桃8']) expect(log).not.toContain(n);
  });

  it('不發動就沒有任何變化；牌組不足 3 張不能發動', () => {
    const no = play(['黑桃6', '黑桃7', '黑桃8', ...filler]);
    pick(no, '不發動');
    expect(Z(no, 0, 'exp').filter((c) => c.covered)).toHaveLength(0);

    const few = play(['黑桃6', '黑桃7']);
    expect(few.pending?.title ?? '').not.toContain('財富管理');
    expect(Z(few, 0, 'exp').filter((c) => c.covered)).toHaveLength(0);
  });

  /** 回合開始時用家族相片的蓋1 蓋住最前面的表側經驗，觸發它的蓋反應 */
  const covered = (exp: string[], deck = ['黑桃7', ...filler]) =>
    scenario({
      chars: ['商人', '刺客'],
      phase: '回合開始',
      singlePhase: true,
      p0: { gear: ['家族相片'], exp, rage: Array(4).fill('黑桃1'), deck },
    });

  it('[經]：被蓋為裏側時先捨棄自己進棄牌區，再從剩下的經驗選 2 張放回牌組底，表側裏側都可以', () => {
    const g = covered(['財富管理', '黑桃3', '~黑桃4', '黑桃6']);
    const deck = Z(g, 0, 'deck').length;
    pick(g, '發動'); // 家族相片：蓋1 蓋住最前面的表側經驗＝財富管理
    expect(names(g, 0, 'discard')).toContain('財富管理'); // 先捨棄自己，雙方都看得到（怒2 的費用另外捨棄了 2 張黑桃1）
    expect(Z(g, 0, 'discard').find((c) => c.id === '財富管理')!.covered).toBe(false);
    expect(g.pending!.title).toContain('財富管理');
    expect(g.pending!.min).toBe(2);
    expect(g.pending!.max).toBe(2);
    expect(g.pending!.options.map((o) => o.label).sort()).toEqual(['黑桃3', '黑桃4', '黑桃6']); // 選不到自己
    pick(g, '黑桃4', '黑桃6');
    expect(Z(g, 0, 'deck').slice(-2).map((c) => c.id).sort()).toEqual(['黑桃4', '黑桃6']);
    expect(names(g, 0, 'exp')).toEqual(['黑桃3']);
    expect(names(g, 0, 'discard')).toContain('財富管理'); // 自己留在棄牌區，不回牌組
    expect(Z(g, 0, 'deck').some((c) => c.id === '財富管理')).toBe(false);
    expect(Z(g, 0, 'deck').length).toBe(deck + 2 + 1); // 放回 2 張，加上家族相片回復 1
    expect(g.state.log.join('\n')).toContain('【財富管理】');
  });

  it('剩下的經驗不足 2 張就全放回，不會卡住', () => {
    const only = covered(['財富管理']);
    const deck = Z(only, 0, 'deck').length;
    pick(only, '發動');
    expect(names(only, 0, 'exp')).toEqual([]);
    expect(names(only, 0, 'discard')).toContain('財富管理');
    expect(Z(only, 0, 'deck').length).toBe(deck + 1); // 只有家族相片回復 1，沒有經驗可放回

    const one = covered(['財富管理', '黑桃3']);
    const oneDeck = Z(one, 0, 'deck').length;
    pick(one, '發動'); // 剩 1 張：不問，直接放回
    expect(one.pending?.title ?? '').not.toContain('財富管理');
    expect(names(one, 0, 'exp')).toEqual([]);
    expect(Z(one, 0, 'deck').at(-1)!.id).toBe('黑桃3');
    expect(Z(one, 0, 'deck').length).toBe(oneDeck + 1 + 1);
  });

  it('Ex 卡被放回時離開經驗區直接移除遊戲，不進牌組也不進棄牌區', () => {
    const ex = covered(['財富管理', 'Ex-流血', '黑桃3', '黑桃6']);
    const exDeck = Z(ex, 0, 'deck').length;
    pick(ex, '發動');
    pick(ex, 'Ex-流血', '黑桃3');
    expect(names(ex, 0, 'exp')).toEqual(['黑桃6']);
    expect(Z(ex, 0, 'deck').length).toBe(exDeck + 1 + 1); // 只有黑桃3 回到牌組，流血移除遊戲；再加家族相片回復 1
    expect(Z(ex, 0, 'deck').some((c) => c.id === 'Ex-流血')).toBe(false);
    expect(Z(ex, 0, 'discard').some((c) => c.id === 'Ex-流血')).toBe(false);
    expect(names(ex, 0, 'discard')).toContain('財富管理');
  });

  it('被蓋X 的費用蓋住時也一樣：財富管理被捨棄，剩下的經驗選 2 張放回', () => {
    const g = scenario({
      chars: ['商人', '勇者'], phase: '先手', singlePhase: true,
      p0: { hand: ['生命藥水'], exp: ['財富管理', '黑桃2', '黑桃3', '黑桃4'], rage: [], deck: filler },
      p1: { hand: [] },
    });
    pick(g, '發動'); // 生命藥水 [發_蓋3]：蓋住最前面的 3 張表側經驗，含財富管理
    pick(g, '黑桃2', '黑桃4');
    expect(names(g, 0, 'discard')).toContain('財富管理');
    expect(Z(g, 0, 'deck').slice(-2).map((c) => c.id).sort()).toEqual(['黑桃2', '黑桃4']);
  });
});
