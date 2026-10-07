import { describe, expect, it } from 'vitest';
import { coverChanges, diffFlights, flightTiming, fromSpotlight, type Flight } from '../src/engine/flights';
import { pay, type GameCtx } from '../src/engine/ops';
import { frameFor } from '../src/engine/view';
import { pick, scenario } from './helpers';

/** 火球：蓋 3 付費後對方直擊 2。回傳「付費影格」與「直擊影格」 */
function fireball(viewer: 0 | 1 = 0) {
  const g = scenario({
    animate: true, chars: ['法師', '勇者'],
    p0: { hand: ['火球'], exp: ['黑桃3', '黑桃4', '黑桃5'] }, p1: { hand: [] },
  });
  g.drainFrames();
  pick(g, '發動');
  const frames = g.drainFrames().map((f) => frameFor(f, viewer));
  const paid = frames.findIndex((f) => f.view.players[0].exp.every((c) => c.covered) && f.view.players[0].exp.length === 3);
  const hit = frames.findIndex((f, i) => i > paid && f.view.players[1].discard.length === 2);
  expect(paid).toBeGreaterThan(-1);
  expect(hit).toBeGreaterThan(paid);
  return { frames, paid, hit };
}

/** 一次拼招後取出影格，回傳「某個演出類型的影格」與它前一個影格之間的卡片飛行 */
function flightsInto(fxType: string, viewer: 0 | 1 = 0): Flight[] {
  const g = scenario({ animate: true, p0: { hand: ['黑桃5'] }, p1: { hand: ['黑桃9'] } });
  const base = g.drainFrames().slice(-1); // 出招之前最後的桌面，當作第一個影格的前一格
  expect(base).toHaveLength(1);
  pick(g, '黑桃9');
  const frames = [...base, ...g.drainFrames()].map((f) => frameFor(f, viewer));
  const i = frames.findIndex((f, j) => j > 0 && f.fx.type === fxType); // 第 0 格是出招之前的桌面
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

  it('直擊：牌組上方的牌逐張飛進棄牌區，途中翻成正面（棄牌區是公開的）', () => {
    for (const viewer of [0, 1] as const) {
      const { frames, hit } = fireball(viewer);
      const flights = diffFlights(frames[hit - 1].view, frames[hit].view).filter((f) => f.to === 'discard');
      expect(flights).toHaveLength(2);
      expect(flights.map((f) => f.order)).toEqual([0, 1]);
      for (const f of flights) {
        expect(f.owner).toBe(1);
        expect(f.from).toBe('deck');
        expect(f.id).not.toBeNull();
        expect(f.faceUpFrom).toBe(false);
        expect(f.faceUpTo).toBe(true);
      }
    }
  });

  it('回復：怒氣區上方的牌逐張飛回牌組頂，全程牌背', () => {
    const g = scenario({
      animate: true, chars: ['商人', '勇者'],
      p0: { exp: ['低價買進', '黑桃3'], rage: Array(5).fill('黑桃1') },
    });
    g.drainFrames();
    pay(g as unknown as GameCtx, 0, { cover: 1 }).next();
    const frames = g.drainFrames().map((f) => frameFor(f, 0));
    expect(frames.length).toBeGreaterThan(1);
    const flights = diffFlights(frames[frames.length - 2].view, frames[frames.length - 1].view);
    expect(flights).toHaveLength(3);
    expect(flights.map((f) => f.order)).toEqual([0, 1, 2]);
    for (const f of flights) {
      expect([f.from, f.to]).toEqual(['rage', 'deck']);
      expect([f.faceUpFrom, f.faceUpTo]).toEqual([false, false]);
    }
  });

  it('影格停留的時間夠讓整批飛行播完，不會被下一個影格截斷', () => {
    const g = scenario({
      animate: true, chars: ['法師', '勇者'],
      p0: { hand: ['Explosion!'], exp: Array(8).fill('黑桃3') }, p1: { hand: [] },
    });
    g.drainFrames();
    pick(g, '發動'); // 蓋 8，對方直擊 5
    const frames = g.drainFrames().map((f) => frameFor(f, 0));
    const hit = frames.find((f) => f.view.players[1].discard.length === 5)!;
    // 5 張：最後一張晚 4×90ms 出發，再飛 420ms ＝ 780ms；影格要多留一點緩衝，超過原本的 800ms
    expect(hit.ms).toBeGreaterThanOrEqual(900);
  });

  it('飛行時序：張數少維持原速，張數多時整批壓縮在 1.5 秒內', () => {
    expect(flightTiming(0)).toEqual({ ms: 420, stagger: 90, total: 420 });
    expect(flightTiming(4).total).toBe(420 + 4 * 90);
    for (const maxOrder of [10, 20, 40, 100]) {
      const t = flightTiming(maxOrder);
      expect(t.total).toBeLessThanOrEqual(1500);
      expect(t.ms).toBeGreaterThanOrEqual(150); // 再快就看不清楚了
      // 最後一張的出發時間加上飛行時間，剛好就是整批的總時長（介面實際播放的時間與引擎預估一致）
      expect(t.ms + maxOrder * t.stagger).toBeCloseTo(t.total);
    }
  });

  it('對手出招：牌從對手手牌飛到戰鬥區，途中翻成正面；自己出招則全程正面', () => {
    // 玩家 1 打出黑桃9：玩家 0 視角看不到他手牌的牌面，玩家 1 自己看得到
    const theirs = flightsInto('play', 0).find((f) => f.owner === 1 && f.to === 'combat')!;
    expect(theirs.from).toBe('hand');
    expect(theirs.id).toBe('黑桃9');
    expect([theirs.faceUpFrom, theirs.faceUpTo]).toEqual([false, true]);
    const own = flightsInto('play', 1).find((f) => f.owner === 1 && f.to === 'combat')!;
    expect([own.faceUpFrom, own.faceUpTo]).toEqual([true, true]);
  });

  it('歸還：招式與追擊卡依序飛進經驗區，同一位玩家的牌不會同時出發', () => {
    const flights = flightsInto('return', 0).filter((f) => f.owner === 0 && f.to === 'exp');
    expect(flights.map((f) => f.from)).toEqual(['combat', 'pursuit']);
    expect(flights.map((f) => f.order)).toEqual([0, 1]);
  });

  it('追擊判定：結果影格裡，中央放大的那張牌從牌組出發飛進追擊區（失敗則飛進手中）', () => {
    const g = scenario({
      animate: true,
      p0: { hand: ['黑桃5'], deck: ['黑桃1', ...Array(20).fill('黑桃2')] }, p1: { hand: ['黑桃9'] },
    });
    const base = g.drainFrames().slice(-1);
    pick(g, '黑桃9');
    const frames = [...base, ...g.drainFrames()].map((f) => frameFor(f, 0));
    const i = frames.findIndex((f, j) => j > 0 && f.fx.type === 'flipResult' && f.fx.player === 0);
    expect(i).toBeGreaterThan(0);
    expect(frames[i - 1].fx.type).toBe('flip'); // 翻牌影格：牌還在牌組，中央放大
    const flights = diffFlights(frames[i - 1].view, frames[i].view);
    expect(flights).toHaveLength(1);
    expect(flights[0]).toMatchObject({ owner: 0, from: 'deck', to: 'pursuit' }); // 黑桃1 不在 5~9 範圍內，成功
    expect(fromSpotlight(frames[i - 1].fx, frames[i].fx, flights[0])).toBe(true);
    expect(fromSpotlight(frames[i].fx, frames[i].fx, flights[0])).toBe(false); // 只有緊接在翻牌影格之後的那一格
    // 對手的追擊判定翻牌不是這位玩家的牌
    expect(fromSpotlight(frames[i - 1].fx, frames[i].fx, { ...flights[0], owner: 1 })).toBe(false);
  });
});
