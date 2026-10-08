import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** 滑鼠移動超過這個距離才算拖曳，以下仍是一般的點擊 */
const MOUSE_SLOP = 4;
/** 觸控要按住這麼久才開始拖，之前手指移動會當成捲動 */
const LONG_PRESS_MS = 200;
/** 長按等待期間手指移動超過這個距離，就當成捲動而放棄拖曳 */
const TOUCH_SLOP = 8;
/** 補位與放開的動畫 */
const SLIDE_MS = 200;
const SLIDE_EASING = 'cubic-bezier(.2, .8, .3, 1)';
/** 拖到可捲動區域邊緣這個範圍內會自動捲動 */
const EDGE = 36;
const MAX_SCROLL_SPEED = 14;
/** 判斷滑到哪張卡上時，把每張卡向外放寬一點，涵蓋卡片之間的縫隙 */
const HIT_PAD = 4;

interface Props<T> {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  /**
   * 放開後交出新的順序（key 陣列）。回傳 Promise 時，畫面先照新順序排好，等它結束才改回依 items 排：
   * 成功時 items 已經更新，失敗時就退回原來的順序。
   */
  onReorder: (keys: string[]) => Promise<unknown> | void;
  disabled?: boolean;
  className?: string;
  /** 固定排在最前面、不能拖也不參與排序的內容 */
  prefix?: ReactNode;
  /** 沒有任何項目時顯示 */
  empty?: ReactNode;
}

interface DragState {
  key: string;
  pointerId: number;
  touch: boolean;
  startX: number;
  startY: number;
  clientX: number;
  clientY: number;
  active: boolean;
  /** 抓住的位置在卡片裡的偏移（內容座標） */
  grabX: number;
  grabY: number;
  /** 拖曳前與目前的順序 */
  initial: string[];
  order: string[];
  timer?: ReturnType<typeof setTimeout>;
  raf?: number;
  scrollers: HTMLElement[];
  /** 拆掉這次拖曳掛的事件監聽 */
  detach?: () => void;
}

/** 以 base 為準，套用暫時的順序：暫時順序裡已不存在的項目略過，新出現的接在最後 */
function applyOrder(base: string[], override: string[] | null): string[] {
  if (!override) return base;
  const exist = new Set(base);
  const kept = override.filter((k) => exist.has(k));
  const seen = new Set(kept);
  return [...kept, ...base.filter((k) => !seen.has(k))];
}

const sameKeys = (a: string[], b: string[]) => a.length === b.length && a.every((k, i) => k === b[i]);

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function scrollParents(from: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (let el: HTMLElement | null = from; el; el = el.parentElement) {
    const s = getComputedStyle(el);
    if (/(auto|scroll)/.test(s.overflowX + s.overflowY)) out.push(el);
  }
  return out;
}

/**
 * 可以拖曳排序的清單，手感比照 SortableJS：
 * 按住卡片拖動，被拖的卡跟著游標浮起，其他卡滑動補位，放開時滑進新的格子。
 * 用 pointer events，滑鼠與觸控都通；觸控要長按才會開始拖，不影響捲動。
 * 項目裡標了 data-nodrag 的元素（按鈕等）不會觸發拖曳。
 */
export function SortableList<T>({ items, getKey, renderItem, onReorder, disabled, className, prefix, empty }: Props<T>) {
  const [override, setOverride] = useState<string[] | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const prev = useRef(new Map<string, { x: number; y: number }>());
  const drag = useRef<DragState | null>(null);
  const swallowClick = useRef(false);
  const mounted = useRef(false);

  const baseKeys = items.map(getKey);
  const keys = applyOrder(baseKeys, override);
  const byKey = new Map(items.map((it) => [getKey(it), it]));

  const latest = useRef({ keys, onReorder, disabled });
  latest.current = { keys, onReorder, disabled };

  /** 指標位置換算成清單內容座標（offsetLeft／offsetTop 同一套座標，不受縮放與動畫的 transform 影響） */
  const toContent = (clientX: number, clientY: number) => {
    const box = boxRef.current!;
    const r = box.getBoundingClientRect();
    return { x: clientX - r.left - box.clientLeft + box.scrollLeft, y: clientY - r.top - box.clientTop + box.scrollTop };
  };

  const placeDragged = () => {
    const d = drag.current;
    const el = d && els.current.get(d.key);
    if (!d || !d.active || !el) return;
    const p = toContent(d.clientX, d.clientY);
    el.style.transform = `translate(${p.x - d.grabX - el.offsetLeft}px, ${p.y - d.grabY - el.offsetTop}px) scale(1.06)`;
  };

  // 每次畫面更新後：被拖的卡貼著游標，其他卡從舊位置滑到新位置（FLIP），新出現的卡淡入
  useLayoutEffect(() => {
    const animate = !reducedMotion();
    const alive = new Set<string>();
    els.current.forEach((el, key) => {
      alive.add(key);
      const x = el.offsetLeft;
      const y = el.offsetTop;
      const before = prev.current.get(key);
      prev.current.set(key, { x, y });
      if (drag.current?.active && drag.current.key === key) {
        placeDragged();
        return;
      }
      if (!animate) return;
      if (before) {
        if (before.x === x && before.y === y) return;
        // 動畫進行到一半又被打斷：從目前看到的位置接著滑
        const m = new DOMMatrix(getComputedStyle(el).transform);
        const dx = before.x + m.e - x;
        const dy = before.y + m.f - y;
        el.getAnimations().forEach((a) => a.cancel());
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], { duration: SLIDE_MS, easing: SLIDE_EASING });
      } else if (mounted.current) {
        el.animate([{ opacity: 0, transform: 'scale(.8)' }, { opacity: 1, transform: 'scale(1)' }], { duration: SLIDE_MS, easing: SLIDE_EASING });
      }
    });
    for (const k of [...prev.current.keys()]) if (!alive.has(k)) prev.current.delete(k);
    mounted.current = true;
  });

  // 拖到一半畫面就關掉：拆掉掛在 window 上的監聽
  useEffect(() => () => drag.current?.detach?.(), []);

  const hitTest = (d: DragState) => {
    const p = toContent(d.clientX, d.clientY);
    const inside = (k: string) => {
      const el = els.current.get(k);
      return !!el && p.x >= el.offsetLeft - HIT_PAD && p.x <= el.offsetLeft + el.offsetWidth + HIT_PAD
        && p.y >= el.offsetTop - HIT_PAD && p.y <= el.offsetTop + el.offsetHeight + HIT_PAD;
    };
    // 還在自己的格子裡就不動，否則剛換位置的卡會被隔壁的卡立刻換回來
    if (inside(d.key)) return;
    const current = latest.current.keys;
    const hit = current.find((k) => k !== d.key && inside(k));
    if (!hit) return;
    const next = current.filter((k) => k !== d.key);
    next.splice(current.indexOf(hit), 0, d.key);
    d.order = next;
    setOverride(next);
  };

  const update = (d: DragState) => {
    placeDragged();
    hitTest(d);
  };

  const autoScroll = (d: DragState) => {
    const tick = () => {
      if (drag.current !== d || !d.active) return;
      let moved = false;
      for (const sc of d.scrollers) {
        const r = sc.getBoundingClientRect();
        const speed = (dist: number) => Math.ceil(MAX_SCROLL_SPEED * Math.min(1, (EDGE - dist) / EDGE));
        let dy = 0;
        let dx = 0;
        if (sc.scrollHeight > sc.clientHeight) {
          if (d.clientY < r.top + EDGE) dy = -speed(Math.max(0, d.clientY - r.top));
          else if (d.clientY > r.bottom - EDGE) dy = speed(Math.max(0, r.bottom - d.clientY));
        }
        if (sc.scrollWidth > sc.clientWidth) {
          if (d.clientX < r.left + EDGE) dx = -speed(Math.max(0, d.clientX - r.left));
          else if (d.clientX > r.right - EDGE) dx = speed(Math.max(0, r.right - d.clientX));
        }
        if (dx || dy) {
          const bx = sc.scrollLeft;
          const by = sc.scrollTop;
          sc.scrollLeft += dx;
          sc.scrollTop += dy;
          if (sc.scrollLeft !== bx || sc.scrollTop !== by) moved = true;
          break;
        }
      }
      if (moved) update(d);
      d.raf = requestAnimationFrame(tick);
    };
    d.raf = requestAnimationFrame(tick);
  };

  const onPointerDown = (e: React.PointerEvent, key: string) => {
    if (latest.current.disabled || drag.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-nodrag]')) return;
    const touch = e.pointerType !== 'mouse';
    const d: DragState = {
      key, pointerId: e.pointerId, touch, startX: e.clientX, startY: e.clientY, clientX: e.clientX, clientY: e.clientY,
      active: false, grabX: 0, grabY: 0, initial: latest.current.keys, order: latest.current.keys, scrollers: [],
    };
    drag.current = d;

    const begin = () => {
      const el = els.current.get(key);
      if (!el || drag.current !== d) return;
      d.active = true;
      const p = toContent(d.clientX, d.clientY);
      d.grabX = p.x - el.offsetLeft;
      d.grabY = p.y - el.offsetTop;
      d.scrollers = scrollParents(boxRef.current!);
      el.getAnimations().forEach((a) => a.cancel());
      el.style.transformOrigin = `${d.grabX}px ${d.grabY}px`;
      setDragKey(key);
      placeDragged();
      autoScroll(d);
    };

    const detach = () => {
      clearTimeout(d.timer);
      if (d.raf !== undefined) cancelAnimationFrame(d.raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('touchmove', onTouchMove);
      if (drag.current === d) drag.current = null;
    };
    d.detach = detach;

    function onMove(ev: PointerEvent) {
      if (ev.pointerId !== d.pointerId) return;
      d.clientX = ev.clientX;
      d.clientY = ev.clientY;
      if (!d.active) {
        const dist = Math.hypot(ev.clientX - d.startX, ev.clientY - d.startY);
        if (d.touch) {
          if (dist > TOUCH_SLOP) detach(); // 長按之前就動了：是捲動，不是拖曳
        } else if (dist > MOUSE_SLOP) {
          begin();
        }
        return;
      }
      update(d);
    }

    // 開始拖了就不能讓畫面跟著手指捲動
    function onTouchMove(ev: TouchEvent) {
      if (d.active && ev.cancelable) ev.preventDefault();
    }

    function onUp(ev: PointerEvent) {
      if (ev.pointerId !== d.pointerId) return;
      const wasActive = d.active;
      detach();
      if (!wasActive) return;
      // 這次拖曳之後的 click 不算點擊（不要觸發卡片的固定說明）
      swallowClick.current = true;
      setTimeout(() => (swallowClick.current = false), 0);
      const el = els.current.get(key);
      if (el) {
        const from = el.style.transform;
        const origin = el.style.transformOrigin;
        el.style.transform = '';
        if (!reducedMotion()) {
          const a = el.animate([{ transform: from }, { transform: 'translate(0, 0)' }], { duration: SLIDE_MS, easing: SLIDE_EASING });
          a.onfinish = a.oncancel = () => {
            if (el.style.transformOrigin === origin) el.style.transformOrigin = '';
          };
        } else {
          el.style.transformOrigin = '';
        }
      }
      setDragKey(null);
      if (sameKeys(d.order, d.initial)) {
        setOverride(null);
        return;
      }
      const result = latest.current.onReorder(d.order);
      if (result instanceof Promise) {
        const clear = () => setOverride(null);
        result.then(clear, clear);
      } else {
        setOverride(null);
      }
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    if (touch) d.timer = setTimeout(begin, LONG_PRESS_MS);
  };

  return (
    <div
      ref={boxRef}
      className={`sortlist${className ? ` ${className}` : ''}${disabled ? ' locked' : ''}`}
      onDragStart={(e) => e.preventDefault()}
      onClickCapture={(e) => {
        if (swallowClick.current) {
          e.stopPropagation();
          e.preventDefault();
        }
      }}
      // 長按觸控時瀏覽器會跳出右鍵選單，會打斷拖曳
      onContextMenuCapture={(e) => {
        if (drag.current?.touch) e.preventDefault();
      }}
    >
      {prefix}
      {keys.map((k) => (
        <div
          key={k}
          ref={(el) => {
            if (el) els.current.set(k, el);
            else els.current.delete(k);
          }}
          className={`sortcell${dragKey === k ? ' dragging' : ''}`}
          onPointerDown={(e) => onPointerDown(e, k)}
        >
          {renderItem(byKey.get(k)!)}
        </div>
      ))}
      {items.length === 0 && empty}
    </div>
  );
}
