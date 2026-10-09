import { describe, expect, it } from 'vitest';
import { statChanges } from '../src/engine/stats';
import { frameFor, viewFor } from '../src/engine/view';
import { atkOf, defOf, pick, scenario } from './helpers';

/** 動作之前最後的影格，加上動作之後錄下的所有影格（前一格是動作之前的桌面） */
function framesAfter(act: (g: ReturnType<typeof scenario>) => void, opts: Parameters<typeof scenario>[0] = {}) {
  const g = scenario({ animate: true, ...opts });
  const base = g.drainFrames().slice(-1);
  act(g);
  return [...base, ...g.drainFrames()].map((f) => frameFor(f, 0));
}

describe('數值變化', () => {
  it('出招：自己的總攻、總防增加該張牌的數值，對方不變', () => {
    const frames = framesAfter((g) => pick(g, '黑桃5'), { chars: ['勇者', '勇者'], p0: { hand: ['黑桃5', '黑桃6'] }, p1: { hand: [] } });
    const play = frames.findIndex((f, i) => i > 0 && f.fx.type === 'play');
    const c = statChanges(frames[play - 1].view, frames[play].view);
    expect(c.atk).toEqual([atkOf('黑桃5'), 0]);
    expect(c.def).toEqual([defOf('黑桃5'), 0]);
    expect(c.life).toEqual([0, 0]);
  });

  it('受傷：牌組（生命）減少、怒氣增加，張數等於傷害算式裡的傷害', () => {
    const frames = framesAfter((g) => pick(g, '黑桃9'), { p0: { hand: ['黑桃5'] }, p1: { hand: ['黑桃9'] } });
    const calc = frames.findIndex((f) => f.fx.type === 'calc');
    const fx = frames[calc].fx;
    if (fx.type !== 'calc') throw new Error('不是算式影格');
    const c = statChanges(frames[calc].view, frames[calc + 1].view);
    expect(c.life).toEqual([-fx.dmg[0], -fx.dmg[1]]);
    expect(c.rage).toEqual([fx.dmg[0], fx.dmg[1]]);
  });

  it('歸還：經驗區增加的張數等於歸還的招式與追擊卡張數', () => {
    const frames = framesAfter((g) => pick(g, '黑桃9'), { p0: { hand: ['黑桃5'] }, p1: { hand: ['黑桃9'] } });
    const ret = frames.findIndex((f) => f.fx.type === 'return');
    const before = frames[ret - 1].view.players;
    const c = statChanges(frames[ret - 1].view, frames[ret].view);
    expect(c.exp).toEqual([before[0].moves.length + before[0].pursuit.length, before[1].moves.length + before[1].pursuit.length]);
  });

  it('增益的持續時間指示物變動，依卡片實體編號列出差值', () => {
    const g = scenario({ p0: { buff: ['黑桃3'] } });
    const before = viewFor(g, 0, false);
    const after = structuredClone(before);
    after.players[0].buff[0].counters = 2;
    expect(statChanges(before, after).buff).toEqual({ [before.players[0].buff[0].uid]: 2 });
  });

  it('沒有變化時全部為 0', () => {
    const v = viewFor(scenario(), 0, false);
    const c = statChanges(v, v);
    expect([c.life, c.rage, c.exp, c.atk, c.def]).toEqual([[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]]);
    expect(c.buff).toEqual({});
  });
});
