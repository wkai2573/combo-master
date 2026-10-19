import { describe, expect, it } from 'vitest';
import { doneLessons, isLessonDone, recommendedNext, setLessonDone, showRecommendTag } from '../src/tutorial/completion';

const memory = (init: Record<string, string> = {}) => {
  const m = new Map<string, string>(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const broken = {
  getItem: () => { throw new Error('讀取失敗'); },
  setItem: () => { throw new Error('寫入失敗'); },
};

describe('教學課程的完成紀錄', () => {
  it('預設沒完成；寫入後讀到已完成，重複寫入仍是已完成', () => {
    const s = memory();
    expect(isLessonDone(1, s)).toBe(false);
    setLessonDone(1, s);
    expect(isLessonDone(1, s)).toBe(true);
    setLessonDone(1, s);
    expect(isLessonDone(1, s)).toBe(true);
  });

  it('逐課記錄：完成一課不影響別課', () => {
    const s = memory();
    setLessonDone(2, s);
    expect(isLessonDone(1, s)).toBe(false);
    expect(isLessonDone(2, s)).toBe(true);
    expect(doneLessons([1, 2, 3], s)).toEqual(new Set([2]));
  });

  it('舊版的單一完成旗標作廢：不影響新紀錄', () => {
    const s = memory({ 'lianji.tutorial.done': '1' });
    expect(isLessonDone(1, s)).toBe(false);
    expect(doneLessons([1, 2], s).size).toBe(0);
  });

  it('儲存空間不可用：讀到沒完成，寫入也不丟出錯誤', () => {
    expect(isLessonDone(1, broken)).toBe(false);
    expect(doneLessons([1, 2], broken).size).toBe(0);
    expect(() => setLessonDone(1, broken)).not.toThrow();
    expect(isLessonDone(1, null)).toBe(false);
    expect(() => setLessonDone(1, null)).not.toThrow();
  });

  it('不認得的內容視為沒完成', () => {
    expect(isLessonDone(1, { getItem: () => 'yes', setItem: () => {} })).toBe(false);
  });
});

describe('「推薦」標籤與「推薦下一課」', () => {
  it('主畫面的標籤只看第 1 課：沒完成就顯示，完成後消失；完成別課不影響', () => {
    expect(showRecommendTag(new Set(), 1)).toBe(true);
    expect(showRecommendTag(new Set([2, 3]), 1)).toBe(true);
    expect(showRecommendTag(new Set([1]), 1)).toBe(false);
  });

  it('第 1 課還沒完成：清單不標推薦下一課', () => {
    expect(recommendedNext([1, 2, 3], new Set())).toBeNull();
    expect(recommendedNext([1, 2, 3], new Set([2]))).toBeNull();
  });

  it('第 1 課完成後：標尚未完成的最前面一課', () => {
    expect(recommendedNext([1, 2, 3], new Set([1]))).toBe(2);
    expect(recommendedNext([1, 2, 3], new Set([1, 2]))).toBe(3);
    expect(recommendedNext([1, 2, 3], new Set([1, 3]))).toBe(2);
  });

  it('全部完成、或只有一課：沒有推薦下一課', () => {
    expect(recommendedNext([1, 2, 3], new Set([1, 2, 3]))).toBeNull();
    expect(recommendedNext([1], new Set([1]))).toBeNull();
    expect(recommendedNext([], new Set())).toBeNull();
  });
});
