import { describe, expect, it } from 'vitest';
import { expLayout, MIN_STEP } from '../src/ui/expLayout';

// 卡寬 76、間距 6：寬 580 時一列放得下 7 張（7×76 + 6×6 = 568）
const W = 580;

describe('經驗區版面', () => {
  it('一列放得下：單列完整小卡', () => {
    expect(expLayout(0, W)).toMatchObject({ mode: 'one' });
    expect(expLayout(7, W)).toMatchObject({ mode: 'one' });
  });

  it('一列放不下、兩列放得下：分兩列，由上到下再往右排（左側為最前方）', () => {
    const l = expLayout(8, W);
    expect(l).toMatchObject({ mode: 'two', cols: 4, step: 82 });
    expect(expLayout(14, W)).toMatchObject({ mode: 'two', cols: 7 });
  });

  it('兩列也放不下：水平重疊，欄距剛好讓最後一欄貼齊右緣', () => {
    const l = expLayout(15, W);
    expect(l.mode).toBe('overlap');
    expect(l.cols).toBe(8);
    expect(l.step).toBeCloseTo((W - 76) / 7);
    expect(l.step).toBeLessThan(82);
  });

  it('重疊的欄距有下限，再多的牌也至少露出一小條', () => {
    expect(expLayout(200, W).step).toBe(MIN_STEP);
  });

  it('還沒量到寬度時先當作單列', () => {
    expect(expLayout(20, 0)).toMatchObject({ mode: 'one' });
  });
});
