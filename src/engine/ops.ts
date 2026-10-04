import { getCard, getCharacter } from '../data/cards';
import type { CardData } from '../data/types';
import type { Rng } from './rng';
import {
  other,
  type CardInst,
  type FrameFx,
  type GameState,
  type Opt,
  type PlayerId,
  type PlayerState,
  type Request,
  type ZoneName,
} from './types';

export interface GameCtx {
  state: GameState;
  rng: Rng;
  nextUid: number;
  /** 錄製一個動畫影格（未開啟 animate 時為空操作） */
  frame?: (caption: string, fx: FrameFx) => void;
}

/** 在關鍵時刻錄下目前桌面狀態與一句說明，介面會依序播放 */
export function mark(g: GameCtx, caption: string, fx: FrameFx): void {
  g.frame?.(caption, fx);
}

/** 執行 fn 後若紀錄有新增，就補一個影格顯示最後一行（用來呈現卡片效果的結果） */
export function* markIfLogged(g: GameCtx, fn: () => Gen): Gen {
  const before = g.state.log.length;
  yield* fn();
  if (g.state.log.length > before) mark(g, g.state.log[g.state.log.length - 1], { type: 'info' });
}

/** 勝負已定時用來中斷 generator */
export class GameOver extends Error {}

export type Gen<T = void> = Generator<Request, T, string[]>;

export const P = (g: GameCtx, p: PlayerId): PlayerState => g.state.players[p];
export const Z = (g: GameCtx, p: PlayerId, z: ZoneName): CardInst[] => g.state.players[p].zones[z];
export const data = (c: CardInst): CardData => getCard(c.id);
export const charOf = (g: GameCtx, p: PlayerId) => getCharacter(P(g, p).charId);
export const isFirst = (g: GameCtx, p: PlayerId) => g.state.first === p;
export const order = (g: GameCtx): [PlayerId, PlayerId] => [g.state.first, other(g.state.first)];

export function log(g: GameCtx, text: string) {
  g.state.log.push(text);
}
export const pname = (g: GameCtx, p: PlayerId) => `${p === 0 ? '玩家A' : '玩家B'}（${P(g, p).charId}）`;

export function awakened(g: GameCtx, p: PlayerId): boolean {
  return Z(g, p, 'exp').length >= charOf(g, p).expReq;
}

export function newCard(g: GameCtx, id: string, owner: PlayerId, zone: ZoneName): CardInst {
  const c: CardInst = { uid: g.nextUid++, id, owner, zone, covered: false, counters: 0 };
  Z(g, owner, zone).push(c);
  return c;
}

export function findCard(g: GameCtx, uid: number): CardInst | undefined {
  for (const pl of g.state.players) {
    for (const z of Object.keys(pl.zones) as ZoneName[]) {
      const c = pl.zones[z].find((x) => x.uid === uid);
      if (c) return c;
    }
  }
  return undefined;
}

/** 將卡移到持有主的指定區域。pos='top' 為該區域的「最上方」，'bottom' 為「最下方」。 */
export function move(g: GameCtx, card: CardInst, to: ZoneName, pos: 'top' | 'bottom' = 'bottom'): void {
  const from = Z(g, card.owner, card.zone);
  const i = from.indexOf(card);
  if (i >= 0) from.splice(i, 1);
  card.zone = to;
  card.covered = false;
  const dest = Z(g, card.owner, to);
  const topIsFront = to === 'deck' || to === 'rage';
  const topIsEnd = to === 'combat';
  if (topIsFront) {
    if (pos === 'top') dest.unshift(card);
    else dest.push(card);
  } else if (topIsEnd) {
    if (pos === 'top') dest.push(card);
    else dest.unshift(card);
  } else {
    dest.push(card);
  }
}

export const discard = (g: GameCtx, card: CardInst) => move(g, card, 'discard');

export function toExp(g: GameCtx, card: CardInst) {
  move(g, card, 'exp');
}

// ───────────────────────── 提示 ─────────────────────────

export function cardOpt(c: CardInst, label?: string): Opt {
  return { key: `c${c.uid}`, label: label ?? data(c).name, uid: c.uid, cardId: c.id };
}

/** 向玩家要求選擇；選項不足以構成選擇時自動回應 */
export function* ask(g: GameCtx, req: Request): Gen<string[]> {
  const { options, min } = req;
  if (options.length === 0) return [];
  if (options.length <= min) return options.map((o) => o.key);
  const resp: string[] = yield req;
  return resp;
}

export function* chooseCards(
  g: GameCtx, p: PlayerId, title: string, cards: CardInst[], min: number, max: number,
): Gen<CardInst[]> {
  if (cards.length === 0) return [];
  const mn = Math.min(min, cards.length);
  const mx = Math.min(max, cards.length);
  const keys = yield* ask(g, { player: p, title, options: cards.map((c) => cardOpt(c)), min: mn, max: mx });
  return keys.map((k) => cards.find((c) => `c${c.uid}` === k)!).filter(Boolean);
}

export function* confirm(g: GameCtx, p: PlayerId, title: string): Gen<boolean> {
  const keys: string[] = yield {
    player: p, title, min: 1, max: 1,
    options: [{ key: 'yes', label: '發動' }, { key: 'no', label: '不發動' }],
  };
  return keys[0] === 'yes';
}

// ───────────────────────── 費用 ─────────────────────────

export interface Cost {
  /** 蓋X：覆蓋經驗區最前面的 X 張正面卡 */
  cover?: number;
  /** 怒X：捨棄怒氣區上方 X 張 */
  rage?: number;
}

export const costText = (c: Cost) =>
  [c.cover ? `蓋${c.cover}` : '', c.rage ? `怒${c.rage}` : ''].filter(Boolean).join('、');

export function faceUpExp(g: GameCtx, p: PlayerId, exclude?: CardInst): CardInst[] {
  return Z(g, p, 'exp').filter((c) => !c.covered && c !== exclude);
}

export function canPay(g: GameCtx, p: PlayerId, cost: Cost, exclude?: CardInst): boolean {
  if (cost.cover && faceUpExp(g, p, exclude).length < cost.cover) return false;
  if (cost.rage && Z(g, p, 'rage').length < cost.rage) return false;
  return true;
}

export function pay(g: GameCtx, p: PlayerId, cost: Cost, exclude?: CardInst): void {
  if (cost.cover) cover(g, p, cost.cover, exclude);
  if (cost.rage) discardRage(g, p, cost.rage);
}

/** 由 scripts.ts 掛上：處理剛被覆蓋的經驗卡的「被覆蓋時」效果（避免 ops 與 scripts 互相引用） */
export const hooks: { onCovered?: (g: GameCtx) => Gen } = {};

/** 可選的費用發動：付得起才詢問，同意就扣費並回傳 true */
export function* optionalPay(
  g: GameCtx, p: PlayerId, card: CardInst, cost: Cost, exclude?: CardInst,
): Gen<boolean> {
  if (!canPay(g, p, cost, exclude)) return false;
  const ok = yield* confirm(g, p, `是否發動【${data(card).name}】？（${costText(cost)}）`);
  if (!ok) return false;
  pay(g, p, cost, exclude);
  log(g, `${pname(g, p)} 發動【${data(card).name}】（${costText(cost)}）`);
  if (hooks.onCovered) yield* hooks.onCovered(g);
  return true;
}

// ───────────────────────── 區域操作 ─────────────────────────

export function cover(g: GameCtx, p: PlayerId, n: number, exclude?: CardInst): number {
  let done = 0;
  for (const c of Z(g, p, 'exp')) {
    if (done >= n) break;
    if (!c.covered && c !== exclude) {
      c.covered = true;
      g.state.flags.coveredQ.push(c.uid);
      done++;
    }
  }
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

/** 回復X：怒氣區上方 X 張放回牌組頂 */
export function recover(g: GameCtx, p: PlayerId, n: number): number {
  let done = 0;
  const rage = Z(g, p, 'rage');
  while (done < n && rage.length > 0) {
    move(g, rage[0], 'deck', 'top');
    done++;
  }
  if (done > 0) log(g, `${pname(g, p)} 回復 ${done}`);
  return done;
}

/** 抽牌（商人：只有「抽 1 張」時，改為看牌組上方 2 張選 1 張，另一張放回底部） */
export function* draw(g: GameCtx, p: PlayerId, n: number): Gen<CardInst[]> {
  const drawn: CardInst[] = [];
  const deck = Z(g, p, 'deck');
  const isMerchant = P(g, p).charId === '商人' && n === 1;
  for (let i = 0; i < n && deck.length > 0; i++) {
    if (isMerchant && deck.length >= 2) {
      const top2 = deck.slice(0, 2);
      const [pick] = yield* chooseCards(g, p, '【商人】選擇 1 張加入手牌，另一張放回牌組底', top2, 1, 1);
      for (const c of top2) {
        if (c === pick) move(g, c, 'hand');
        else move(g, c, 'deck', 'bottom');
      }
      drawn.push(pick);
    } else {
      const c = deck[0];
      move(g, c, 'hand');
      drawn.push(c);
    }
  }
  log(g, `${pname(g, p)} 抽 ${drawn.length}`);
  return drawn;
}

/** 不經角色效果的抽牌（起始手牌、追擊失敗歸手等） */
export function drawPlain(g: GameCtx, p: PlayerId, n: number): CardInst[] {
  const out: CardInst[] = [];
  const deck = Z(g, p, 'deck');
  for (let i = 0; i < n && deck.length > 0; i++) {
    const c = deck[0];
    move(g, c, 'hand');
    out.push(c);
  }
  return out;
}

/**
 * 受到 n 點傷害：從牌組上方放入怒氣區。
 * 替身：每 1 傷害，捨棄 1 張覆蓋中的經驗代替。
 * 回傳實際放入怒氣區的張數。
 */
export function takeDamage(g: GameCtx, p: PlayerId, n: number): number {
  let moved = 0;
  const deck = Z(g, p, 'deck');
  for (let i = 0; i < n; i++) {
    const sub = Z(g, p, 'buff').find((b) => b.id === '替身');
    const covered = Z(g, p, 'exp').find((c) => c.covered);
    if (sub && covered) {
      discard(g, covered);
      log(g, `【替身】${pname(g, p)} 捨棄 1 張覆蓋的經驗代替受到傷害`);
      continue;
    }
    if (deck.length === 0) break;
    move(g, deck[0], 'rage', 'top');
    moved++;
  }
  return moved;
}

/** 本卡的連擊值選項（3連擊 可視為 6 或 8）由 scripts 提供，這裡僅取印刷值 */
export const comboOf = (c: CardInst) => data(c).combo;

export function topOfZone(g: GameCtx, p: PlayerId): CardInst | undefined {
  const z = Z(g, p, 'combat');
  return z[z.length - 1];
}
