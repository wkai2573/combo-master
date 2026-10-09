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

/** 開關作弊模式也寫進紀錄，讓雙方事後對得上 */
export function cheatSwitch(g: Game, by: PlayerId, on: boolean): void {
  checkPlayers(by, by);
  if (on) g.state.cheated = true;
  log(g, `【作弊】${pname(g, by)} ${on ? '開啟' : '關閉'}作弊模式`);
}

export const CHEAT_ZONE_LABEL: Record<CheatViewZone, string> = { hand: '手牌', deck: '牌組', rage: '怒氣區', discard: '棄牌區', exp: '經驗區' };

/** 連線時參數來自對方的訊息：不合法的玩家編號、卡名、卡片編號一律當成拒絕，不讓它變成執行期錯誤 */
function checkPlayers(by: unknown, target: unknown): void {
  if ((by !== 0 && by !== 1) || (target !== 0 && target !== 1)) throw new Error('玩家編號不合法');
}

/** by 為操作者，target 為被操作的玩家；拒絕時丟出說明原因的錯誤，且不改動任何東西 */
function checkPoolCard(cardId: unknown): asserts cardId is string {
  if (typeof cardId !== 'string') throw new Error('卡名不合法');
  if (cardId.startsWith('Ex卡-')) throw new Error('Ex 卡不能用作弊加入');
  if (!CHEAT_POOL.some((c) => c.id === cardId)) throw new Error(`卡池裡沒有「${cardId}」`);
}

export function cheatAdd(g: Game, by: PlayerId, target: PlayerId, cardId: string): void {
  checkPlayers(by, target);
  checkPoolCard(cardId);
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

/** 牌區必須是可以調整的四區之一；手牌等其他已知牌區說明不能操作，未知的牌區說不合法 */
function checkZone(zone: unknown, what: string): void {
  if ((CHEAT_ZONES as readonly unknown[]).includes(zone)) return;
  const known = typeof zone === 'string' && Object.hasOwn(CHEAT_ZONE_LABEL, zone);
  throw new Error(known ? `${CHEAT_ZONE_LABEL[zone as CheatViewZone]}不能${what}` : '牌區不合法');
}

/** 把牌區裡的一張卡移出遊戲 */
export function cheatDelete(g: Game, by: PlayerId, target: PlayerId, zone: CheatZone, uid: number): void {
  checkPlayers(by, target);
  checkZone(zone, '刪除卡片');
  const cards = Z(g, target, zone);
  const card = cards.find((c) => c.uid === uid);
  if (!card) throw new Error(`這張卡已經不在${CHEAT_ZONE_LABEL[zone]}裡（畫面可能過期了）`);
  if (referenced(g).has(uid)) throw new Error(`【${data(card).name}】是目前提示的選項，不能刪除`);
  cards.splice(cards.indexOf(card), 1);
  log(g, `【作弊】${pname(g, by)} 將【${data(card).name}】從${pname(g, target)}的${CHEAT_ZONE_LABEL[zone]}移出遊戲`);
}

/** 新增一張卡到牌區的第一格（牌組與怒氣區的最上方、棄牌區最先放入的位置、經驗區最前方）；經驗區的新卡是表側 */
export function cheatInsert(g: Game, by: PlayerId, target: PlayerId, zone: CheatZone, cardId: string): void {
  checkPlayers(by, target);
  checkZone(zone, '加入卡片');
  checkPoolCard(cardId);
  const card = newCard(g, cardId, target, zone);
  const cards = Z(g, target, zone);
  cards.unshift(cards.pop()!);
  log(g, `【作弊】${pname(g, by)} 將【${data(card).name}】加入${pname(g, target)}的${CHEAT_ZONE_LABEL[zone]}最前面`);
}

/** 把經驗區的一張卡在表側與裏側之間切換；只改狀態，不觸發被蓋成裏側的反應 */
export function cheatFlip(g: Game, by: PlayerId, target: PlayerId, uid: number): void {
  checkPlayers(by, target);
  const card = Z(g, target, 'exp').find((c) => c.uid === uid);
  if (!card) throw new Error('這張卡已經不在經驗區裡（畫面可能過期了）');
  if (referenced(g).has(uid)) throw new Error(`【${data(card).name}】是目前提示的選項，不能翻面`);
  card.covered = !card.covered;
  log(g, `【作弊】${pname(g, by)} 將${pname(g, target)}的經驗【${data(card).name}】翻成${card.covered ? '裏側' : '表側'}`);
}

export function cheatReorder(g: Game, by: PlayerId, target: PlayerId, zone: CheatZone, uids: number[]): void {
  checkPlayers(by, target);
  checkZone(zone, '調整順序');
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
