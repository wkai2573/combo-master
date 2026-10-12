import { useSyncExternalStore } from 'react';
import { useWide, WIDE_MIN_H, WIDE_MIN_W } from './useWide';

export { WIDE_MIN_H, WIDE_MIN_W };

/** 對戰畫面的兩種版面：寬螢幕版（整頁不捲動），其餘畫面一律用手機版面（單欄直欄，太矮時整頁可捲動） */
export type LayoutMode = 'wide' | 'phone';

/** 依可視區大小決定版面；達到寬螢幕版的寬高門檻就是寬螢幕版，其餘都是手機版面 */
export function layoutMode(w: number, h: number): LayoutMode {
  return w >= WIDE_MIN_W && h >= WIDE_MIN_H ? 'wide' : 'phone';
}

/** 目前是不是手機版面：凡是不是寬螢幕版的畫面都是 */
export function usePhone(): boolean {
  return !useWide();
}

const coarseMq = typeof window !== 'undefined' ? window.matchMedia?.('(hover: none) and (pointer: coarse)') : undefined;
const subscribeCoarse = (cb: () => void) => {
  coarseMq?.addEventListener('change', cb);
  return () => coarseMq?.removeEventListener('change', cb);
};
const coarseSnapshot = () => coarseMq?.matches ?? false;

/** 主要輸入是觸控、沒有滑鼠懸停（接了滑鼠的混合裝置不算）：卡片要先選取看預覽，再點一下才送出 */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribeCoarse, coarseSnapshot);
}
