import type { EffectSource } from '../effectKit';
import { ARCHER_SOURCES } from './archer';
import { COMMON_SOURCES } from './common';
import { MAGE_SOURCES } from './mage';
import { MERCHANT_SOURCES } from './merchant';
import { SWORDSMAN_SOURCES } from './swordsman';
import { THIEF_SOURCES } from './thief';

/**
 * 全部的效果來源。依職業分檔，這裡攤平登記。
 * 窗口選單的順序是常駐位置，再依這裡的登記順序：凡骨的意志要排在中毒之前。
 * 寫成函式是為了不在模組載入時就讀取各職業的陣列，那時它們可能還沒載入完。
 */
export const allSources = (): EffectSource[] => [
  ...SWORDSMAN_SOURCES,
  ...THIEF_SOURCES,
  ...MERCHANT_SOURCES,
  ...ARCHER_SOURCES,
  ...MAGE_SOURCES,
  ...COMMON_SOURCES,
];
