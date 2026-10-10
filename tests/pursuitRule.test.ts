import { describe, expect, it } from 'vitest';
import { Z } from '../src/engine/ops';
import { pick, scenario } from './helpers';

const log = (g: ReturnType<typeof scenario>) => g.state.log.join('\n');
/** 追擊階段有沒有翻牌：失敗的牌會加入手牌，成功的牌會進追擊卡疊再歸還到經驗區 */
const flipped = (g: ReturnType<typeof scenario>) => g.state.flags.pursuitSuccess[0] + g.state.flags.pursuitSuccess[1];

describe('追擊通則：只要有一方的招式卡疊沒有招式，就不追擊', () => {
  it('雙方都有招式：照常追擊，雙方各翻牌組頂', () => {
    const g = scenario({ p0: { hand: ['黑桃7'] }, p1: { hand: ['黑桃9'] }, singlePhase: true });
    pick(g, '黑桃9'); // 先攻方只有 1 張招式，自動先手出招
    expect(g.state.flags.pursuitSuccess).toEqual([1, 1]); // 牌組頂黑桃1 在範圍 7~9 外
    expect(log(g)).not.toContain('不進行追擊');
  });

  it('先攻方沒有招式：後攻方出招也不追擊，雙方都不翻牌', () => {
    const g = scenario({ p0: { hand: [] }, p1: { hand: ['黑桃9'] }, singlePhase: true });
    pick(g, '黑桃9'); // 後攻方出招；先攻方沒有招式，自動收招
    expect(g.pending).toBeNull();
    expect(log(g)).toContain('有一方沒有出招，不進行追擊');
    expect(flipped(g)).toBe(0);
    expect(Z(g, 0, 'hand')).toHaveLength(0);
    expect(Z(g, 1, 'hand')).toHaveLength(0);
  });

  it('後攻方沒有招式：不追擊，雙方都不翻牌', () => {
    const g = scenario({ p0: { hand: ['黑桃7'] }, p1: { hand: [] }, singlePhase: true });
    expect(g.pending).toBeNull();
    expect(flipped(g)).toBe(0);
    expect(Z(g, 0, 'hand')).toHaveLength(0);
    expect(Z(g, 1, 'hand')).toHaveLength(0);
  });

  it('後攻方第一個動作就收招：先攻方不能繼續出招，直接傷害計算', () => {
    const g = scenario({ p0: { hand: ['黑桃7', '黑桃5'] }, p1: { hand: ['黑桃9'] }, singlePhase: true });
    pick(g, '黑桃7');
    pick(g, '收招');
    expect(g.pending).toBeNull();
    expect(Z(g, 0, 'exp').map((c) => c.id)).toEqual(['黑桃7']);
    expect(Z(g, 0, 'hand').map((c) => c.id)).toEqual(['黑桃5']);
    expect(flipped(g)).toBe(0);
  });
});
