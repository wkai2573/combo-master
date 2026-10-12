import type { DropZone, Request } from '../engine/types';

export interface Pt { x: number; y: number }
export interface Box { left: number; top: number; right: number; bottom: number }

/** 滑鼠移動超過這個距離才算拖曳，以下仍是一般的點擊 */
export const MOUSE_SLOP = 4;
/** 觸控往上移動超過這個距離就立即開始拖曳 */
export const TOUCH_DRAG_UP = 8;
/** 觸控橫向移動超過這個距離（且橫向為主）就當成捲動 */
export const TOUCH_SCROLL = 8;
/** 手牌列不能橫向捲動時，往上以外的方向移動超過這個距離才放棄拖曳 */
export const TOUCH_GIVE_UP = 24;

export type Gesture = 'pending' | 'scroll' | 'drag';

/**
 * 手指（或滑鼠）按下後移動，判斷這是拖曳、捲動，還是還沒決定。
 * 滑鼠：移動超過門檻就是拖曳。觸控：往上為主就是拖曳，橫向為主或往下就是捲動。
 * 手牌列不能橫向捲動（scrollable 為 false）時橫向移動沒有別的意義，只要有往上的分量就是拖曳。
 */
export function classifyMove(start: Pt, cur: Pt, touch: boolean, scrollable = true): Gesture {
  const dx = cur.x - start.x;
  const dy = cur.y - start.y;
  if (!touch) return Math.hypot(dx, dy) >= MOUSE_SLOP ? 'drag' : 'pending';
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (!scrollable) {
    if (dy <= -TOUCH_DRAG_UP) return 'drag';
    return Math.hypot(dx, dy) >= TOUCH_GIVE_UP ? 'scroll' : 'pending';
  }
  if (ax < TOUCH_SCROLL && ay < TOUCH_DRAG_UP) return 'pending';
  if (dy < 0 && ay >= TOUCH_DRAG_UP && ay >= ax) return 'drag';
  return 'scroll';
}

/** 放開的位置落在哪個放置區；都不在就是 null（牌彈回手牌） */
export function dropTarget(pt: Pt, zones: { zone: DropZone; box: Box }[], pad = 0): DropZone | null {
  for (const { zone, box } of zones) {
    if (pt.x >= box.left - pad && pt.x <= box.right + pad && pt.y >= box.top - pad && pt.y <= box.bottom + pad) return zone;
  }
  return null;
}

/**
 * 這張牌現在能不能拖曳使用：提示指定了放置區、只選 1 個（可略過）、不是排序，而且這張牌是選項。
 * 回傳它該去的放置區，不能拖就回傳 null。
 */
export function dragZone(prompt: Request | null, key: string): DropZone | null {
  if (!prompt || prompt.ordered || !prompt.dropZone || prompt.max !== 1) return null;
  return prompt.options.some((o) => o.key === key) ? prompt.dropZone : null;
}
