import { describe, expect, it } from 'vitest';
import { flyFrames } from '../src/ui/flightFrames';

const geo = { dx: 10, dy: -20, sx: 2.5, sy: 2.4 };

describe('飛行卡的關鍵影格', () => {
  it('一般的飛行：從起點的位置與縮放開始，一直是不透明', () => {
    const f = flyFrames(geo, false);
    expect(f).toHaveLength(2);
    expect(f[0].transform).toBe('translate(10px, -20px) scale(2.5, 2.4)');
    expect(f[1].transform).toBe('none');
    expect(f.every((k) => k.opacity === 1)).toBe(true);
  });

  it('從中央放大出發：先全透明（不和放大的牌疊在一起），很快淡入，再飛向終點', () => {
    const f = flyFrames(geo, true);
    expect(f[0].opacity).toBe(0);
    expect(f[1].transform).toBeUndefined();
    expect(f[1].opacity).toBe(1);
    expect(f[f.length - 1].transform).toBe('none');
    expect(f.map((k) => k.offset)).toEqual([0, 0.25, 1]);
  });
});
