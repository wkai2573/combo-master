import type { PlayerId } from '../engine/types';
import type { GameView } from '../engine/view';
import type { HighlightTarget, Side, StatPart } from '../tutorial/script';

/** 畫面上的一個矩形（視窗座標） */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const all = (selector: string, root: ParentNode = document): Element[] => [...root.querySelectorAll(selector)];

const playerOf = (side: Side, view: GameView): PlayerId => (side === 'me' ? view.me : view.me === 0 ? 1 : 0);

/** 戰鬥區的某一方：我方、對手各一欄 */
const columnOf = (side: Side): Element[] => all(`.combatarea .col.${side === 'me' ? 'mine' : 'opp'}`);

const PART_CLASS: Record<StatPart, string> = { combo: '.c', atk: '.a', def: '.d' };
const partsOf = (card: Element, parts: StatPart[]): Element[] => parts.flatMap((p) => all(`.hd ${PART_CLASS[p]}`, card));

/**
 * 把抽象的高亮目標對應到畫面上的元素。電腦版與手機版用同一套選擇器：
 * 戰鬥區、手牌列、中央放大是兩種版面共用的元件；牌堆與回合步驟在兩種版面長得不同，各自列出。
 * 找不到就是空的（高亮不出現，不影響教學）。
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
    case 'combat-cards': {
      const pv = view.players[playerOf(target.owner, view)];
      return [...pv.moves, ...pv.pursuit].filter((c) => c.id === target.cardId).flatMap((c) => all(`.combatarea [data-uid="${c.uid}"]`));
    }
    case 'pass-text':
      // 收招文字是收招那一格的特效，只在播放與停住時存在
      return all('.combatarea .resultpop.pass').filter((el) => !!el.closest('.colwrap')?.querySelector(`.col.${target.owner === 'me' ? 'mine' : 'opp'}`));
    case 'pursuit-step':
      // 電腦版是步驟列裡目前的步驟；手機版沒有步驟列，是戰鬥區中央的提示
      return [...all('.steps .subs .st.now'), ...all('.combatarea .stephint')];
    case 'deck-count':
    case 'deck': {
      const p = playerOf(target.owner, view);
      const stack = document.querySelector(`[data-pile="${p}-deck"]`);
      const pile = stack?.closest('.pile');
      if (!stack) return [];
      if (target.kind === 'deck') return [pile ?? stack];
      return [pile?.querySelector('.pilelabel') ?? stack];
    }
    case 'hand-count':
      return all(`[data-hand-count="${playerOf(target.owner, view)}"]`);
    case 'judge-card':
      return all('.spotlight .spotcard').flatMap((card) => (target.parts ? partsOf(card, target.parts) : [card]));
    case 'result-text':
      return all(`.spotlight .spotlabel.${target.ok ? 'ok' : 'fail'}`);
    case 'pursuit-card':
      return columnOf(target.owner).flatMap((col) => all('.card.pursuit', col).flatMap((card) => partsOf(card, target.parts)));
    case 'total':
      return all(`.combatarea .sumbox .${target.stat}`).map((el) => el.parentElement ?? el);
    case 'exp-zone': {
      // 電腦版是整個經驗區；手機版是經驗牌堆（我方）或對手列上的經驗區標籤
      const p = playerOf(target.owner, view);
      const zone = all(`[data-exp-zone="${p}"]`);
      if (zone.length > 0) return zone;
      const stack = document.querySelector(`[data-pile="${p}-exp"]`);
      return stack ? [stack.closest('.pile') ?? stack] : [];
    }
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
