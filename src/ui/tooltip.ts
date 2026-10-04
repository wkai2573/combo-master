import { useSyncExternalStore } from 'react';
import type { Keyword } from '../data/keywords';

/** 關鍵字提示：全站共用一個浮動提示，位置跟著被指到的關鍵字 */
export interface Tip {
  left: number;
  top: number;
  kws: Keyword[];
}

let tip: Tip | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function showTip(el: HTMLElement, kws: Keyword[]) {
  const r = el.getBoundingClientRect();
  tip = { left: r.left, top: r.bottom + 6, kws };
  emit();
}

export function hideTip() {
  if (!tip) return;
  tip = null;
  emit();
}

export const useTip = () =>
  useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => tip,
  );
