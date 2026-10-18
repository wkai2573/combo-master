import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { GameView } from '../../engine/view';
import type { HighlightTarget, TutorialProgress } from '../../tutorial/script';
import { captionPosition } from '../tutorialPlacement';
import { sameBoxes, targetBoxes, type Box } from '../tutorialTargets';

/** 按鍵在這些元素上有自己的用途（按鈕、選單），不當成「進入下一步」 */
const OWN_KEYS = 'button, select, input, textarea, a';

/** 點這些地方不算「點畫面」：頂列（離開、動畫速度、手機選單）、手機選單、說明面板與固定說明的取消鈕 */
const FREE_CLICK = '.topbar, .phonemenu, .menuback, .sheet, .sheetback, .pinbar';

const NO_TARGETS: HighlightTarget[] = [];

/** 高亮目標現在在畫面上的位置。每一幀重新量，卡片與版面移動時跟著走；沒有目標時不量 */
function useTargetBoxes(targets: HighlightTarget[], view: GameView): Box[] {
  const [boxes, setBoxes] = useState<Box[]>([]);
  useEffect(() => {
    if (targets.length === 0) {
      setBoxes((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    let raf = 0;
    const tick = () => {
      const next = targetBoxes(targets, view);
      setBoxes((prev) => (sameBoxes(prev, next) ? prev : next));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [targets, view]);
  return boxes;
}

/** 說明框：預設置中，會蓋住高亮目標時移到上半部或下半部 */
function Caption({ text, boxes }: { text: string; boxes: Box[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [, resize] = useState(0);
  useEffect(() => {
    const on = () => resize((n) => n + 1);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  // 量好大小再定位，第一幀就在對的位置
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const next = captionPosition({ width: window.innerWidth, height: window.innerHeight }, { width: el.offsetWidth, height: el.offsetHeight }, boxes);
    setPos((prev) => (prev && prev.left === next.left && prev.top === next.top ? prev : next));
  });
  return (
    <div ref={ref} className="tutorial-caption" role="status" style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}>
      {text}
    </div>
  );
}

/**
 * 新手教學的圖層：說明框與高亮。說明框和高亮不擋操作（卡片說明照常能看），
 * 等點擊時，點畫面任何地方（頂列除外）、按空白鍵或 Enter 進入下一步。
 * active 為 false（動畫還在播）時什麼都不顯示，也不接收操作。
 */
export function TutorialLayer({ progress, view, active, onNext }: { progress: TutorialProgress; view: GameView; active: boolean; onNext: () => void }) {
  // 每次繪製都會是新的函式：用 ref 讀最新的，監聽才不必跟著重新綁
  const next = useRef(onNext);
  next.current = onNext;
  const waitingClick = active && progress.awaiting === 'click';
  const boxes = useTargetBoxes(active ? progress.highlight : NO_TARGETS, view);
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
      {boxes.map((b, i) => (
        <div key={i} className="tutorial-hl" style={{ left: b.left - 4, top: b.top - 4, width: b.width + 8, height: b.height + 8 }} />
      ))}
      {progress.text && <Caption text={progress.text} boxes={boxes} />}
    </>
  );
}
