import { isTrap } from '../data/cards';
import {
  awakened, chooseCards, confirm, data, discard, draw, hooks, Z, log, move, optionalPay, order, pname,
  recover, toExp, type Gen, type GameCtx,
} from './ops';
import { other, type CardInst, type PlayerId } from './types';

/**
 * 每張卡的效果。引擎在對應時機呼叫這些 hook。
 * 卡片顯示的效果文字來自 xlsx，這裡只負責行為。
 */
export interface CardScript {
  /** [頂] 作為最上方招式時的攻擊力修正 */
  atkMod?: number;
  /** [頂] 作為最上方招式時的防禦力修正 */
  defMod?: number;
  /** 不能在起手步驟打出 */
  noOpen?: boolean;
  /** [追] 作為追擊卡時會計算防禦力 */
  pursuitDef?: boolean;
  /** [追] 此卡追擊判定失敗 */
  pursuitFail?: boolean;
  /** [頂] 我方出招時，此卡連擊值可視為這些值 */
  comboAlt?: number[];
  /** [頂] 改變追擊判定的方式 */
  pursuitMode?: 'precise' | 'trapSwap';
  /** [頂] 傷害較高時回合結束不交換先後攻 */
  keepOrder?: boolean;
  /** [起] 作為起手出招時 */
  onOpen?: (g: GameCtx, p: PlayerId, card: CardInst) => Gen;
  /** [發] 打出時 */
  onPlay?: (g: GameCtx, p: PlayerId, card: CardInst) => Gen;
  /** [追] 成為追擊卡時 */
  onPursuitCard?: (g: GameCtx, p: PlayerId, card: CardInst) => Gen;
  /** [追] 成為追擊卡時，我方總防禦 +N */
  pursuitDefBonus?: number;
  /** [追] 成為追擊卡時，我方總攻擊 +N */
  pursuitAtkBonus?: number;
  /** [頂] 戰鬥區只有此卡時，追擊 +N */
  soloPursuitPlus?: number;
  /** [經] 以正面存在經驗區時，傷害計算後的反應 */
  afterDamageExp?: (g: GameCtx, p: PlayerId, card: CardInst, info: { dealt: number; taken: number }) => Gen;
  /** [頂] 傷害計算後 */
  afterDamage?: (g: GameCtx, p: PlayerId, card: CardInst, info: { dealt: number; taken: number }) => Gen;
}

const traps = (cards: CardInst[]) => cards.filter((c) => isTrap(data(c)));

export const scripts: Record<string, CardScript> = {
  吸血打擊: {
    *afterDamage(g, p, _card, { dealt }) {
      const x = Math.floor(dealt / 3);
      if (x > 0) recover(g, p, x);
    },
  },
  // 戒備打擊（劍士）：[頂] 我方總防禦 +2
  戒備打擊: { defMod: 2 },
  // 魅影射擊（弓箭手）：[追] 作為追擊卡時防禦力也計入總防禦
  魅影射擊: { pursuitDefBonus: 4 },
  // 伏擊（盜賊）：[起] 此回合我方總攻擊 +2
  伏擊: {
    *onOpen(g, p) {
      g.state.flags.atkBonus[p] += 2;
      log(g, '【伏擊】此回合總攻擊 +2');
    },
  },
  // 低價買進（商人）：[經] 此卡被覆蓋時，可把經驗區 1 張未覆蓋的卡加入手牌（見 resolveCovered）
  低價買進: {},
  // 高價賣出（商人）：[發_蓋1] 抽 1
  高價賣出: {
    *onPlay(g, p, card) {
      if (yield* optionalPay(g, p, card, { cover: 1 })) yield* draw(g, p, 1);
    },
  },
  // 地雷陷阱（弓箭手）：[追] 我方總攻擊 +3
  地雷陷阱: { pursuitAtkBonus: 3 },
  // 復仇之嚎（劍士）：[經_怒5] 傷害計算後，若對方給予的傷害 > 我方給予的傷害，將怒氣區上方 1 張卡加入手牌
  復仇之嚎: {
    *afterDamageExp(g, p, card, { dealt, taken }) {
      if (taken <= dealt) return;
      if (!(yield* optionalPay(g, p, card, { rage: 5 }))) return;
      const top = Z(g, p, 'rage')[0];
      if (!top) return;
      move(g, top, 'hand');
      log(g, `【復仇之嚎】${pname(g, p)} 將怒氣區上方 1 張卡加入手牌`);
    },
  },
  // 二刀連擊（盜賊）：[頂] 戰鬥區只有此卡時，追擊 +1
  二刀連擊: { soloPursuitPlus: 1 },
  // 電弧（法師）：[發] 抽X，再將 X 張手牌放到牌組底。X = 對方戰鬥區的招式數量
  電弧: {
    *onPlay(g, p) {
      const x = Z(g, other(p), 'combat').length;
      if (x === 0) return;
      yield* draw(g, p, x);
      const put = yield* chooseCards(g, p, `【電弧】選擇 ${x} 張手牌放到牌組底`, Z(g, p, 'hand'), x, x);
      for (const c of put) move(g, c, 'deck', 'bottom');
      log(g, `【電弧】${pname(g, p)} 抽 ${x}，並將 ${put.length} 張手牌放到牌組底`);
    },
  },
  快速治療: {
    *onPlay(g, p, card) {
      if (yield* optionalPay(g, p, card, { cover: 3 })) recover(g, p, 3);
    },
  },
  布局: {
    *onPlay(g, p, card) {
      if (!(yield* optionalPay(g, p, card, { cover: 2 }))) return;
      const [d] = yield* chooseCards(g, p, '【布局】捨棄 1 張手牌', Z(g, p, 'hand'), 1, 1);
      if (d) discard(g, d);
      const [back] = yield* chooseCards(g, p, '【布局】選擇棄牌區 1 張卡放到牌組頂', Z(g, p, 'discard'), 1, 1);
      if (back) {
        move(g, back, 'deck', 'top');
        log(g, `${pname(g, p)} 將【${data(back).name}】放到牌組頂`);
      }
    },
  },
  精準追擊: { pursuitMode: 'precise' },
  // 力量爆破（法師）：[頂] 我方總攻擊 -5
  力量爆破: { atkMod: -5 },
  '3連擊': { comboAlt: [6, 8] },
  '777': {
    noOpen: true,
    *onPlay(g, p, card) {
      const a = Z(g, p, 'deck')[0];
      const b = Z(g, p === 0 ? 1 : 0, 'deck')[0];
      log(g, `【777】展示牌頂：${a ? data(a).name : '（無）'} / ${b ? data(b).name : '（無）'}`);
      if (!a || !b || data(a).combo !== data(b).combo) {
        log(g, '【777】連擊值不相同，捨棄此卡');
        discard(g, card);
      }
    },
  },
  必殺一擊: {
    *onPlay(g, p, card) {
      if (!awakened(g, p)) return;
      if (yield* optionalPay(g, p, card, { rage: 10 })) {
        g.state.flags.pursuitPlus[p]++;
        log(g, '【必殺一擊】此回合追擊+1');
      }
    },
  },
  降級詛咒: {
    *onPlay(g, p, card) {
      if (!(yield* optionalPay(g, p, card, { cover: 2, rage: 5 }))) return;
      for (const q of order(g)) {
        const [c] = yield* chooseCards(g, q, '【降級詛咒】捨棄 1 張經驗', Z(g, q, 'exp'), 1, 1);
        if (c) {
          discard(g, c);
          log(g, `${pname(g, q)} 捨棄經驗【${data(c).name}】`);
        }
      }
    },
  },
  煉金印記: {
    *onOpen(g, p) {
      g.state.flags.alchemy[p] = true;
      log(g, '【煉金印記】此回合每打出 1 張招式時回復 1');
    },
  },
  狙擊印記: {
    *onOpen(g, p) {
      g.state.flags.sniper[p] = true;
      log(g, '【狙擊印記】此回合每打出持有[發]的招式時，抽 1 張怒氣卡並捨棄 1 張手牌');
    },
  },
  先祖圖騰: { defMod: 2 },
  陷阱投擲: {
    *onPlay(g, p) {
      const [c] = yield* chooseCards(g, p, '【陷阱投擲】選擇手中 1 張陷阱放置於經驗區', traps(Z(g, p, 'hand')), 1, 1);
      if (c) {
        toExp(g, c);
        log(g, `${pname(g, p)} 將【${data(c).name}】放置於經驗區`);
      }
    },
  },
  陷阱回收: {
    *onPlay(g, p, card) {
      const pool = traps(Z(g, p, 'discard'));
      if (pool.length === 0) return;
      if (!(yield* optionalPay(g, p, card, { rage: 4 }))) return;
      const [c] = yield* chooseCards(g, p, '【陷阱回收】選擇棄牌區 1 張陷阱加入手中', pool, 1, 1);
      if (c) move(g, c, 'hand');
    },
  },
  驚嚇陷阱: {
    *onPursuitCard(g, p) {
      const [e] = yield* chooseCards(g, p, '【驚嚇陷阱】選擇經驗區 1 張卡加入手中', Z(g, p, 'exp'), 1, 1);
      if (e) move(g, e, 'hand');
      const [t] = yield* chooseCards(g, p, '【驚嚇陷阱】選擇手中 1 張陷阱放置於經驗區', traps(Z(g, p, 'hand')), 1, 1);
      if (t) toExp(g, t);
    },
  },
  陷阱變換: { pursuitMode: 'trapSwap' },
  陷阱窟: {
    *onOpen(g, p, card) {
      const targets = traps(Z(g, p, 'exp')).filter((c) => data(c).atk <= 2);
      if (targets.length === 0) return;
      if (!(yield* optionalPay(g, p, card, { rage: 10 }))) return;
      for (const c of targets) move(g, c, 'combat', 'bottom');
      log(g, `【陷阱窟】${targets.length} 張陷阱置於戰鬥區底`);
    },
  },
  不變應萬變: { keepOrder: true },
};

/**
 * 剛被覆蓋的經驗卡的「被覆蓋時」效果：低價買進（可把經驗區 1 張未覆蓋的卡加入手牌）。
 * 由 ops.optionalPay（蓋X）與黑暗詛咒在覆蓋之後呼叫。
 */
export function* resolveCovered(g: GameCtx): Gen {
  const q = g.state.flags.coveredQ;
  while (q.length > 0) {
    const uid = q.shift()!;
    for (const p of [0, 1] as PlayerId[]) {
      const card = Z(g, p, 'exp').find((c) => c.uid === uid);
      if (!card || !card.covered || card.id !== '低價買進') continue;
      const pool = Z(g, p, 'exp').filter((c) => !c.covered);
      if (pool.length === 0) continue;
      if (!(yield* confirm(g, p, '【低價買進】此卡被覆蓋：要把經驗區 1 張未覆蓋的卡加入手牌嗎？'))) continue;
      const [pick] = yield* chooseCards(g, p, '【低價買進】選擇經驗區 1 張未覆蓋的卡加入手牌', pool, 1, 1);
      if (!pick) continue;
      move(g, pick, 'hand');
      log(g, `【低價買進】${pname(g, p)} 將經驗【${data(pick).name}】加入手牌`);
    }
  }
}
hooks.onCovered = resolveCovered;
