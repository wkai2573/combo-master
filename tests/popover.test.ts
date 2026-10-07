import { describe, expect, it } from 'vitest';
import { placePopover } from '../src/ui/popoverPlacement';

const vp = { w: 1920, h: 950 };
const size = { w: 720, h: 360 };

describe('就地展開面板的定位', () => {
  it('下方放得下就放在錨點下方，左緣對齊錨點', () => {
    const r = placePopover({ left: 300, top: 100, right: 400, bottom: 230 }, size, vp);
    expect(r).toEqual({ left: 300, side: 'below', edge: 236, maxH: 950 - 230 - 6 - 8 });
  });

  it('下方放不下就翻到上方，以底緣貼著錨點上緣', () => {
    const r = placePopover({ left: 300, top: 760, right: 400, bottom: 940 }, size, vp);
    expect(r).toEqual({ left: 300, side: 'above', edge: 950 - 760 + 6, maxH: 760 - 6 - 8 });
  });

  it('左右都被限制在可視區內', () => {
    expect(placePopover({ left: 1800, top: 100, right: 1900, bottom: 200 }, size, vp).left).toBe(1920 - 720 - 8);
    expect(placePopover({ left: -50, top: 100, right: 20, bottom: 200 }, size, vp).left).toBe(8);
  });

  it('面板的最大高度不超過所選那一邊剩下的空間', () => {
    const r = placePopover({ left: 0, top: 250, right: 50, bottom: 290 }, { w: 720, h: 360 }, { w: 1000, h: 600 });
    expect(r.side).toBe('below');
    expect(r.maxH).toBe(600 - 290 - 6 - 8);
    const up = placePopover({ left: 0, top: 400, right: 50, bottom: 440 }, { w: 720, h: 360 }, { w: 1000, h: 600 });
    expect(up.side).toBe('above');
    expect(up.maxH).toBe(400 - 6 - 8);
  });

  it('上下都放不下時選空間較大的一邊', () => {
    const small = { w: 800, h: 300 };
    expect(placePopover({ left: 0, top: 200, right: 50, bottom: 240 }, small, { w: 1000, h: 300 }).side).toBe('above');
    expect(placePopover({ left: 0, top: 60, right: 50, bottom: 90 }, small, { w: 1000, h: 300 }).side).toBe('below');
  });
});
