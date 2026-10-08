import { describe, expect, it } from 'vitest';
import pkg from '../package.json';
import { CHANGELOG } from '../src/data/changelog';

const parse = (v: string) => v.split('.').map(Number);
/** 版本比較：a 比 b 新回傳正數 */
function compare(a: string, b: string): number {
  const [pa, pb] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

describe('更新日誌資料', () => {
  it('至少有一筆，每筆至少一條內容', () => {
    expect(CHANGELOG.length).toBeGreaterThan(0);
    for (const e of CHANGELOG) {
      expect(e.items.length, e.version).toBeGreaterThan(0);
      for (const it of e.items) expect(it.text.trim(), e.version).not.toBe('');
    }
  });

  it('版本格式為 x.y.z，日期為合法的 YYYY-MM-DD', () => {
    for (const e of CHANGELOG) {
      expect(e.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(`${e.date}T00:00:00Z`).toISOString().slice(0, 10), e.version).toBe(e.date);
    }
  });

  it('版本由新到舊嚴格遞減，日期不會越往前越晚', () => {
    for (let i = 1; i < CHANGELOG.length; i++) {
      expect(compare(CHANGELOG[i - 1].version, CHANGELOG[i].version), CHANGELOG[i].version).toBeGreaterThan(0);
      expect(CHANGELOG[i - 1].date >= CHANGELOG[i].date, CHANGELOG[i].version).toBe(true);
    }
  });

  it('最新一筆不高於 package.json 的版本（純重構升版可以不列）', () => {
    expect(compare(CHANGELOG[0].version, pkg.version)).toBeLessThanOrEqual(0);
  });

  it('條目類型只有新增、調整、修正', () => {
    for (const e of CHANGELOG) for (const it of e.items) expect(['add', 'change', 'fix']).toContain(it.type);
  });
});
