import { describe, expect, it } from 'vitest';
import { layoutMode, WIDE_MIN_H, WIDE_MIN_W } from '../src/ui/layoutMode';
import { WIDE_QUERY } from '../src/ui/useWide';

describe('對戰版面判斷', () => {
  it('寬 ≥ 1200 且高 ≥ 800 是寬螢幕版', () => {
    expect(layoutMode(1200, 800)).toBe('wide');
    expect(layoutMode(1920, 950)).toBe('wide');
  });

  it('直立手機是手機版面', () => {
    expect(layoutMode(390, 780)).toBe('phone');
    expect(layoutMode(360, 640)).toBe('phone');
    expect(layoutMode(640, 900)).toBe('phone');
  });

  it('其餘畫面都是手機版面：橫向手機、平板、矮視窗的筆電', () => {
    expect(layoutMode(780, 360)).toBe('phone');
    expect(layoutMode(768, 1024)).toBe('phone');
    expect(layoutMode(1024, 768)).toBe('phone');
    expect(layoutMode(1366, 650)).toBe('phone');
    expect(layoutMode(1280, 720)).toBe('phone');
    expect(layoutMode(1199, 900)).toBe('phone');
  });

  it('寬螢幕版的門檻差一點就不是寬螢幕版', () => {
    expect(layoutMode(1199, 800)).toBe('phone');
    expect(layoutMode(1200, 799)).toBe('phone');
  });

  it('只有兩種版面，沒有窄螢幕版', () => {
    const modes = new Set<string>();
    for (const w of [320, 640, 800, 1000, 1199, 1200, 1600]) for (const h of [300, 640, 799, 800, 900]) modes.add(layoutMode(w, h));
    expect([...modes].sort()).toEqual(['phone', 'wide']);
  });

  it('媒體查詢與上面的判斷用同一份門檻', () => {
    expect(WIDE_QUERY).toContain(`${WIDE_MIN_W}px`);
    expect(WIDE_QUERY).toContain(`${WIDE_MIN_H}px`);
  });
});
