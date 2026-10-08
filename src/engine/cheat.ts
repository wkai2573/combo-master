import { ALL_CARDS } from '../data/cards';
import type { CardData } from '../data/types';
import { data, log, newCard, pname, Z } from './ops';
import { show, type CardView } from './view';
import type { CardInst, PlayerId, ZoneName } from './types';
import type { Game } from './game';

/** 作弊能加入手牌的卡：全卡池，含未開放的卡，不含 Ex 卡 */
export const CHEAT_POOL: CardData[] = ALL_CARDS.filter((c) => !c.id.startsWith('Ex卡-'));

/** 可以檢視並調整順序的牌區；戰鬥區、裝備、增益不動 */
export const CHEAT_ZONES = ['deck', 'rage', 'discard', 'exp'] as const;
export type CheatZone = (typeof CHEAT_ZONES)[number];

/** 作弊檢視看得到的區域（手牌只能加入與移除，不能排序） */
export type CheatViewZone = 'hand' | CheatZone;

/** 作弊檢視：雙方各牌區的完整內容，包含對方手牌、牌組與裏側卡 */
export type CheatSnapshot = [Record<CheatViewZone, CardView[]>, Record<CheatViewZone, CardView[]>];

export function cheatSnapshot(g: Game): CheatSnapshot {
  const of = (p: PlayerId) => {
    const z = g.state.players[p].zones;
    return {
      hand: z.hand.map(show), deck: z.deck.map(show), rage: z.rage.map(show), discard: z.discard.map(show), exp: z.exp.map(show),
    };
  };
  return [of(0), of(1)];
}

/** 目前提示的選項正在引用的卡（uid） */
function referenced(g: Game): Set<number> {
  const out = new Set<number>();
  for (const o of g.pending?.options ?? []) if (o.uid !== undefined) out.add(o.uid);
  return out;
}

export const CHEAT_ZONE_LABEL: Record<CheatViewZone, string> = { hand: '手牌', deck: '牌組', rage: '怒氣區', discard: '棄牌區', exp: '經驗區' };

/** 連線時參數來自對方的訊息：不合法的玩家編號、卡名、卡片編號一律當成拒絕，不讓它變成執行期錯誤 */
function checkPlayers(by: unknown, target: unknown): void {
  if ((by !== 0 && by !== 1) || (target !== 0 && target !== 1)) throw new Error('玩家編號不合法');
}

/** by 為操作者，target 為被操作的玩家；拒絕時丟出說明原因的錯誤，且不改動任何東西 */
export function cheatAdd(g: Game, by: PlayerId, target: PlayerId, cardId: string): void {
  checkPlayers(by, target);
  if (typeof cardId !== 'string') throw new Error('卡名不合法');
  if (cardId.startsWith('Ex卡-')) throw new Error('Ex 卡不能用作弊加入手牌');
  if (!CHEAT_POOL.some((c) => c.id === cardId)) throw new Error(`卡池裡沒有「${cardId}」`);
  const c = newCard(g, cardId, target, 'hand');
  log(g, `【作弊】${pname(g, by)} 將【${data(c).name}】加入${pname(g, target)}的手牌`);
}

export function cheatRemove(g: Game, by: PlayerId, target: PlayerId, uid: number): void {
  checkPlayers(by, target);
  const hand = Z(g, target, 'hand');
  const card = hand.find((c) => c.uid === uid);
  if (!card) throw new Error('這張卡已經不在手牌裡（畫面可能過期了）');
  if (referenced(g).has(uid)) throw new Error(`【${data(card).name}】是目前提示的選項，不能移除`);
  hand.splice(hand.indexOf(card), 1);
  log(g, `【作弊】${pname(g, by)} 將【${data(card).name}】從${pname(g, target)}的手牌移出遊戲`);
}

export function cheatReorder(g: Game, by: PlayerId, target: PlayerId, zone: CheatZone, uids: number[]): void {
  checkPlayers(by, target);
  if (!(CHEAT_ZONES as readonly string[]).includes(zone)) throw new Error(`${CHEAT_ZONE_LABEL[zone as CheatViewZone] ?? zone}不能調整順序`);
  if (!Array.isArray(uids) || uids.some((u) => typeof u !== 'number')) throw new Error('順序不合法');
  const cards = Z(g, target, zone as ZoneName);
  const byUid = new Map(cards.map((c) => [c.uid, c]));
  if (uids.length !== cards.length || new Set(uids).size !== uids.length || uids.some((u) => !byUid.has(u))) {
    throw new Error(`${CHEAT_ZONE_LABEL[zone]}的內容已經變動（畫面可能過期了），請重新開啟面板`);
  }
  const ref = referenced(g);
  uids.forEach((u, i) => {
    if (ref.has(u) && cards.indexOf(byUid.get(u)!) !== i) throw new Error(`【${data(byUid.get(u)!).name}】是目前提示的選項，不能移動位置`);
  });
  const next = uids.map((u) => byUid.get(u)!);
  // 原地改寫：進行中的流程可能還握著這個陣列
  cards.splice(0, cards.length, ...next);
  log(g, `【作弊】${pname(g, by)} 調整了${pname(g, target)}的${CHEAT_ZONE_LABEL[zone]}順序`);
}
