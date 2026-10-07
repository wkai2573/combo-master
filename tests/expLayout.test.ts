import { describe, expect, it } from 'vitest';
import { expLayout, MIN_STEP } from '../src/ui/expLayout';

// 卡寬 76、間距 6：寬 580 時一列放得下 7 張（7×76 + 6×6 = 568）
const W = 580;

describe('經驗區版面', () => {
  it('一列放得下：單列完整小卡，全部在第一列', () => {
    expect(expLayout(0, W)).toMatchObject({ mode: 'one', firstRow: 0 });
    expect(expLayout(7, W)).toMatchObject({ mode: 'one', firstRow: 7, cols: 7 });
  });

  it('一列放不下：第一列由左向右放滿，剩下的放第二列', () => {
    expect(expLayout(8, W)).toMatchObject({ mode: 'two', firstRow: 7, cols: 7, step: 82 });
    expect(expLayout(9, W)).toMatchObject({ mode: 'two', firstRow: 7, cols: 7 });
  });

  it('兩列剛好放滿：第一列與第二列都是一整列的容量', () => {
    expect(expLayout(14, W)).toMatchObject({ mode: 'two', firstRow: 7, cols: 7 });
  });

  it('兩列也放不下：水平重疊，前半在第一列、後半在第二列，兩列欄距相同', () => {
    const l = expLayout(15, W);
    expect(l.mode).toBe('overlap');
    expect(l.firstRow).toBe(8);
    expect(l.cols).toBe(8);
    // 欄距剛好讓最後一欄貼齊右緣
    expect(l.step).toBeCloseTo((W - 76) / 7);
    expect(l.step).toBeLessThan(82);
    // 偶數張：前後各半
    expect(expLayout(20, W)).toMatchObject({ mode: 'overlap', firstRow: 10, cols: 10 });
  });

  it('重疊的欄距有下限，再多的牌也至少露出一小條', () => {
    expect(expLayout(200, W).step).toBe(MIN_STEP);
  });

  it('還沒量到寬度時先當作單列', () => {
    expect(expLayout(20, 0)).toMatchObject({ mode: 'one', firstRow: 20 });
  });
});
