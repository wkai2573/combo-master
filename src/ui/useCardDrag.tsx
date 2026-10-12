import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { DropZone, Request } from '../engine/types';
import { CardFace } from './components/CardFace';
import { classifyMove, dragZone, dropTarget, type Pt } from './dragGesture';

/** 放置區的判定範圍多放寬一點，手指不用剛好壓在邊框內 */
const DROP_PAD = 6;

export interface DragApi {
  /** 這張牌現在能不能拖曳：能就回傳它的放置區 */
  zoneFor: (key: string) => DropZone | null;
  /** 在手牌上按下時呼叫：開始追蹤手勢，確認是拖曳之後才接管 */
  start: (e: ReactPointerEvent, key: string, id: string | null) => void;
  /** 正在被拖的那張牌 */
  draggingKey: string | null;
}

interface Dragging { key: string; id: string; x: number; y: number }

const zoneBoxes = (zone: DropZone) =>
  [...document.querySelectorAll<HTMLElement>(`[data-dropzone="${zone}"]`)].map((el) => ({ zone, box: el.getBoundingClientRect(), el }));

/**
 * 手牌拖曳使用：按住手牌往放置區拖，放開在放置區就送出，放在別處牌回到手牌。
 * 滑鼠移動超過一點距離就開始拖；觸控往上拖才開始，橫向移動留給手牌列捲動。
 * 拖曳期間，放置區的元素（data-dropzone）靠 body 的 data-drag 標示亮起。
 */
export function useCardDrag(prompt: Request | null, onDrop: (keys: string[]) => void): { api: DragApi; ghost: ReactNode } {
  const [dragging, setDragging] = useState<Dragging | null>(null);
  const promptRef = useRef(prompt);
  promptRef.current = prompt;
  const dropRef = useRef(onDrop);
  dropRef.current = onDrop;
  const cleanupRef = useRef<(() => void) | null>(null);

  // 提示真的換了或收掉（動畫開始、對手回合）：進行中的拖曳作廢。內容相同的新物件（只是重新收到狀態）不算
  const sig = prompt ? `${prompt.title}|${prompt.dropZone}|${prompt.options.map((o) => o.key).join(',')}` : '';
  useEffect(() => () => cleanupRef.current?.(), [sig]);
  useEffect(() => () => cleanupRef.current?.(), []);

  const zoneFor = useCallback((key: string) => dragZone(promptRef.current, key), []);

  const start = useCallback((e: ReactPointerEvent, key: string, id: string | null) => {
    if (id === null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const zone = dragZone(promptRef.current, key);
    if (!zone) return;
    cleanupRef.current?.();
    const touch = e.pointerType !== 'mouse';
    // 手牌列放得下就不能橫向捲動，橫向移動不需要留給捲動
    const row = (e.currentTarget as HTMLElement).closest<HTMLElement>('.handrow');
    const scrollable = !!row && row.scrollWidth > row.clientWidth + 1;
    const pointerId = e.pointerId;
    const from: Pt = { x: e.clientX, y: e.clientY };
    let active = false;

    const mark = (pt: Pt) => {
      const over = dropTarget(pt, zoneBoxes(zone), DROP_PAD) === zone;
      for (const { el } of zoneBoxes(zone)) el.toggleAttribute('data-dragover', over);
    };
    // 拖曳開始後擋掉瀏覽器的捲動，否則手指橫移時瀏覽器會接手、取消這次拖曳
    const stopScroll = (ev: TouchEvent) => { if (ev.cancelable) ev.preventDefault(); };
    const swallowClick = () => {
      const eat = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
      window.addEventListener('click', eat, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', eat, { capture: true }), 60);
    };

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const pt = { x: ev.clientX, y: ev.clientY };
      if (!active) {
        const g = classifyMove(from, pt, touch, scrollable);
        if (g === 'pending') return;
        if (g === 'scroll') return cleanup();
        active = true;
        document.body.dataset.drag = zone;
        window.addEventListener('touchmove', stopScroll, { passive: false });
      }
      setDragging({ key, id, x: pt.x, y: pt.y });
      mark(pt);
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const hit = active && dropTarget({ x: ev.clientX, y: ev.clientY }, zoneBoxes(zone), DROP_PAD) === zone;
      const wasActive = active;
      cleanup();
      if (wasActive) swallowClick();
      if (hit) dropRef.current([key]);
    };
    function cleanup() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cleanup);
      window.removeEventListener('touchmove', stopScroll);
      delete document.body.dataset.drag;
      document.querySelectorAll('[data-dragover]').forEach((el) => el.removeAttribute('data-dragover'));
      cleanupRef.current = null;
      setDragging(null);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cleanup);
    cleanupRef.current = cleanup;
  }, []);

  const api: DragApi = { zoneFor, start, draggingKey: dragging?.key ?? null };
  const ghost = dragging && (
    <div className="dragghost" style={{ left: dragging.x, top: dragging.y }}>
      <CardFace id={dragging.id} size="sm" />
    </div>
  );
  return { api, ghost };
}
