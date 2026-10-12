import { useSyncExternalStore } from 'react';
import { WIDE_QUERY } from './useWide';

/** 對戰畫面的三種版面：寬螢幕版（整頁不捲動）、手機版面（直立手機，整頁不捲動）、窄螢幕版（單欄可捲動） */
export type LayoutMode = 'wide' | 'phone' | 'narrow';

export const WIDE_MIN_W = 1200;
export const WIDE_MIN_H = 800;
export const PHONE_MAX_W = 640;
/** 與 useWide 共用的媒體查詢字串必須同一份數字，這裡只管手機版面 */
export const PHONE_QUERY = `(max-width: ${PHONE_MAX_W}px) and (orientation: portrait)`;

/** 依可視區大小決定版面；寬螢幕版優先，手機版面要寬 ≤ 640 且直立（高 ≥ 寬） */
export function layoutMode(w: number, h: number): LayoutMode {
  if (w >= WIDE_MIN_W && h >= WIDE_MIN_H) return 'wide';
  if (w <= PHONE_MAX_W && h >= w) return 'phone';
  return 'narrow';
}

const phoneMq = typeof window !== 'undefined' ? window.matchMedia?.(PHONE_QUERY) : undefined;
const subscribePhone = (cb: () => void) => {
  phoneMq?.addEventListener('change', cb);
  return () => phoneMq?.removeEventListener('change', cb);
};
const phoneSnapshot = () => phoneMq?.matches ?? false;

/** 目前是不是手機版面 */
export function usePhone(): boolean {
  return useSyncExternalStore(subscribePhone, phoneSnapshot);
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
