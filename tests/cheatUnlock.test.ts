import { describe, expect, it } from 'vitest';
import { applyCheatParam, createTapCounter, isCheatUnlocked, setCheatUnlocked } from '../src/cheatUnlock';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};
const broken = {
  getItem: () => { throw new Error('讀取失敗'); },
  setItem: () => { throw new Error('寫入失敗'); },
  removeItem: () => { throw new Error('刪除失敗'); },
};

describe('作弊解鎖：預設隱藏，旗標存在本機儲存', () => {
  it('沒有旗標就是未解鎖；解鎖後持久；關閉後回到未解鎖', () => {
    const s = memory();
    expect(isCheatUnlocked(s)).toBe(false);
    setCheatUnlocked(true, s);
    expect(isCheatUnlocked(s)).toBe(true);
    setCheatUnlocked(false, s);
    expect(isCheatUnlocked(s)).toBe(false);
  });

  it('儲存拋錯、沒有儲存時視為未解鎖，寫入失敗不拋出', () => {
    expect(isCheatUnlocked(broken)).toBe(false);
    expect(() => setCheatUnlocked(true, broken)).not.toThrow();
    expect(() => setCheatUnlocked(false, broken)).not.toThrow();
    expect(isCheatUnlocked(null)).toBe(false);
    expect(() => setCheatUnlocked(true, null)).not.toThrow();
  });
});

describe('作弊解鎖：網址參數', () => {
  it('cheat=1 解鎖並把參數從網址拿掉，其他參數保留', () => {
    const s = memory();
    expect(applyCheatParam('?cheat=1', s)).toEqual({ search: '', changed: true });
    expect(isCheatUnlocked(s)).toBe(true);
    expect(applyCheatParam('?a=1&cheat=1&b=2', s)).toEqual({ search: '?a=1&b=2', changed: true });
  });

  it('cheat=0 關閉解鎖', () => {
    const s = memory();
    setCheatUnlocked(true, s);
    expect(applyCheatParam('?cheat=0', s)).toEqual({ search: '', changed: true });
    expect(isCheatUnlocked(s)).toBe(false);
  });

  it('沒有參數或值不認得：不改動狀態', () => {
    const s = memory();
    setCheatUnlocked(true, s);
    expect(applyCheatParam('?a=1', s)).toEqual({ search: '?a=1', changed: false });
    expect(applyCheatParam('', s)).toEqual({ search: '', changed: false });
    expect(applyCheatParam('?cheat=yes', s)).toEqual({ search: '', changed: false });
    expect(isCheatUnlocked(s)).toBe(true);
  });

  it('儲存壞掉時處理網址仍然不拋出', () => {
    expect(() => applyCheatParam('?cheat=1', broken)).not.toThrow();
  });
});

describe('作弊解鎖：連點版本號', () => {
  it('時間窗內點滿次數才解鎖，解鎖後重新計算', () => {
    const c = createTapCounter(3, 1000);
    expect([c.tap(0), c.tap(100), c.tap(200)]).toEqual([false, false, true]);
    expect([c.tap(300), c.tap(400)]).toEqual([false, false]);
  });

  it('超過時間窗的舊點擊不算', () => {
    const c = createTapCounter(3, 1000);
    expect([c.tap(0), c.tap(500), c.tap(1600)]).toEqual([false, false, false]);
    expect([c.tap(1700), c.tap(1800)]).toEqual([false, true]);
  });
});
