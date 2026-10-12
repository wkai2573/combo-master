import { describe, expect, it } from 'vitest';
import { viewFor } from '../src/engine/view';
import type { Opt, Request } from '../src/engine/types';
import { promptPlacement, promptSheet } from '../src/ui/promptSheet';
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

// 手機版面：提示欄固定高度，放不下的提示改用底部面板
describe('提示的顯示位置', () => {
  const g = () => scenario({ phase: '先手', singlePhase: true, p0: { hand: ['黑桃1', '黑桃2'] }, p1: { hand: ['黑桃9'] } });
  const req = (options: Opt[], extra: Partial<Request> = {}): Request => ({ player: 0, title: '測試', options, min: 1, max: 1, ...extra });
  const btn = (n: number): Opt[] => Array.from({ length: n }, (_, i) => ({ key: `b${i}`, label: `按鈕${i}` }));

  it('沒有提示：留在提示欄', () => {
    expect(promptPlacement(viewFor(g(), 0), null)).toBe('bar');
  });

  it('選手牌的提示：留在提示欄', () => {
    const v = viewFor(g(), 0);
    expect(promptPlacement(v, v.prompt)).toBe('bar');
  });

  it('發動與不發動兩顆按鈕：留在提示欄', () => {
    expect(promptPlacement(viewFor(g(), 0), req(btn(2)))).toBe('bar');
  });

  it('三顆按鈕：改用底部面板', () => {
    expect(promptPlacement(viewFor(g(), 0), req(btn(3)))).toBe('panel');
  });

  it('多選提示的確定鈕也算一顆：兩顆選項加確定共三顆，改用底部面板', () => {
    expect(promptPlacement(viewFor(g(), 0), req(btn(2), { min: 0, max: 2 }))).toBe('panel');
  });

  it('選項是不在手牌上的卡（看牌堆頂的幾張）：改用底部面板', () => {
    const cards: Opt[] = [{ key: 'c1', label: '黑桃1', cardId: '黑桃1' }, { key: 'c2', label: '黑桃2', cardId: '黑桃2' }];
    expect(promptPlacement(viewFor(g(), 0), req(cards))).toBe('panel');
  });

  it('排序提示：改用底部面板', () => {
    const cards: Opt[] = [{ key: 'c1', label: '黑桃1', cardId: '黑桃1' }, { key: 'c2', label: '黑桃2', cardId: '黑桃2' }];
    expect(promptPlacement(viewFor(g(), 0), req(cards, { ordered: true, min: 2, max: 2 }))).toBe('panel');
  });

  it('要從經驗區選牌：由牌區面板承接', () => {
    const gg = armorScenario({ exp: ['黑桃3', '黑桃4', '~黑桃5', '~黑桃6'] });
    pick(gg, '黑桃9');
    pick(gg, '發動');
    const v = viewFor(gg, 0);
    expect(promptPlacement(v, v.prompt)).toBe('zone');
  });

  it('選項有手牌又有三顆以上按鈕：手牌要留在手牌列上選，所以提示維持在提示欄', () => {
    const v = viewFor(g(), 0);
    const hand = v.players[0].hand;
    const opts: Opt[] = [...hand.map((c) => ({ key: `c${c.uid}`, label: '手牌', uid: c.uid, cardId: c.id! })), ...btn(3)];
    expect(promptPlacement(v, req(opts))).toBe('bar');
  });
});
