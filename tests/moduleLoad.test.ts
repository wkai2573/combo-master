import { describe, expect, it, vi } from 'vitest';

/**
 * 效果來源、費用與各職業的條目彼此匯入：載入順序不同時，任何一個模組先被載入都不能出錯。
 * 每個模組在乾淨的模組快取下當第一個被匯入的來測。
 */
const MODULES = [
  '../src/engine/effectKit',
  '../src/engine/effects',
  '../src/engine/cost',
  '../src/engine/judge',
  '../src/engine/combatStats',
  '../src/engine/combat',
  '../src/engine/game',
  '../src/engine/sources',
  '../src/engine/sources/swordsman',
  '../src/engine/sources/thief',
  '../src/engine/sources/merchant',
  '../src/engine/sources/archer',
  '../src/engine/sources/mage',
  '../src/engine/sources/common',
];

describe('模組載入順序', () => {
  it.each(MODULES)('%s 當第一個被載入也不會出錯', async (path) => {
    vi.resetModules();
    await expect(import(/* @vite-ignore */ path)).resolves.toBeDefined();
  });
});
