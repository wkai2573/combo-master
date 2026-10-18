export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 說明框離目標至少留這麼寬，才不會貼在高亮的外框上 */
const GAP = 8;

const clamp = (n: number, max: number) => Math.min(Math.max(n, 0), Math.max(0, max));

const overlapArea = (a: Rect, b: Rect): number =>
  Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left))
  * Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));

const grow = (r: Rect, by: number): Rect => ({ left: r.left - by, top: r.top - by, width: r.width + 2 * by, height: r.height + 2 * by });

/**
 * 教學說明框的位置（左上角）：預設置中；會蓋住任何一個高亮目標時，
 * 移到可視區的上半部或下半部（水平仍置中），選放得下、與目標重疊較少的那一邊；兩邊都放不下就維持置中。
 * 任何情況都不超出可視區。
 */
export function captionPosition(viewport: { width: number; height: number }, size: { width: number; height: number }, targets: Rect[]): { left: number; top: number } {
  const left = clamp((viewport.width - size.width) / 2, viewport.width - size.width);
  const at = (top: number) => ({ left, top: clamp(top, viewport.height - size.height) });
  const cost = (p: { left: number; top: number }) => targets.reduce((sum, t) => sum + overlapArea({ ...p, ...size }, grow(t, GAP)), 0);

  const center = at((viewport.height - size.height) / 2);
  if (cost(center) === 0) return center;

  const half = viewport.height / 2;
  if (size.height > half) return center;
  // 各半部的正中央：上半部、下半部
  const candidates = [0, half].map((top) => at(top + (half - size.height) / 2));
  return candidates.reduce((best, p) => (cost(p) < cost(best) ? p : best));
}
