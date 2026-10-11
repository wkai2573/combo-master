/** 主選單選單欄的原始寬度（比例 1 時），用來避免窄螢幕超出視窗 */
const MENU_WIDTH = 360;
const SIDE_GUTTER = 32;
/** 視窗高度 640 時是原本的大小 */
const BASE_HEIGHT = 640;
const MIN_SCALE = 0.85;
const MAX_SCALE = 1.6;
const HARD_MIN = 0.5;

/**
 * 主選單的縮放比例：依視窗高度連續變化（高度 ÷ 640，限制在 0.85～1.6），視窗高度約 958 時是 150%。
 * 窄螢幕以寬度為準，選單欄加左右留白不會超出視窗。這不是 CSS zoom：所有尺寸都用這個比例重新計算。
 */
export function homeScale(width: number, height: number): number {
  const byHeight = Math.min(MAX_SCALE, Math.max(MIN_SCALE, height / BASE_HEIGHT));
  const byWidth = (width - SIDE_GUTTER) / MENU_WIDTH;
  return Math.max(HARD_MIN, Math.min(byHeight, byWidth));
}
