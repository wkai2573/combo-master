import { useEffect, useRef, useState } from 'react';
import type { GameView } from '../../engine/view';
import type { HighlightTarget, TutorialProgress } from '../../tutorial/script';
import { sameBoxes, targetBoxes, type Box } from '../tutorialTargets';

/** 按鍵在這些元素上有自己的用途（按鈕、選單），不當成「進入下一步」 */
const OWN_KEYS = 'button, select, input, textarea, a';

/** 點這些地方不算「點畫面」：頂列（離開、動畫速度、手機選單）、手機選單、說明面板與固定說明的取消鈕 */
const FREE_CLICK = '.topbar, .phonemenu, .menuback, .sheet, .sheetback, .pinbar';

/** 高亮：會閃動的虛線外框加光暈。位置每一幀重新量，卡片與版面移動時跟著走 */
function Highlights({ targets, view }: { targets: HighlightTarget[]; view: GameView }) {
  const [boxes, setBoxes] = useState<Box[]>([]);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const next = targetBoxes(targets, view);
      setBoxes((prev) => (sameBoxes(prev, next) ? prev : next));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [targets, view]);
  return (
    <>
      {boxes.map((b, i) => (
        <div key={i} className="tutorial-hl" style={{ left: b.left - 4, top: b.top - 4, width: b.width + 8, height: b.height + 8 }} />
      ))}
    </>
  );
}

/**
 * 新手教學的圖層：中央的說明框與高亮。說明框和高亮不擋操作（卡片說明照常能看），
 * 等點擊時，點畫面任何地方（頂列除外）、按空白鍵或 Enter 進入下一步。
 * active 為 false（動畫還在播）時什麼都不顯示，也不接收操作。
 */
export function TutorialLayer({ progress, view, active, onNext }: { progress: TutorialProgress; view: GameView; active: boolean; onNext: () => void }) {
  // 每次繪製都會是新的函式：用 ref 讀最新的，監聽才不必跟著重新綁
  const next = useRef(onNext);
  next.current = onNext;
  const waitingClick = active && progress.awaiting === 'click';
  useEffect(() => {
    if (!waitingClick) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== ' ' && e.key !== 'Enter') || e.repeat) return;
      if (e.target instanceof Element && e.target.closest(OWN_KEYS)) return;
      e.preventDefault();
      next.current();
    };
    // 捕獲階段攔下點擊：點到卡片、牌區也只是進入下一步，不會觸發它們原本的操作
    const onClick = (e: MouseEvent) => {
      // 已經有人處理過這一下（拖曳放開後吞掉的那次點擊）、或手機的卡片說明開著（這一下是用來關它的）：不算
      if (e.defaultPrevented || document.querySelector('.cardsheet')) return;
      if (e.target instanceof Element && e.target.closest(FREE_CLICK)) return;
      e.stopPropagation();
      e.preventDefault();
      next.current();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick, true);
    };
  }, [waitingClick]);

  if (!active) return null;
  return (
    <>
      {progress.highlight.length > 0 && <Highlights targets={progress.highlight} view={view} />}
      {progress.text && <div className="tutorial-caption" role="status">{progress.text}</div>}
    </>
  );
}
