import { useEffect, useRef } from 'react';
import type { TutorialProgress } from '../../tutorial/script';

/** 按鍵在這些元素上有自己的用途（按鈕、選單），不當成「進入下一步」 */
const OWN_KEYS = 'button, select, input, textarea, a';

/**
 * 新手教學的圖層：中央的說明框，加上全畫面的點擊接收。點畫面任何地方、按空白鍵或 Enter 進入下一步。
 * active 為 false（動畫還在播）時什麼都不顯示，也不接收操作。
 */
export function TutorialLayer({ progress, active, onNext }: { progress: TutorialProgress; active: boolean; onNext: () => void }) {
  // 每次繪製都會是新的函式：用 ref 讀最新的，按鍵監聽才不必跟著重新綁
  const next = useRef(onNext);
  next.current = onNext;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== ' ' && e.key !== 'Enter') || e.repeat) return;
      if (e.target instanceof Element && e.target.closest(OWN_KEYS)) return;
      e.preventDefault();
      next.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  if (!active) return null;
  return (
    <div className="tutorial-layer" onClick={onNext}>
      <div className="tutorial-caption" role="status">{progress.text}</div>
    </div>
  );
}
