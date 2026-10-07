import { useCallback, useEffect, useRef, useState } from 'react';
import type { Frame } from '../engine/view';

export type Speed = 'normal' | 'fast' | 'off';
export const SPEED_LABEL: Record<Speed, string> = { normal: '標準速度', fast: '快速', off: '關閉動畫' };
const SCALE: Record<Speed, number> = { normal: 1, fast: 0.45, off: 0 };

export interface Playing {
  frame: Frame;
  /** 第幾個播放的影格（遞增；用來讓同樣的特效能重新播放） */
  n: number;
}

/**
 * 依序播放引擎錄下的動畫影格。播放中 cur 為目前影格；播完（或跳過）為 null，
 * 此時介面改顯示最新的真實狀態與提示。
 */
export function usePlayback(batch: { id: number; frames: Frame[] } | undefined, speed: Speed) {
  const [cur, setCur] = useState<Playing | null>(null);
  const queue = useRef<Frame[]>([]);
  const playing = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const seen = useRef(0);
  const counter = useRef(0);
  const scale = useRef(SCALE[speed]);
  scale.current = SCALE[speed];

  const step = useCallback(() => {
    const f = queue.current.shift();
    if (!f) {
      playing.current = false;
      setCur(null);
      return;
    }
    setCur({ frame: f, n: ++counter.current });
    timer.current = window.setTimeout(step, Math.max(150, f.ms * scale.current));
  }, []);

  const skip = useCallback(() => {
    window.clearTimeout(timer.current);
    queue.current = [];
    playing.current = false;
    setCur(null);
  }, []);

  useEffect(() => {
    if (!batch || batch.id === seen.current) return;
    seen.current = batch.id;
    if (scale.current === 0) return;
    queue.current.push(...batch.frames);
    if (!playing.current && queue.current.length > 0) {
      playing.current = true;
      step();
    }
  }, [batch, step]);

  // 切到「關閉動畫」時立刻結束目前的播放
  useEffect(() => {
    if (speed === 'off') skip();
  }, [speed, skip]);

  // 卸載（或 StrictMode 的模擬卸載）時重置，之後重新掛載會重新排入同一批影格
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      queue.current = [];
      playing.current = false;
      seen.current = 0;
    },
    [],
  );

  // 新的一批影格已經到了，但還沒開始播（要等這次繪製之後的 effect）：這段空檔不能顯示最終桌面
  const lagging = !!batch && batch.id !== seen.current && batch.frames.length > 0 && SCALE[speed] > 0;
  return { cur, skip, scale: SCALE[speed], lagging };
}
