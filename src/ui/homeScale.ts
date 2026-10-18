/** 主選單選單欄的原始寬度（比例 1 時），用來避免窄螢幕超出視窗 */
const MENU_WIDTH = 360;
const SIDE_GUTTER = 32;
/** 視窗高度 712 時是原本的大小（選單多了一排「新手教學」，比原本的 640 多留 72） */
const BASE_HEIGHT = 712;
const MIN_SCALE = 0.8;
const MAX_SCALE = 1.6;
const HARD_MIN = 0.5;

/**
 * 主選單的縮放比例：依視窗高度連續變化（高度 ÷ 712，限制在 0.8～1.6），視窗高度約 958 時是 135%。
 * 窄螢幕以寬度為準，選單欄加左右留白不會超出視窗。這不是 CSS zoom：所有尺寸都用這個比例重新計算。
 */
export function homeScale(width: number, height: number): number {
  const byHeight = Math.min(MAX_SCALE, Math.max(MIN_SCALE, height / BASE_HEIGHT));
  const byWidth = (width - SIDE_GUTTER) / MENU_WIDTH;
  return Math.max(HARD_MIN, Math.min(byHeight, byWidth));
}
