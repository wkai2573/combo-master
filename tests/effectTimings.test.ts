import { describe, expect, it } from 'vitest';
import { Z } from '../src/engine/ops';
import { pick, scenario } from './helpers';

/** 效果來源遷移時補的特徵測試：記錄遷移前就有的細節，確保搬家後不變 */
describe('電弧：抽 X，X 是對方戰鬥區的招式數量', () => {
  const activates = (g: ReturnType<typeof scenario>) => g.drainFrames().filter((f) => f.fx.type === 'activate');

  it('對方戰鬥區沒有招式時，什麼都不發生，也不錄發動影格', () => {
    const g = scenario({ chars: ['法師', '勇者'], first: 0, animate: true, p0: { hand: ['電弧', '黑桃1'] }, p1: { hand: [] } });
    pick(g, '電弧'); // 先手出招，對方戰鬥區還是空的
    expect(g.state.log.some((l) => l.includes('【電弧】抽'))).toBe(false);
    expect(activates(g)).toHaveLength(0);
  });

  it('對方戰鬥區有 1 張招式時，抽 1 再放 1 張手牌到牌組底，並錄發動影格', () => {
    const g = scenario({
      chars: ['勇者', '法師'], first: 0, animate: true,
      p0: { hand: ['黑桃5'] }, p1: { hand: ['電弧', '黑桃1'] },
    });
    // 先手只有 1 張可出，自動打出；輪到對方反擊
    g.drainFrames();
    pick(g, '電弧'); // 反擊步驟打出，對方（先手）的戰鬥區有 1 張
    expect(g.pending!.title).toContain('【電弧】選擇 1 張手牌放到牌組底');
    expect(Z(g, 1, 'hand')).toHaveLength(2);
    expect(activates(g)).toHaveLength(1);
  });
});
