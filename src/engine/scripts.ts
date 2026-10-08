import { hasExpEffect } from '../data/expEffect';
import {
  activate, ask, awakened, canPay, chooseCards, confirm, COVER_REACTIONS, data, directHit, discard, draw, faceUpExp, isFirst, Z, log, move,
  optionalPay, order, pay, pname, recover, type Gen, type GameCtx,
} from './ops';
import { other, type CardInst, type PlayerId } from './types';

/**
 * 每張卡的效果。引擎在對應時機呼叫這些 hook。
 * 卡片顯示的效果文字來自卡表網頁（cardTable.json），這裡只負責行為。
 */
export interface CardScript {
  /** [頂] 作為最上方招式時的攻擊力修正 */
  atkMod?: number;
  /** [頂] 作為最上方招式時的防禦力修正 */
  defMod?: number;
  /** [追] 此卡追擊判定失敗 */
  pursuitFail?: boolean;
  /** [先] 作為先手步驟出招時 */
  onOpen?: (g: GameCtx, p: PlayerId, card: CardInst) => Gen;
  /** [發] 打出時 */
  onPlay?: (g: GameCtx, p: PlayerId, card: CardInst) => Gen;
  /** [追] 成為追擊卡時 */
  onPursuitCard?: (g: GameCtx, p: PlayerId, card: CardInst) => Gen;
  /** [經] 此卡在經驗區被蓋成裏側時 */
  onCovered?: (g: GameCtx, p: PlayerId, card: CardInst) => Gen;
  /** [頂] 依場面加成的總攻擊（盾擊） */
  topAtkBonus?: (g: GameCtx, p: PlayerId) => number;
  /** [追] 成為追擊卡時，我方總防禦 +N */
  pursuitDefBonus?: number;
  /** [追] 成為追擊卡時，我方總攻擊 +N */
  pursuitAtkBonus?: number;
  /** [頂] 戰鬥區只有此卡時，追擊 +N */
  soloPursuitPlus?: number;
  /** [經] 以正面存在經驗區時，傷害計算後的反應 */
  afterDamageExp?: (g: GameCtx, p: PlayerId, card: CardInst, info: { dealt: number; taken: number }) => Gen;
}

export const scripts: Record<string, CardScript> = {
  // 戒備打擊（劍士）：[頂] 我方總防禦 +2
  戒備打擊: { defMod: 2 },
  // 魅影射擊（弓箭手）：[追] 作為追擊卡時防禦力也計入總防禦
  魅影射擊: { pursuitDefBonus: 4 },
  // 伏擊（盜賊）：[先] 此回合我方總攻擊 +2
  伏擊: {
    *onOpen(g, p, card) {
      activate(g, p, card);
      g.state.flags.atkBonus[p] += 2;
      log(g, '【伏擊】此回合總攻擊 +2');
    },
  },
  // 低價買進（商人）：[經] 此卡被蓋成裏側時，回復 3
  低價買進: {
    onCovered: COVER_REACTIONS['低價買進'],
  },
  // 高價賣出（商人）：[經] 此卡被蓋成裏側時，抽 1
  高價賣出: {
    onCovered: COVER_REACTIONS['高價賣出'],
  },
  // 地雷陷阱（弓箭手）：[追] 我方總攻擊 +3
  地雷陷阱: { pursuitAtkBonus: 3 },
  // 復仇之嚎（劍士）：[經_怒3] 傷害計算後，若對方給予的傷害 > 我方給予的傷害，將怒氣區上方 1 張卡加入手牌
  復仇之嚎: {
    *afterDamageExp(g, p, card, { dealt, taken }) {
      if (taken <= dealt) return;
      if (!(yield* optionalPay(g, p, card, { rage: 3 }))) return;
      const top = Z(g, p, 'rage')[0];
      if (!top) return;
      move(g, top, 'hand');
      log(g, `【復仇之嚎】${pname(g, p)} 將怒氣區上方 1 張卡加入手牌`);
    },
  },
  // 二刀連擊（盜賊）：[頂] 戰鬥區只有此卡時，追擊 +1
  二刀連擊: { soloPursuitPlus: 1 },
  // 順手牽羊（盜賊）：[先_蓋X] 抽X，此回合我方總攻擊 -X。X 最大為 2
  順手牽羊: {
    *onOpen(g, p, card) {
      const x = yield* chooseX(g, p, card, 2, '蓋 X 張經驗，抽 X，此回合總攻擊 −X');
      if (x === 0) return;
      activate(g, p, card);
      yield* payCover(g, p, x);
      yield* draw(g, p, x);
      g.state.flags.atkBonus[p] -= x;
      log(g, `【順手牽羊】抽 ${x}，此回合總攻擊 −${x}`);
    },
  },
  // 交涉（商人）：[發_蓋X] 抽X，再將 X 張手牌放到牌組底。X 最大為 3
  交涉: {
    *onPlay(g, p, card) {
      const x = yield* chooseX(g, p, card, 3, '蓋 X 張經驗，抽 X，再放 X 張手牌到牌組底');
      if (x === 0) return;
      activate(g, p, card);
      yield* payCover(g, p, x);
      yield* draw(g, p, x);
      const put = yield* chooseCards(g, p, `【交涉】選擇 ${x} 張手牌放到牌組底`, Z(g, p, 'hand'), x, x);
      for (const c of put) move(g, c, 'deck', 'bottom');
      log(g, `【交涉】抽 ${x}，並將 ${put.length} 張手牌放到牌組底`);
    },
  },
  // 冰霜護甲（法師）：[發_蓋2] 回復X，再捨棄我方 2 張裏側經驗。X = 我方裏側經驗的張數
  冰霜護甲: {
    *onPlay(g, p, card) {
      if (!(yield* optionalPay(g, p, card, { cover: 2 }))) return;
      const covered = Z(g, p, 'exp').filter((c) => c.covered);
      recover(g, p, covered.length);
      const drop = yield* chooseCards(g, p, '【冰霜護甲】選擇 2 張裏側經驗捨棄', covered, 2, 2);
      for (const c of drop) discard(g, c);
      log(g, `【冰霜護甲】回復 ${covered.length}，捨棄 ${drop.length} 張裏側經驗`);
    },
  },
  // 盾擊（劍士）：[頂] 我方總攻擊 +X。X = 我方戰鬥區防禦力 ≧ 4 的卡片張數
  盾擊: { topAtkBonus: (g, p) => Z(g, p, 'combat').filter((c) => data(c).def >= 4).length },
  // 即時停損（商人）：[發_蓋4] 此卡打出後雙方立即收招
  即時停損: {
    *onPlay(g, p, card) {
      if (!(yield* optionalPay(g, p, card, { cover: 4 }))) return;
      g.state.passed = [true, true];
      log(g, '【即時停損】雙方立即收招');
    },
  },
  // 二連矢（弓箭手）：[追] 追擊 +1
  二連矢: {
    *onPursuitCard(g, p, card) {
      activate(g, p, card);
      g.state.flags.pursuitPlus[p]++;
      log(g, '【二連矢】追擊+1');
    },
  },
  // 凡骨的意志（劍士）：[經] 回合開始時強制蓋 1，此回合總攻擊 +X、總防禦 +X（見 turnStartEffects）
  凡骨的意志: {},
  // 卸除鎧甲（盜賊）：[先_蓋2] 選擇對方 1 張裝備或增益卡，送入棄牌區
  卸除鎧甲: {
    *onOpen(g, p, card) {
      const targets = [...Z(g, other(p), 'gear'), ...Z(g, other(p), 'buff')];
      if (targets.length === 0) return;
      if (!(yield* optionalPay(g, p, card, { cover: 2 }))) return;
      const [t] = yield* chooseCards(g, p, '【卸除鎧甲】選擇對方 1 張裝備或增益卡送入棄牌區', targets, 1, 1);
      if (t) {
        discard(g, t);
        log(g, `【卸除鎧甲】對方的【${data(t).name}】送入棄牌區`);
      }
    },
  },
  // 火球（法師）：[先_蓋3] 對方直擊 2
  火球: {
    *onOpen(g, p, card) {
      if (!(yield* optionalPay(g, p, card, { cover: 3 }))) return;
      directHit(g, other(p), 2);
    },
  },
  // 塗毒（盜賊）：[先_蓋1] 歸還時，將 [Ex卡-中毒] 移入出招卡較少那方的經驗區，相同時落入對方
  塗毒: {
    *onOpen(g, p, card) {
      if (!(yield* optionalPay(g, p, card, { cover: 1 }))) return;
      g.state.flags.poisonQ.push(p);
      log(g, '【塗毒】歸還時，[Ex卡-中毒]將移入經驗區');
    },
  },
  // 電弧（法師）：[發] 抽X，再將 X 張手牌放到牌組底。X = 對方戰鬥區的招式數量
  電弧: {
    *onPlay(g, p, card) {
      const x = Z(g, other(p), 'combat').length;
      if (x === 0) return;
      activate(g, p, card);
      yield* draw(g, p, x);
      const put = yield* chooseCards(g, p, `【電弧】選擇 ${x} 張手牌放到牌組底`, Z(g, p, 'hand'), x, x);
      for (const c of put) move(g, c, 'deck', 'bottom');
      log(g, `【電弧】${pname(g, p)} 抽 ${x}，並將 ${put.length} 張手牌放到牌組底`);
    },
  },
  // 力量爆破（法師）：[頂] 我方總攻擊 -3；[追] 此卡追擊判定失敗
  力量爆破: { atkMod: -3, pursuitFail: true },
  // Explosion!（法師）：[先_蓋8] 對方直擊 5，然後我方收招，並跳過我方下個抽牌階段
  'Explosion!': {
    *onOpen(g, p, card) {
      if (!(yield* optionalPay(g, p, card, { cover: 8 }))) return;
      directHit(g, other(p), 5);
      g.state.passed[p] = true;
      g.state.flags.skipDraw[p] = true;
      log(g, `【Explosion!】${pname(g, p)} 收招，並跳過這回合的抽牌階段`);
    },
  },
  // 高利貸（商人）：[發] 對方蓋X。X = 對方帶 [經] 的表側經驗張數
  高利貸: {
    *onPlay(g, p, card) {
      const foe = other(p);
      const x = faceUpExp(g, foe).filter((c) => hasExpEffect(c.id)).length;
      if (x === 0) return;
      activate(g, p, card);
      log(g, `【高利貸】${pname(g, foe)} 的表側經驗中有 ${x} 張帶 [經]，強制蓋 ${x}`);
      yield* pay(g, foe, { cover: x });
    },
  },
  // 狙擊蓄力（弓箭手）：[發_蓋4] 抽2，再選擇 1 張手牌放到牌組頂
  狙擊蓄力: {
    *onPlay(g, p, card) {
      if (!(yield* optionalPay(g, p, card, { cover: 4 }))) return;
      yield* draw(g, p, 2);
      const [c] = yield* chooseCards(g, p, '【狙擊蓄力】選擇 1 張手牌放到牌組頂', Z(g, p, 'hand'), 1, 1);
      if (c) {
        move(g, c, 'deck', 'top');
        log(g, `【狙擊蓄力】${pname(g, p)} 抽 2，並將 1 張手牌放到牌組頂`);
      }
    },
  },
  // 熔岩之擊（劍士）：[發_怒3] 對方直擊 1
  熔岩之擊: {
    *onPlay(g, p, card) {
      if (!(yield* optionalPay(g, p, card, { rage: 3 }))) return;
      directHit(g, other(p), 1);
    },
  },
  // 狙擊印記（弓箭手）：[先] 此回合我方的瞄準升級 1
  狙擊印記: {
    *onOpen(g, p) {
      g.state.flags.aimUp[p]++;
      log(g, '【狙擊印記】此回合瞄準升級 1');
    },
  },
};

/** 蓋 X 張經驗（付費用）並處理連鎖效果 */
function* payCover(g: GameCtx, p: PlayerId, x: number): Gen {
  yield* pay(g, p, { cover: x });
}

/** 可變的 X（[蓋X]）：玩家選擇要蓋幾張（0 ＝ 不發動），最多 max 張且受正面經驗張數限制 */
function* chooseX(g: GameCtx, p: PlayerId, card: CardInst, max: number, label: string): Gen<number> {
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

/**
 * 回合開始時的效果（先攻方先處理）：
 * - 家族相片：[蓋1_怒3] 回復 1
 * - 凡骨的意志：強制蓋 1，此回合總攻擊 +X、總防禦 +X（X = 戰鬥區白板卡數）
 * - 中毒：我方後攻的回合開始時，直擊我方 3
 */
export function* turnStartEffects(g: GameCtx): Gen {
  const f = g.state.flags;
  for (const p of order(g)) {
    for (const photo of Z(g, p, 'gear').filter((c) => c.id === '家族相片')) {
      if (yield* optionalPay(g, p, photo, { cover: 1, rage: 3 })) recover(g, p, 1);
    }
    for (const card of Z(g, p, 'exp').filter((c) => c.id === '凡骨的意志' && !c.covered)) {
      // 前面的費用（例如家族相片）已經把它蓋住，就無效
      if (card.covered || !canPay(g, p, { cover: 1 })) continue;
      // 蓋的是最前面的正面卡，不分是不是它自己；蓋到自己時效果仍照付費後發動，但之後它被蓋住就無效
      activate(g, p, card);
      yield* payCover(g, p, 1);
      f.vanillaBoost[p]++;
      log(g, `【凡骨的意志】${pname(g, p)} 強制蓋 1${card.covered ? '（蓋到自己，之後無效）' : ''}，此回合總攻擊與總防禦各加上戰鬥區白板卡的數量`);
    }
    if (!isFirst(g, p)) {
      const poisons = Z(g, p, 'exp').filter((x) => x.id === 'Ex卡-中毒' && !x.covered).length;
      for (let i = 0; i < poisons; i++) {
        log(g, `【中毒】${pname(g, p)} 的後攻回合開始`);
        directHit(g, p, 3);
      }
    }
  }
}

/** 收招時的效果：冰與雷之曲（[蓋3] 戰鬥區有「冰」「雷」特徵的卡各至少 1 張時，抽 1、回復 1） */
export function* onPassEffects(g: GameCtx, p: PlayerId): Gen {
  const song = Z(g, p, 'gear').find((c) => c.id === '冰與雷之曲');
  if (!song) return;
  const has = (traits: string[]) => Z(g, p, 'combat').some((c) => data(c).traits.some((t) => traits.includes(t)));
  if (!has(['冰']) || !has(['雷', '電'])) return;
  if (!(yield* optionalPay(g, p, song, { cover: 3 }))) return;
  yield* draw(g, p, 1);
  recover(g, p, 1);
  log(g, '【冰與雷之曲】抽 1，回復 1');
}

/**
 * 商人爆發後：可以調整表側經驗的順序（蓋X 從最前面開始蓋）；覺醒後還可以把 1 張表側的經驗卡加入手牌。
 */
export function* merchantAfterBurst(g: GameCtx, p: PlayerId): Gen {
  if (g.state.players[p].charId !== '商人') return;
  const exp = Z(g, p, 'exp');
  const faceUp = exp.filter((c) => !c.covered);
  if (faceUp.length >= 2 && (yield* confirm(g, p, '【商人】要調整表側經驗的順序嗎？'))) {
    const rest = [...faceUp];
    const order_: CardInst[] = [];
    while (rest.length > 1) {
      const [c] = yield* chooseCards(g, p, `【商人】選擇排在第 ${order_.length + 1} 位的表側經驗（最前面的最先被蓋）`, rest, 1, 1);
      order_.push(c);
      rest.splice(rest.indexOf(c), 1);
    }
    order_.push(...rest);
    const slots = exp.map((c, i) => (c.covered ? -1 : i)).filter((i) => i >= 0);
    order_.forEach((c, k) => {
      exp[slots[k]] = c;
    });
    log(g, `【商人】${pname(g, p)} 調整了表側經驗的順序`);
  }
  if (awakened(g, p)) {
    const pool = Z(g, p, 'exp').filter((c) => !c.covered);
    if (pool.length > 0 && (yield* confirm(g, p, '【商人】覺醒：要將 1 張表側經驗加入手牌嗎？'))) {
      const [pick] = yield* chooseCards(g, p, '【商人】選擇 1 張表側經驗加入手牌', pool, 1, 1);
      if (pick) {
        move(g, pick, 'hand');
        log(g, `【商人】${pname(g, p)} 將經驗【${data(pick).name}】加入手牌`);
      }
    }
  }
}
