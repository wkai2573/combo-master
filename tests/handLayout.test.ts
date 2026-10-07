import { describe, expect, it } from 'vitest';
import { handLayout } from '../src/ui/handLayout';

// 我方手牌：卡寬 112、間距 6，寬 720 時一列放得下 6 張（6×112 + 5×6 = 702）
const W = 720;
const MIN = 36;

describe('手牌版面', () => {
  it('放得下就不重疊', () => {
    expect(handLayout(0, W, 112, MIN).overlap).toBe(false);
    expect(handLayout(1, W, 112, MIN).overlap).toBe(false);
    expect(handLayout(6, W, 112, MIN).overlap).toBe(false);
  });

  it('放不下就重疊，欄距剛好讓最後一張貼齊右緣', () => {
    const l = handLayout(7, W, 112, MIN);
    expect(l.overlap).toBe(true);
    expect(l.step).toBeCloseTo((W - 112) / 6);
    expect(l.step).toBeLessThan(112 + 6);
  });

  it('每張至少露出下限的寬度，再多的牌也不會更窄', () => {
    expect(handLayout(40, W, 112, MIN).step).toBe(MIN);
  });

  it('還沒量到寬度或卡寬時先當作不重疊', () => {
    expect(handLayout(20, 0, 112, MIN).overlap).toBe(false);
    expect(handLayout(20, W, 0, MIN).overlap).toBe(false);
  });
});
