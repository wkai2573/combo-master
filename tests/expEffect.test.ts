import { describe, expect, it } from 'vitest';
import { expEffectActive, hasExpEffect } from '../src/ui/expEffect';

const view = (id: string | null, covered = false) => ({ uid: 1, id, covered, counters: 0 });

describe('經驗效果', () => {
  it('卡文帶 [經] 標籤才算有經驗效果，標籤可以和費用併寫', () => {
    expect(hasExpEffect('低價買進')).toBe(true);
    expect(hasExpEffect('復仇之嚎')).toBe(true); // [經_怒3]
    expect(hasExpEffect('Ex卡-中毒')).toBe(true);
    expect(hasExpEffect('火球')).toBe(false); // [起_蓋3]
    expect(hasExpEffect('紅心5')).toBe(false);
  });

  it('只有在經驗區、正面朝上、且有經驗效果的卡才是生效中', () => {
    expect(expEffectActive(view('低價買進'))).toBe(true);
    expect(expEffectActive(view('低價買進', true))).toBe(false); // 覆蓋後無效
    expect(expEffectActive(view('火球'))).toBe(false);
  });

  it('看不到牌面的卡（對手覆蓋的經驗卡）不提示', () => {
    expect(expEffectActive(view(null, true))).toBe(false);
    expect(expEffectActive(view(null))).toBe(false);
  });
});
