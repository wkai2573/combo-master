import { describe, expect, it } from 'vitest';
import { Z } from '../src/engine/ops';
import { 伏擊狀態 } from '../src/engine/sources/thief';
import { armorScenario, pick, scenario } from './helpers';

// 傷害計算時：傷害算出來了、還沒放進怒氣區，雙方進觸發窗口，先攻方先處理完自己的窗口再換後攻方。
// 窗口裡的效果直接改將要承受的傷害，先發動的效果會影響後面的條件。
describe('傷害計算時：窗口與傷害承受的順序', () => {
  it('窗口期間傷害還沒放進怒氣區，窗口結束才放進去，張數是減免後的', () => {
    const g = armorScenario({ exp: ['黑桃3', '黑桃4', '黑桃5'] });
    pick(g, '黑桃9');
    const dmg = g.state.flags.damagePending[0];
    expect(dmg).toBeGreaterThan(2);
    expect(Z(g, 0, 'rage')).toHaveLength(5);
    expect(g.state.flags.damageTaken[0]).toBe(0);
    pick(g, '發動');
    pick(g, '黑桃3', '黑桃4');
    expect(g.state.flags.damageTaken[0]).toBe(dmg - 2);
    expect(Z(g, 0, 'rage')).toHaveLength(5 + dmg - 2);
  });

  it.each([0, 1] as const)('先攻方是玩家 %i：先攻方先處理自己的窗口，再換後攻方', (first) => {
    const g = scenario({
      first,
      chars: ['法師', '法師'],
      p0: { hand: ['冰霜護甲'], exp: ['黑桃3', '黑桃4'] },
      p1: { hand: ['冰霜護甲'], exp: ['黑桃3', '黑桃4'] },
    });
    伏擊狀態.of(g, 0).atk = 9;
    伏擊狀態.of(g, 1).atk = 9;
    if (g.pending!.options.some((o) => o.label === '冰霜護甲')) pick(g, '冰霜護甲');
    expect(g.pending!.title).toContain('冰霜護甲');
    expect(g.pending!.player).toBe(first);
    pick(g, '不發動');
    expect(g.pending!.title).toContain('冰霜護甲');
    expect(g.pending!.player).toBe(1 - first);
  });

  it('同一個窗口裡先發動的減免，會讓後面的比較跟著變：減到不再大於造成的傷害，復仇之嚎就從窗口消失', () => {
    const g = armorScenario({
      exp: ['~黑桃3', '~黑桃4', '~黑桃5', '~黑桃6', '黑桃7', '黑桃8', '復仇之嚎'],
      rage: Array(6).fill('黑桃1'),
    });
    pick(g, '黑桃9');
    g.state.flags.damagePending = [6, 4]; // 玩家 0 將受到 6、造成 4：受到的大於造成的
    expect(g.pending!.options.map((o) => o.label)).toEqual(expect.arrayContaining([expect.stringContaining('復仇之嚎'), expect.stringContaining('冰霜護甲')]));
    pick(g, g.pending!.options.find((o) => o.label.includes('冰霜護甲'))!.label);
    // 蓋2 之後有 6 張裏側經驗；捨棄 2 張：受到 4、造成 4，不再大於
    expect(g.pending!.options).toHaveLength(6);
    pick(g, '黑桃3', '黑桃4');
    expect(g.state.flags.damagePending[0]).toBe(4);
    // 復仇之嚎的條件不成立了，窗口結束，不會再問
    expect(g.pending?.title ?? '').not.toContain('復仇之嚎');
    expect(g.state.flags.damageTaken[0]).toBe(4);
  });

  it('先攻方的減免會影響後攻方的條件：玩家 0 先攻減免後，玩家 1 的復仇之嚎才成立', () => {
    const run = (useArmor: boolean) => {
      const g = scenario({
        chars: ['法師', '勇者'],
        p0: { hand: ['冰霜護甲'], exp: ['~黑桃3', '~黑桃4', '黑桃5', '黑桃6'] },
        p1: { hand: ['黑桃9'], exp: ['復仇之嚎'], rage: Array(6).fill('黑桃1') },
      });
      伏擊狀態.of(g, 1).atk = 3;
      pick(g, '黑桃9');
      g.state.flags.damagePending = [6, 4]; // 玩家 1 受到 4、造成 6：受到的沒有大於造成的，復仇之嚎不成立
      if (!useArmor) {
        pick(g, '不發動');
        return g;
      }
      pick(g, '發動');
      pick(g, '黑桃3', '黑桃4', '黑桃5'); // 玩家 0 受到的減到 3，玩家 1 造成的變 3，4 > 3 成立
      return g;
    };
    const withArmor = run(true);
    expect(withArmor.pending!.player).toBe(1);
    expect(withArmor.pending!.title).toContain('復仇之嚎');
    const without = run(false);
    expect(without.pending?.title ?? '').not.toContain('復仇之嚎');
  });

  it('復仇之嚎：怒氣區少於 4 張不能發動（付怒3 之後要有卡可取）', () => {
    const run = (rage: number) => {
      const g = scenario({ p0: { hand: ['黑桃1'], exp: ['復仇之嚎'], rage: Array(rage).fill('黑桃1') }, p1: { hand: ['黑桃9'] } });
      伏擊狀態.of(g, 1).atk = 3;
      pick(g, '黑桃9');
      return g;
    };
    expect(run(4).pending!.title).toContain('復仇之嚎');
    expect(run(3).pending?.title ?? '').not.toContain('復仇之嚎');
  });
});
