import type { GameView } from '../engine/view';
import type { HighlightTarget } from '../tutorial/script';

/** 畫面上的一個矩形（視窗座標） */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const all = (selector: string): Element[] => [...document.querySelectorAll(selector)];

/**
 * 把抽象的高亮目標對應到畫面上的元素。電腦版與手機版用同一套選擇器：
 * 戰鬥區與手牌列在兩種版面是同一個元件，只是擺的位置不同。找不到就是空的（高亮不出現，不影響教學）。
 */
function elementsOf(target: HighlightTarget, view: GameView): Element[] {
  switch (target.kind) {
    case 'combat-zones':
      return all('.combatarea .vstack');
    case 'top-combos':
      return view.players.flatMap((p) => {
        const top = p.moves.at(-1);
        return top ? all(`.combatarea [data-uid="${top.uid}"] .hd .c`) : [];
      });
    case 'hand-card':
      return view.players[view.me].hand.filter((c) => c.id === target.cardId).flatMap((c) => all(`.handrow [data-uid="${c.uid}"]`));
  }
}

/** 目標在畫面上的位置；沒有畫出來的（寬高為 0）不算 */
export function targetBoxes(targets: HighlightTarget[], view: GameView): Box[] {
  return targets
    .flatMap((t) => elementsOf(t, view))
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0)
    .map((r) => ({ left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) }));
}

export const sameBoxes = (a: Box[], b: Box[]): boolean =>
  a.length === b.length && a.every((x, i) => x.left === b[i].left && x.top === b[i].top && x.width === b[i].width && x.height === b[i].height);
