import { getCard, getCharacter } from '../data/cards';
import { isExCardId } from '../data/exCards';
import type { CardData } from '../data/types';
import type { Rng } from './rng';
import { faceVisibleTo } from './visibility';
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
  /** 自上一個影格以來，卡片移動或寫入紀錄的次數（0 表示桌面沒有未呈現的變化） */
  touched: number;
  /** 錄製一個動畫影格（未開啟 animate 時為空操作） */
  frame?: (caption: string, fx: FrameFx) => void;
}

/** 在關鍵時刻錄下目前桌面狀態與一句說明，介面會依序播放 */
export function mark(g: GameCtx, caption: string, fx: FrameFx): void {
  g.frame?.(caption, fx);
}

/** 桌面有尚未呈現的變化時，補錄一個影格（說明預設為最新一行紀錄）。沒有變化就什麼都不做 */
export function settle(g: GameCtx, caption?: string): void {
  if (g.touched === 0) return;
  mark(g, caption ?? g.state.log[g.state.log.length - 1] ?? '', { type: 'step' });
}

/** 卡片效果發動：先把之前還沒呈現的變化補成影格，再錄一個發動影格（說明預設為「發動【卡名】」） */
export function activate(g: GameCtx, p: PlayerId, card: CardInst, caption?: string): void {
  settle(g);
  mark(g, caption ?? `${pname(g, p)} 發動【${data(card).name}】`, { type: 'activate', player: p, uid: card.uid, cardId: card.id });
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

/** 戰鬥區＝招式卡疊加追擊卡疊（招式卡疊在前，各自由底到頂）。卡效果提到「戰鬥區」時用它；規則本身只看招式卡疊的地方直接用 Z(g, p, 'moves') */
export const combatZone = (g: GameCtx, p: PlayerId): CardInst[] => [...Z(g, p, 'moves'), ...Z(g, p, 'pursuit')];
export const data = (c: CardInst): CardData => getCard(c.id);
export const charOf = (g: GameCtx, p: PlayerId) => getCharacter(P(g, p).charId);
export const isFirst = (g: GameCtx, p: PlayerId) => g.state.first === p;
export const order = (g: GameCtx): [PlayerId, PlayerId] => [g.state.first, other(g.state.first)];

export function log(g: GameCtx, text: string) {
  g.state.log.push(text);
  g.touched++;
}
export const pname = (g: GameCtx, p: PlayerId) => `${p === 0 ? '玩家A' : '玩家B'}（${P(g, p).charId}）`;

export function awakened(g: GameCtx, p: PlayerId): boolean {
  return Z(g, p, 'exp').length >= charOf(g, p).expReq;
}

export function newCard(g: GameCtx, id: string, owner: PlayerId, zone: ZoneName): CardInst {
  const c: CardInst = { uid: g.nextUid++, id, owner, zone, covered: false, counters: 0 };
  g.touched++;
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
  g.touched++;
  const from = Z(g, card.owner, card.zone);
  const i = from.indexOf(card);
  if (i >= 0) from.splice(i, 1);
  // Ex 卡（臨時額外卡）離開經驗區時移除遊戲
  if (isExCardId(card.id) && card.zone === 'exp' && to !== 'exp') return;
  card.zone = to;
  card.covered = false;
  const dest = Z(g, card.owner, to);
  const topIsFront = to === 'deck' || to === 'rage';
  const topIsEnd = to === 'moves';
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

/** 直擊X：把牌組上方 X 張卡移入棄牌區（不經過防禦）。回傳實際張數 */
export function directHit(g: GameCtx, p: PlayerId, n: number): number {
  const deck = Z(g, p, 'deck');
  let done = 0;
  while (done < n && deck.length > 0) {
    discard(g, deck[0]);
    done++;
  }
  if (done > 0) log(g, `${pname(g, p)} 受到直擊 ${done}（牌組上方放入棄牌區）`);
  return done;
}

export function toExp(g: GameCtx, card: CardInst) {
  move(g, card, 'exp');
}

// ───────────────────────── 提示 ─────────────────────────

/** viewer 是回應這個提示的玩家：牌面看不看得到依牌面可見性，看不到的選項只有位置 */
export function cardOpt(c: CardInst, viewer: PlayerId, label?: string): Opt {
  if (!faceVisibleTo(c, viewer)) return { key: `c${c.uid}`, label: '?', uid: c.uid, hidden: true };
  return { key: `c${c.uid}`, label: label ?? data(c).name, uid: c.uid, cardId: c.id };
}

/** 向玩家要求選擇；選項不足以構成選擇時自動回應 */
export function* ask(g: GameCtx, req: Request): Gen<string[]> {
  const { options, min } = req;
  if (options.length === 0) return [];
  // 要排順序的提示，至少有兩個選項才有排的意義
  if (req.ordered ? options.length < 2 : options.length <= min) return options.map((o) => o.key);
  const resp: string[] = yield req;
  return resp;
}

export function* chooseCards(
  g: GameCtx, p: PlayerId, title: string, cards: CardInst[], min: number, max: number,
): Gen<CardInst[]> {
  if (cards.length === 0) return [];
  const mn = Math.min(min, cards.length);
  const mx = Math.min(max, cards.length);
  const keys = yield* ask(g, { player: p, title, options: cards.map((c) => cardOpt(c, p)), min: mn, max: mx });
  return keys.map((k) => cards.find((c) => `c${c.uid}` === k)!).filter(Boolean);
}

/** 請玩家把這些卡排好順序，回傳排好的順序；不足兩張就不用問 */
export function* orderCards(g: GameCtx, p: PlayerId, title: string, cards: CardInst[]): Gen<CardInst[]> {
  const keys = yield* ask(g, {
    player: p, title, options: cards.map((c) => cardOpt(c, p)), min: cards.length, max: cards.length, ordered: true,
  });
  return keys.map((k) => cards.find((c) => `c${c.uid}` === k)!);
}

export function* confirm(g: GameCtx, p: PlayerId, title: string): Gen<boolean> {
  const keys: string[] = yield {
    player: p, title, min: 1, max: 1,
    options: [{ key: 'yes', label: '發動' }, { key: 'no', label: '不發動' }],
  };
  return keys[0] === 'yes';
}

// ───────────────────────── 區域操作 ─────────────────────────

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

/** 抽牌 */
export function* draw(g: GameCtx, p: PlayerId, n: number): Gen<CardInst[]> {
  const drawn: CardInst[] = [];
  const deck = Z(g, p, 'deck');
  for (let i = 0; i < n && deck.length > 0; i++) {
    const c = deck[0];
    move(g, c, 'hand');
    drawn.push(c);
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

/** 受到 n 點傷害：從牌組上方放入怒氣區。回傳實際放入怒氣區的張數。 */
export function takeDamage(g: GameCtx, p: PlayerId, n: number): number {
  let moved = 0;
  const deck = Z(g, p, 'deck');
  for (let i = 0; i < n; i++) {
    if (deck.length === 0) break;
    move(g, deck[0], 'rage', 'top');
    moved++;
  }
  return moved;
}

export function topOfZone(g: GameCtx, p: PlayerId): CardInst | undefined {
  const z = Z(g, p, 'moves');
  return z[z.length - 1];
}
