import { describe, expect, it } from 'vitest';
import { viewFor } from '../src/engine/view';
import { promptSheet } from '../src/ui/promptSheet';
import { armorScenario, pick, scenario } from './helpers';

// 手機版面：提示要選的牌在牌區裡時，自動打開那個牌區的面板
describe('提示指定的面板', () => {
  it('要選的是手牌：不開面板', () => {
    const g = scenario({ phase: '先手', singlePhase: true, p0: { hand: ['黑桃1', '黑桃2'] }, p1: { hand: ['黑桃9'] } });
    const v = viewFor(g, 0);
    expect(promptSheet(v, v.prompt)).toBeNull();
  });

  it('沒有提示：不開面板', () => {
    const g = scenario({ phase: '先手', singlePhase: true, p0: { hand: ['黑桃1', '黑桃2'] }, p1: { hand: ['黑桃9'] } });
    expect(promptSheet(viewFor(g, 0), null)).toBeNull();
  });

  it('要從經驗區選牌（冰霜護甲捨棄裏側經驗）：打開我方經驗區', () => {
    const g = armorScenario({ exp: ['黑桃3', '黑桃4', '~黑桃5', '~黑桃6'] });
    pick(g, '黑桃9');
    pick(g, '發動');
    const v = viewFor(g, 0);
    expect(v.prompt?.options).toHaveLength(4);
    expect(promptSheet(v, v.prompt)).toEqual({ p: 0, tab: 'exp' });
  });

  it('對手視角沒有提示：不開面板', () => {
    const g = armorScenario({ exp: ['黑桃3', '黑桃4', '~黑桃5', '~黑桃6'] });
    pick(g, '黑桃9');
    pick(g, '發動');
    const v = viewFor(g, 1);
    expect(promptSheet(v, v.prompt)).toBeNull();
  });
});
