import { useSyncExternalStore } from 'react';

/** 寬螢幕版（對戰畫面整頁不捲動）的啟用條件：可視區寬 ≥ 1200 且高 ≥ 800 */
export const WIDE_QUERY = '(min-width: 1200px) and (min-height: 800px)';

const mq = typeof window !== 'undefined' ? window.matchMedia?.(WIDE_QUERY) : undefined;
const subscribe = (cb: () => void) => {
  mq?.addEventListener('change', cb);
  return () => mq?.removeEventListener('change', cb);
};
const getSnapshot = () => mq?.matches ?? false;

export function useWide(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
