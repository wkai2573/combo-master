import { describe, expect, it } from 'vitest';
import { initialSpeed } from '../src/ui/usePlayback';

describe('動畫速度的初始值', () => {
  it('玩家選過的速度優先，連標準速度也算（即使瀏覽器要求減少動態）', () => {
    expect(initialSpeed('normal', true)).toBe('normal');
    expect(initialSpeed('fast', true)).toBe('fast');
    expect(initialSpeed('off', false)).toBe('off');
  });

  it('沒選過：瀏覽器要求減少動態就關閉動畫，否則標準速度', () => {
    expect(initialSpeed(null, true)).toBe('off');
    expect(initialSpeed(null, false)).toBe('normal');
  });

  it('儲存的值不認得時，視同沒選過', () => {
    expect(initialSpeed('turbo', true)).toBe('off');
    expect(initialSpeed('', false)).toBe('normal');
  });
});
