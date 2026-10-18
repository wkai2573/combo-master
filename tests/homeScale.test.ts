import { describe, expect, it } from 'vitest';
import { homeScale } from '../src/ui/homeScale';

describe('主選單的縮放比例', () => {
  it('視窗高度 958（目標畫面）時約 135%，整個選單放得下', () => {
    expect(homeScale(882, 958)).toBeCloseTo(1.35, 1);
  });

  it('高度越高比例越大，但最大 1.6；高度低時最小 0.8', () => {
    expect(homeScale(1920, 1200)).toBe(1.6);
    expect(homeScale(1920, 2000)).toBe(1.6);
    expect(homeScale(1200, 400)).toBe(0.8);
    expect(homeScale(1200, 800)).toBeLessThan(homeScale(1200, 900));
  });

  it('高度 712 就是原本的大小', () => {
    expect(homeScale(1200, 712)).toBeCloseTo(1, 5);
  });

  it('窄螢幕以寬度為準，內容不會超出視窗寬度', () => {
    // 手機直立：高度很夠、寬度不夠
    expect(homeScale(390, 760)).toBeLessThan(1);
    const s = homeScale(390, 760);
    expect(s * 360 + 32).toBeLessThanOrEqual(390 + 0.001);
    expect(homeScale(300, 900) * 360 + 32).toBeLessThanOrEqual(300 + 0.001);
  });

  it('再窄也不會縮到看不見', () => {
    expect(homeScale(100, 900)).toBeGreaterThanOrEqual(0.5);
  });
});
