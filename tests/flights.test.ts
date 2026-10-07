import { describe, expect, it } from 'vitest';
import { coverChanges, diffFlights, type Flight } from '../src/engine/flights';
import { frameFor } from '../src/engine/view';
import { pick, scenario } from './helpers';

/** 一次拼招後取出影格，回傳「某個演出類型的影格」與它前一個影格之間的卡片飛行 */
function flightsInto(fxType: string, viewer: 0 | 1 = 0): Flight[] {
  const g = scenario({ animate: true, p0: { hand: ['黑桃5'] }, p1: { hand: ['黑桃9'] } });
  g.drainFrames();
  pick(g, '黑桃9');
  const frames = g.drainFrames().map((f) => frameFor(f, viewer));
  const i = frames.findIndex((f) => f.fx.type === fxType);
  expect(i).toBeGreaterThan(0);
  return diffFlights(frames[i - 1].view, frames[i].view);
}

describe('卡片飛行', () => {
  it('抽牌階段：雙方各有一張牌從牌組飛進手牌，自己看得到牌面、對手只有牌背', () => {
    const flights = flightsInto('draw', 0).filter((f) => f.from === 'deck' && f.to === 'hand');
    expect(flights.map((f) => f.owner).sort()).toEqual([0, 1]);

    const mine = flights.find((f) => f.owner === 0)!;
    expect(mine.id).not.toBeNull();
    expect(mine.faceUpFrom).toBe(false);
    expect(mine.faceUpTo).toBe(true);

    const theirs = flights.find((f) => f.owner === 1)!;
    expect(theirs.id).toBeNull();
    expect(theirs.faceUpTo).toBe(false);
  });

  it('受傷：牌背逐張從牌組飛進怒氣區（連自己也只看到牌背），並依序錯開', () => {
    for (const viewer of [0, 1] as const) {
      const flights = flightsInto('damage', viewer).filter((f) => f.to === 'rage');
      expect(flights.length).toBeGreaterThan(1);
      for (const f of flights) {
        expect(f.from).toBe('deck');
        expect(f.faceUpFrom).toBe(false);
        expect(f.faceUpTo).toBe(false);
      }
      // 同一位玩家的牌 order 依序為 0, 1, 2…
      for (const owner of [0, 1] as const) {
        const orders = flights.filter((f) => f.owner === owner).map((f) => f.order);
        expect(orders).toEqual(orders.map((_, i) => i));
      }
    }
  });

  it('相鄰影格完全相同時沒有飛行', () => {
    const g = scenario({ animate: true, p0: { hand: ['黑桃5'] }, p1: { hand: ['黑桃9'] } });
    const v = frameFor(g.drainFrames()[0], 0).view;
    expect(diffFlights(v, v)).toEqual([]);
  });

  it('蓋 X 付費：經驗區最前面的 X 張正面卡翻成覆蓋（不算飛行）', () => {
    const g = scenario({
      animate: true, chars: ['法師', '勇者'],
      p0: { hand: ['火球'], exp: ['黑桃3', '黑桃4', '黑桃5', '黑桃6'] }, p1: { hand: [] },
    });
    g.drainFrames();
    pick(g, '發動');
    const frames = g.drainFrames().map((f) => frameFor(f, 0));
    const i = frames.findIndex((f) => f.view.players[0].exp.some((c) => c.covered));
    expect(i).toBeGreaterThan(0);
    const exp = frames[i].view.players[0].exp;
    expect(coverChanges(frames[i - 1].view, frames[i].view)).toEqual(exp.slice(0, 3).map((c) => c.uid));
    expect(diffFlights(frames[i - 1].view, frames[i].view)).toEqual([]);
  });
});
