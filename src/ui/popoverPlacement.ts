export interface Box { left: number; top: number; right: number; bottom: number }

export interface Placement {
  left: number;
  /** below：edge 是面板的上緣；above：edge 是面板的下緣到可視區底端的距離 */
  side: 'below' | 'above';
  edge: number;
}

const GAP = 6;
const MARGIN = 8;

/** 把展開面板貼著錨點：下方放得下就放下方，否則放上方；上下都放不下時選空間較大的一邊。左右夾在可視區內 */
export function placePopover(anchor: Box, size: { w: number; h: number }, vp: { w: number; h: number }): Placement {
  const left = Math.max(MARGIN, Math.min(anchor.left, vp.w - size.w - MARGIN));
  const below = vp.h - anchor.bottom - GAP;
  const above = anchor.top - GAP;
  const side = below >= size.h || below >= above ? 'below' : 'above';
  return side === 'below'
    ? { left, side, edge: anchor.bottom + GAP }
    : { left, side, edge: vp.h - anchor.top + GAP };
}
