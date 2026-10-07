import type { CardView, GameView, PlayerView } from './view';
import type { PlayerId, ZoneName } from './types';

/** 卡片飛行的時序（毫秒，標準速度） */
export const FLY = {
  /** 一張牌從起點飛到終點 */
  ms: 420,
  /** 同一組的下一張晚多久出發 */
  stagger: 90,
  /** 一批飛行（含逐張錯開）最多花多久 */
  capMs: 1500,
  /** 再快就看不清楚了 */
  minMs: 150,
};

/** 一批飛行的時序：maxOrder 為各組中最大的順序（0 起算）。張數多時整批壓縮到 capMs 內 */
export function flightTiming(maxOrder: number): { ms: number; stagger: number; total: number } {
  const natural = FLY.ms + maxOrder * FLY.stagger;
  if (natural <= FLY.capMs) return { ms: FLY.ms, stagger: FLY.stagger, total: natural };
  const ms = Math.max(FLY.minMs, (FLY.ms * FLY.capMs) / natural);
  return { ms, stagger: (FLY.capMs - ms) / maxOrder, total: FLY.capMs };
}

/** 播完這批飛行要多久（沒有飛行為 0） */
export const flightsTotalMs = (flights: Flight[]): number =>
  flights.length === 0 ? 0 : flightTiming(Math.max(...flights.map((f) => f.order))).total;

/** 影格裡看得到每張卡的區域（牌組只有張數，沒有卡片） */
const VISIBLE_ZONES = ['hand', 'discard', 'rage', 'exp', 'combat', 'pursuit', 'gear', 'buff'] as const;
type VisibleZone = (typeof VISIBLE_ZONES)[number];

/** spawn：憑空出現（例如 Ex 卡）；gone：離開遊戲 */
export type FlightFrom = ZoneName | 'spawn';
export type FlightTo = ZoneName | 'gone';

/** 一張卡從前一個影格到後一個影格的移動 */
export interface Flight {
  uid: number;
  owner: PlayerId;
  /** 看得到的牌面；null 表示這位觀看者看不到（飛行全程顯示牌背） */
  id: string | null;
  from: FlightFrom;
  to: FlightTo;
  /** 起點、終點時是否正面朝上；兩者不同代表飛行途中翻面 */
  faceUpFrom: boolean;
  faceUpTo: boolean;
  /** 同一組（同玩家、同起點、同終點；招式與追擊卡視為同一起點）中的第幾張，用來逐張錯開 */
  order: number;
}

interface Loc {
  owner: PlayerId;
  zone: VisibleZone;
  card: CardView;
  /** 在該區域中的位置 */
  pos: number;
}

/** 怒氣區的牌與覆蓋中的經驗卡一律背面朝上：自己看得到內容，但飛進飛出時仍顯示牌背 */
const faceUp = (zone: ZoneName, card: CardView) => zone !== 'rage' && !card.covered && card.id !== null;

function locate(v: GameView): Map<number, Loc> {
  const out = new Map<number, Loc>();
  for (const owner of [0, 1] as PlayerId[]) {
    const pv: PlayerView = v.players[owner];
    for (const zone of VISIBLE_ZONES) {
      pv[zone].forEach((card, pos) => out.set(card.uid, { owner, zone, card, pos }));
    }
  }
  return out;
}

/**
 * 比對相鄰兩個影格，推導卡片的移動。
 * 牌組只有張數、沒有卡片：憑空出現的卡視為從牌組來（以牌組減少的張數為上限），
 * 消失的卡視為回到牌組（以牌組增加的張數為上限）。
 */
export function diffFlights(prev: GameView, next: GameView): Flight[] {
  const before = locate(prev);
  const after = locate(next);
  const out: Flight[] = [];
  const nth = new Map<string, number>();
  const push = (f: Omit<Flight, 'order'>) => {
    // 同一組依序出發。招式與追擊卡都算「桌面上的牌」，歸還時先後飛進經驗區
    const key = `${f.owner}|${f.from === 'pursuit' ? 'combat' : f.from}|${f.to}`;
    const order = nth.get(key) ?? 0;
    nth.set(key, order + 1);
    out.push({ ...f, order });
  };

  const fromDeck: Record<PlayerId, number> = {
    0: Math.max(0, prev.players[0].deckCount - next.players[0].deckCount),
    1: Math.max(0, prev.players[1].deckCount - next.players[1].deckCount),
  };
  const toDeck: Record<PlayerId, number> = {
    0: Math.max(0, next.players[0].deckCount - prev.players[0].deckCount),
    1: Math.max(0, next.players[1].deckCount - prev.players[1].deckCount),
  };

  // 以新影格裡的位置為順序，讓同一組的卡依序飛出
  const arrived = [...after.entries()].sort(([, a], [, b]) => a.pos - b.pos);
  for (const [uid, now] of arrived) {
    const was = before.get(uid);
    if (was) {
      if (was.owner === now.owner && was.zone === now.zone) continue;
      push({
        uid, owner: now.owner, id: now.card.id, from: was.zone, to: now.zone,
        faceUpFrom: faceUp(was.zone, was.card), faceUpTo: faceUp(now.zone, now.card),
      });
    } else if (fromDeck[now.owner] > 0) {
      fromDeck[now.owner]--;
      push({
        uid, owner: now.owner, id: now.card.id, from: 'deck', to: now.zone,
        faceUpFrom: false, faceUpTo: faceUp(now.zone, now.card),
      });
    } else {
      push({
        uid, owner: now.owner, id: now.card.id, from: 'spawn', to: now.zone,
        faceUpFrom: faceUp(now.zone, now.card), faceUpTo: faceUp(now.zone, now.card),
      });
    }
  }

  for (const [uid, was] of before) {
    if (after.has(uid)) continue;
    const toDeckNow = toDeck[was.owner] > 0;
    if (toDeckNow) toDeck[was.owner]--;
    push({
      uid, owner: was.owner, id: was.card.id, from: was.zone, to: toDeckNow ? 'deck' : 'gone',
      faceUpFrom: faceUp(was.zone, was.card), faceUpTo: false,
    });
  }
  return out;
}

/** 留在原區域、但覆蓋狀態改變的卡（蓋 X 付費翻成覆蓋，或覆蓋的牌被翻開），不算飛行 */
export function coverChanges(prev: GameView, next: GameView): number[] {
  const before = locate(prev);
  const out: number[] = [];
  for (const [uid, now] of locate(next)) {
    const was = before.get(uid);
    if (was && was.owner === now.owner && was.zone === now.zone && was.card.covered !== now.card.covered) out.push(uid);
  }
  return out;
}
