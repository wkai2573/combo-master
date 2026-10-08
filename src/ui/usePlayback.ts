import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { GameView } from '../engine/view';
import { Playback, type Batch, type Presentation, type Speed } from './playback';

export type { Speed } from './playback';
export const SPEED_LABEL: Record<Speed, string> = { normal: '標準速度', fast: '快速', off: '關閉動畫' };
/**
 * 速度的初始值：玩家選過的優先（連標準速度也算）；沒選過就看瀏覽器是否要求減少動態。
 * stored 為儲存的偏好原始值，無法讀取時給 null。
 */
export function initialSpeed(stored: string | null, reducedMotion: boolean): Speed {
  if (stored === 'normal' || stored === 'fast' || stored === 'off') return stored;
  return reducedMotion ? 'off' : 'normal';
}

const SPEED_KEY = 'lianji.speed';

/** 動畫速度與它的偏好：讀不到或存不進儲存時視同沒選過，不影響使用 */
export function useSpeed(): [Speed, (s: Speed) => void] {
  const [speed, setSpeedState] = useState<Speed>(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(SPEED_KEY);
    } catch {
      // 無法讀取偏好：視同沒選過
    }
    return initialSpeed(stored, window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  });
  const setSpeed = useCallback((s: Speed) => {
    setSpeedState(s);
    try {
      localStorage.setItem(SPEED_KEY, s);
    } catch {
      // 無法儲存偏好：忽略
    }
  }, []);
  return [speed, setSpeed];
}

/**
 * 依序播放引擎錄下的動畫影格，回傳此刻的呈現。播放的規則都在 Playback，這裡只負責計時器與生命週期。
 * batch 是最新收到的一批影格，final 是最新的真實狀態。
 */
export function usePlayback(batch: Batch | undefined, final: GameView | null, speed: Speed) {
  const [pb] = useState(() => new Playback());
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  const timer = useRef<number | undefined>(undefined);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  // hold 是這一格要停留的毫秒；null 表示沒有開始新的一格（不動已經在跑的計時器）
  const schedule = useCallback(
    (hold: number | null) => {
      if (hold !== null) timer.current = window.setTimeout(() => schedule(pb.advance(speedRef.current)), hold);
      bump();
    },
    [pb],
  );

  const skip = useCallback(() => {
    window.clearTimeout(timer.current);
    pb.skip();
    bump();
  }, [pb]);

  useEffect(() => schedule(pb.ingest(batch, speedRef.current)), [batch, pb, schedule]);

  // 切到「關閉動畫」時立刻結束目前的播放
  useEffect(() => {
    if (speed === 'off') skip();
  }, [speed, skip]);

  // 卸載（或 StrictMode 的模擬卸載）時重置，之後重新掛載會重新排入同一批影格
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      pb.reset();
    },
    [pb],
  );

  const presentation: Presentation = useMemo(
    // version 變了代表 Playback 的內部狀態變了，要重算
    () => pb.present(batch, final, speed),
    [pb, batch, final, speed, version],
  );
  // 渲染之後記下顯示的桌面，下一格的數值變化拿它來比
  useEffect(() => pb.settle(presentation), [pb, presentation]);

  return { presentation, skip };
}
