import { describe, expect, it } from 'vitest';
import { isTutorialDone, setTutorialDone } from '../src/tutorial/completion';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const broken = {
  getItem: () => { throw new Error('讀取失敗'); },
  setItem: () => { throw new Error('寫入失敗'); },
};

describe('新手教學的完成紀錄', () => {
  it('預設沒完成；寫入後讀到已完成，重複寫入仍是已完成', () => {
    const s = memory();
    expect(isTutorialDone(s)).toBe(false);
    setTutorialDone(s);
    expect(isTutorialDone(s)).toBe(true);
    setTutorialDone(s);
    expect(isTutorialDone(s)).toBe(true);
  });

  it('儲存空間不可用：讀到沒完成，寫入也不丟出錯誤', () => {
    expect(isTutorialDone(broken)).toBe(false);
    expect(() => setTutorialDone(broken)).not.toThrow();
    expect(isTutorialDone(null)).toBe(false);
    expect(() => setTutorialDone(null)).not.toThrow();
  });

  it('不認得的內容視為沒完成', () => {
    expect(isTutorialDone({ getItem: () => 'yes', setItem: () => {} })).toBe(false);
  });
});
