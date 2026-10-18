import { describe, expect, it } from 'vitest';
import { captionPosition, type Rect } from '../src/ui/tutorialPlacement';

const vp = { width: 1000, height: 800 };
const size = { width: 400, height: 100 };
const rectAt = (p: { left: number; top: number }, s = size): Rect => ({ ...p, ...s });
const overlaps = (a: Rect, b: Rect) =>
  a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
const inside = (r: Rect, v = vp) => r.left >= 0 && r.top >= 0 && r.left + r.width <= v.width && r.top + r.height <= v.height;

describe('教學說明框的位置', () => {
  it('沒有高亮目標：置中', () => {
    expect(captionPosition(vp, size, [])).toEqual({ left: 300, top: 350 });
  });

  it('目標沒被蓋住：維持置中', () => {
    const target = { left: 20, top: 20, width: 100, height: 100 };
    expect(captionPosition(vp, size, [target])).toEqual({ left: 300, top: 350 });
  });

  it('目標在中央：移到上半部或下半部，不蓋住目標，也不超出畫面', () => {
    const target = { left: 400, top: 300, width: 200, height: 200 };
    const p = captionPosition(vp, size, [target]);
    expect(overlaps(rectAt(p), target)).toBe(false);
    expect(inside(rectAt(p))).toBe(true);
  });

  it('上半部被目標占住、下半部空著：移到下半部', () => {
    const target = { left: 300, top: 150, width: 400, height: 300 };
    const p = captionPosition(vp, size, [target]);
    expect(p.top).toBeGreaterThanOrEqual(400);
    expect(overlaps(rectAt(p), target)).toBe(false);
  });

  it('下半部被目標占住、上半部空著：移到上半部', () => {
    const target = { left: 300, top: 350, width: 400, height: 300 };
    const p = captionPosition(vp, size, [target]);
    expect(p.top + size.height).toBeLessThanOrEqual(400);
    expect(overlaps(rectAt(p), target)).toBe(false);
  });

  it('兩邊都有目標：選重疊較少的那一邊', () => {
    const big = { left: 0, top: 0, width: 1000, height: 380 };
    const small = { left: 450, top: 430, width: 100, height: 40 };
    const p = captionPosition(vp, size, [big, small]);
    expect(p.top).toBeGreaterThanOrEqual(400);
  });

  it('某一半的空間放不下說明框：只能用另一半', () => {
    const tall = { width: 400, height: 500 };
    const target = { left: 0, top: 380, width: 1000, height: 60 };
    const p = captionPosition(vp, tall, [target]);
    expect(inside(rectAt(p, tall))).toBe(true);
  });

  it('可視區很小：說明框不超出畫面', () => {
    const small = { width: 320, height: 400 };
    const box = { width: 300, height: 180 };
    const target = { left: 40, top: 100, width: 240, height: 200 };
    const p = captionPosition(small, box, [target]);
    expect(inside(rectAt(p, box), small)).toBe(true);
  });

  it('說明框比可視區還大：貼著左上角，不出現負座標', () => {
    const p = captionPosition({ width: 200, height: 150 }, { width: 300, height: 220 }, []);
    expect(p).toEqual({ left: 0, top: 0 });
  });
});
