import { triggerWindow, type WindowEffect } from './window';
import { activate, ask, confirm, data, discard, draw, log, pname, recover, settle, Z, type GameCtx, type Gen } from './ops';
import type { CardInst, PlayerId } from './types';

// ───────────────────────── 費用 ─────────────────────────

export interface Cost {
  /** 蓋X：把經驗區最前面的 X 張表側卡轉為裏側 */
  cover?: number;
  /** 怒X：捨棄怒氣區上方 X 張 */
  rage?: number;
}

export const costText = (c: Cost) =>
  [c.cover ? `蓋${c.cover}` : '', c.rage ? `怒${c.rage}` : ''].filter(Boolean).join('、');

/** 蓋X 的對象：經驗區正面的卡。不分是不是正在發動效果的那張，一律照順序從最前面開始 */
export function faceUpExp(g: GameCtx, p: PlayerId): CardInst[] {
  return Z(g, p, 'exp').filter((c) => !c.covered);
}

export function canPay(g: GameCtx, p: PlayerId, cost: Cost): boolean {
  if (cost.cover && faceUpExp(g, p).length < cost.cover) return false;
  if (cost.rage && Z(g, p, 'rage').length < cost.rage) return false;
  return true;
}

/** 經驗卡被蓋成裏側時的蓋反應（低價買進、高價賣出） */
export const COVER_REACTIONS: Record<string, (g: GameCtx, p: PlayerId, card: CardInst) => Gen> = {
  低價買進: function* (g, p) {
    recover(g, p, 3);
  },
  高價賣出: function* (g, p) {
    yield* draw(g, p, 1);
  },
};

/** 蓋反應的說明（顯示在觸發窗口的選單上） */
const COVER_REACTION_TEXT: Record<string, string> = { 低價買進: '回復 3', 高價賣出: '抽 1' };

/** 扣除費用並自動觸發被蓋成裏側的經驗卡的蓋反應 */
export function* pay(g: GameCtx, p: PlayerId, cost: Cost): Gen {
  settle(g); // 付費之前還沒呈現的變化不算費用
  const newlyCovered: CardInst[] = [];
  if (cost.cover) newlyCovered.push(...cover(g, p, cost.cover));
  if (cost.rage) discardRage(g, p, cost.rage);
  // 付費自成一段，之後的蓋反應與效果各自再成一段
  if (cost.cover || cost.rage) settle(g, `${pname(g, p)} 支付費用（${costText(cost)}）`);
  // 同一次蓋到多張有蓋反應的卡：進觸發窗口，由卡的擁有者決定先後；蓋反應是強制的
  const reactions: WindowEffect[] = newlyCovered
    .filter((card) => COVER_REACTIONS[card.id])
    .map((card) => ({
      label: `【${data(card).name}】被蓋成裏側：${COVER_REACTION_TEXT[card.id] ?? '效果發動'}`,
      mandatory: true,
      mark: false, // 蓋反應自己會錄發動與步驟影格
      available: () => true,
      *run(): Gen {
        log(g, `【${data(card).name}】被蓋成裏側`);
        activate(g, p, card, `【${data(card).name}】被蓋成裏側，效果發動`);
        yield* COVER_REACTIONS[card.id](g, p, card);
        settle(g);
      },
    }));
  yield* triggerWindow(g, p, '被蓋成裏側', reactions);
}

/** 可選的費用發動：付得起才詢問，同意就扣費並回傳 true。askFirst 為 false 時（已在觸發窗口選定）不再詢問 */
export function* optionalPay(g: GameCtx, p: PlayerId, card: CardInst, cost: Cost, askFirst = true): Gen<boolean> {
  if (!canPay(g, p, cost)) return false;
  if (askFirst) {
    const ok = yield* confirm(g, p, `是否發動【${data(card).name}】？（${costText(cost)}）`);
    if (!ok) return false;
  }
  const text = `${pname(g, p)} 發動【${data(card).name}】（${costText(cost)}）`;
  log(g, text);
  activate(g, p, card, text);
  yield* pay(g, p, cost);
  return true;
}

export function cover(g: GameCtx, p: PlayerId, n: number): CardInst[] {
  const done: CardInst[] = [];
  for (const c of Z(g, p, 'exp')) {
    if (done.length >= n) break;
    if (!c.covered) {
      c.covered = true;
      done.push(c);
    }
  }
  if (done.length > 0) g.touched++;
  return done;
}

export function discardRage(g: GameCtx, p: PlayerId, n: number): number {
  let done = 0;
  const rage = Z(g, p, 'rage');
  while (done < n && rage.length > 0) {
    discard(g, rage[0]);
    done++;
  }
  return done;
}

/** 可變的 X（[蓋X]）：玩家選擇要蓋幾張（0 ＝ 不發動），最多 max 張且受正面經驗張數限制 */
export function* chooseX(g: GameCtx, p: PlayerId, card: CardInst, max: number, label: string): Gen<number> {
  let limit = 0;
  while (limit < max && canPay(g, p, { cover: limit + 1 })) limit++;
  if (limit === 0) return 0;
  const [k] = yield* ask(g, {
    player: p,
    title: `【${data(card).name}】${label}（X 最大為 ${max}）`,
    min: 1, max: 1,
    options: [{ key: '0', label: '不發動' }, ...Array.from({ length: limit }, (_, i) => ({ key: String(i + 1), label: `蓋${i + 1}` }))],
  });
  return Number(k);
}
