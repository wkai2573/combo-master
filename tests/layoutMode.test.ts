import { describe, expect, it } from 'vitest';
import { layoutMode, PHONE_QUERY } from '../src/ui/layoutMode';
import { WIDE_QUERY } from '../src/ui/useWide';

describe('對戰版面判斷', () => {
  it('寬 ≥ 1200 且高 ≥ 800 是寬螢幕版', () => {
    expect(layoutMode(1200, 800)).toBe('wide');
    expect(layoutMode(1920, 950)).toBe('wide');
  });

  it('寬 ≤ 640 且直立是手機版面', () => {
    expect(layoutMode(390, 780)).toBe('phone');
    expect(layoutMode(360, 640)).toBe('phone');
    expect(layoutMode(640, 900)).toBe('phone');
  });

  it('橫向手機維持窄螢幕版', () => {
    expect(layoutMode(780, 360)).toBe('narrow');
    expect(layoutMode(640, 360)).toBe('narrow');
  });

  it('平板與其他介於中間的尺寸是窄螢幕版', () => {
    expect(layoutMode(768, 1024)).toBe('narrow');
    expect(layoutMode(1199, 900)).toBe('narrow');
    expect(layoutMode(1400, 700)).toBe('narrow');
  });

  it('剛好超過 640 就不是手機版面', () => {
    expect(layoutMode(641, 900)).toBe('narrow');
  });

  it('正方形視窗算直立（高不小於寬）', () => {
    expect(layoutMode(600, 600)).toBe('phone');
    expect(layoutMode(600, 599)).toBe('narrow');
  });

  it('媒體查詢與上面的判斷用同一份門檻', () => {
    expect(PHONE_QUERY).toContain('640px');
    expect(PHONE_QUERY).toContain('portrait');
    expect(WIDE_QUERY).toContain('1200px');
    expect(WIDE_QUERY).toContain('800px');
  });
});
