import { describe, expect, it } from 'vitest';
import { getCard } from '../src/data/cards';
import { ENABLED_EFFECT_CARDS } from '../src/data/enabledCards';
import { Z } from '../src/engine/ops';
import { names, pick, scenario } from './helpers';

const filler = Array(20).fill('黑桃1') as string[];

// 財富管理（id 投資）：
//   [發_蓋1] 必須將牌組上方 3 張卡以裏側放入經驗區
//   [經] 當此卡被蓋為裏側時，必須選擇 2 張經驗放回牌組底
describe('財富管理', () => {
  it('卡表資料：商人招式，市場特徵，已開放', () => {
    expect(getCard('投資')).toMatchObject({ name: '財富管理', cls: '商人', kind: 'move', traits: ['市場'] });
    expect(ENABLED_EFFECT_CARDS).toContain('投資');
  });

  const play = (deck: string[], exp = ['黑桃5']) =>
    scenario({
      chars: ['商人', '勇者'],
      phase: '先手',
      singlePhase: true,
      p0: { hand: ['投資'], exp, deck },
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

  it('[經]：被蓋為裏側時必須選 2 張經驗放回牌組底，表側裏側都可以，可含自己', () => {
    const g = covered(['投資', '黑桃3', '~黑桃4', '黑桃6']);
    const deck = Z(g, 0, 'deck').length;
    pick(g, '發動'); // 家族相片：蓋1 蓋住最前面的表側經驗＝財富管理
    expect(g.pending!.title).toContain('財富管理');
    expect(g.pending!.min).toBe(2);
    expect(g.pending!.max).toBe(2);
    expect(g.pending!.options.map((o) => o.label).sort()).toEqual(['財富管理', '黑桃3', '黑桃4', '黑桃6'].sort());
    pick(g, '財富管理', '黑桃4');
    expect(Z(g, 0, 'deck').slice(-2).map((c) => c.id).sort()).toEqual(['投資', '黑桃4'].sort());
    expect(names(g, 0, 'exp')).toEqual(['黑桃3', '黑桃6']);
    expect(Z(g, 0, 'deck').length).toBe(deck + 2 + 1); // 放回 2 張，加上家族相片回復 1
  });

  it('經驗不足 2 張就全放回；Ex 卡離開經驗區直接移除遊戲，不進牌組', () => {
    const only = covered(['投資']);
    const deck = Z(only, 0, 'deck').length;
    pick(only, '發動');
    expect(names(only, 0, 'exp')).toEqual([]);
    expect(Z(only, 0, 'deck').length).toBe(deck + 1 + 1);

    const ex = covered(['投資', 'Ex-流血', '黑桃3']);
    const exDeck = Z(ex, 0, 'deck').length;
    pick(ex, '發動');
    pick(ex, 'Ex-流血', '黑桃3');
    expect(names(ex, 0, 'exp')).toEqual(['財富管理']);
    expect(Z(ex, 0, 'deck').length).toBe(exDeck + 1 + 1); // 只有黑桃3 回到牌組，毒移除遊戲；再加家族相片回復 1
    expect(Z(ex, 0, 'deck').some((c) => c.id === 'Ex-流血')).toBe(false);
    expect(Z(ex, 0, 'discard').some((c) => c.id === 'Ex-流血')).toBe(false);
  });
});
