import { hasExpEffect } from '../data/expEffect';
import {
  activate, ask, awakened, canPay, chooseCards, confirm, COVER_REACTIONS, data, directHit, discard, draw, faceUpExp, isFirst, Z, log, move,
  optionalPay, order, pay, pname, recover, type Gen, type GameCtx,
} from './ops';
import { triggerWindow, type WindowEffect } from './window';
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
  /** [頂] 作為最上方招式時，戰鬥區每張招式卡的攻擊力至少是它的原始防禦力（盾擊） */
  liftAtkToDef?: boolean;
  /** [追] 成為追擊卡時，我方總防禦 +N */
  pursuitDefBonus?: number;
  /** [追] 成為追擊卡時，我方總攻擊 +N */
  pursuitAtkBonus?: number;
  /** [頂] 戰鬥區只有此卡時，追擊 +N */
  soloPursuitPlus?: number;
  /** [經] 以表側存在經驗區時，傷害計算後的效果（進傷害計算後的觸發窗口）；此刻不成立就回傳 null */
  afterDamageEffect?: (g: GameCtx, p: PlayerId, card: CardInst, info: { dealt: number; taken: number }) => WindowEffect | null;
}

export const scripts: Record<string, CardScript> = {
  // 戒備打擊（劍士）：[頂] 我方總攻擊 +2，總防禦 +2
  戒備打擊: { atkMod: 2, defMod: 2 },
  // 魅影射擊（弓箭手）：[追] 作為追擊卡時防禦力也計入總防禦
  魅影射擊: { pursuitDefBonus: 4 },
  // 伏擊（盜賊）：[先] 此回合我方總攻擊 +4
  伏擊: {
    *onOpen(g, p, card) {
      activate(g, p, card);
      g.state.flags.atkBonus[p] += 4;
      log(g, '【伏擊】此回合總攻擊 +4');
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
    afterDamageEffect(g, p, card, { dealt, taken }) {
      if (taken <= dealt) return null;
      return {
        label: '【復仇之嚎】將怒氣區上方 1 張卡加入手牌（怒3）',
        available: () => card.zone === 'exp' && !card.covered && canPay(g, p, { rage: 3 }),
        *run(confirmed) {
          if (!(yield* optionalPay(g, p, card, { rage: 3 }, !confirmed))) return;
          const top = Z(g, p, 'rage')[0];
          if (!top) return;
          move(g, top, 'hand');
          log(g, `【復仇之嚎】${pname(g, p)} 將怒氣區上方 1 張卡加入手牌`);
        },
      };
    },
  },
  // 二刀連擊（盜賊）：[頂] 戰鬥區只有此卡時，追擊 +1
  二刀連擊: { soloPursuitPlus: 1 },
  // 順手牽羊（盜賊）：[發_蓋X] 抽X，此回合我方總防禦 -X。X 最大為 2
  順手牽羊: {
    *onPlay(g, p, card) {
      const x = yield* chooseX(g, p, card, 2, '蓋 X 張經驗，抽 X，此回合總防禦 −X');
      if (x === 0) return;
      activate(g, p, card);
      yield* payCover(g, p, x);
      yield* draw(g, p, x);
      g.state.flags.defBonus[p] -= x;
      log(g, `【順手牽羊】抽 ${x}，此回合總防禦 −${x}`);
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
  // 冰霜護甲（法師）：[發_蓋2] 回復X，再捨棄我方 3 張裏側經驗。X = 我方裏側經驗的張數；不足 3 張就全捨棄
  冰霜護甲: {
    *onPlay(g, p, card) {
      if (!(yield* optionalPay(g, p, card, { cover: 2 }))) return;
      const covered = Z(g, p, 'exp').filter((c) => c.covered);
      recover(g, p, covered.length);
      const drop = yield* chooseCards(g, p, '【冰霜護甲】選擇 3 張裏側經驗捨棄', covered, 3, 3);
      for (const c of drop) discard(g, c);
      log(g, `【冰霜護甲】回復 ${covered.length}，捨棄 ${drop.length} 張裏側經驗`);
    },
  },
  // 盾擊（劍士）：[頂] 我方戰鬥區的招式卡，若原始攻擊力小於原始防禦力，則該卡的攻擊力改為原始防禦力
  盾擊: { liftAtkToDef: true },
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
  // 凡骨的意志（劍士）：[經] 回合開始時需蓋前 2 張表側經驗，此回合總攻擊 +X、總防禦 +X（見 turnStartEffects）
  凡骨的意志: {},
  // 卸除鎧甲（盜賊）：[發_蓋2] 選擇對方 1 張裝備或增益卡，送入棄牌區
  卸除鎧甲: {
    *onPlay(g, p, card) {
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
 * 回合開始時的效果（進回合開始的觸發窗口，先攻方先處理）：
 * - 家族相片：[蓋1_怒3] 回復 1，可選
 * - 凡骨的意志：蓋前 2 張表側經驗，此回合總攻擊 +X、總防禦 +X（X = 戰鬥區白板卡數），強制
 * - 中毒：我方後攻的回合開始時，直擊我方 3，強制
 */
export function* turnStartEffects(g: GameCtx): Gen {
  for (const p of order(g)) yield* triggerWindow(g, p, '回合開始', turnStartWindowEffects(g, p));
}

function turnStartWindowEffects(g: GameCtx, p: PlayerId): WindowEffect[] {
  const f = g.state.flags;
  const out: WindowEffect[] = [];
  for (const photo of Z(g, p, 'gear').filter((c) => c.id === '家族相片')) {
    out.push({
      label: '【家族相片】回復 1（蓋1、怒3）',
      available: () => photo.zone === 'gear' && canPay(g, p, { cover: 1, rage: 3 }),
      *run(confirmed) {
        if (yield* optionalPay(g, p, photo, { cover: 1, rage: 3 }, !confirmed)) recover(g, p, 1);
      },
    });
  }
  for (const card of Z(g, p, 'exp').filter((c) => c.id === '凡骨的意志' && !c.covered)) {
    out.push({
      label: '【凡骨的意志】蓋前 2 張表側經驗，此回合總攻擊與總防禦加上戰鬥區白板卡的數量',
      mandatory: true,
      // 前面的效果（例如家族相片）已經把它蓋成裏側，就無效
      available: () => card.zone === 'exp' && !card.covered && faceUpExp(g, p).length > 0,
      *run() {
        // 蓋是效果處理而非費用：蓋最前面的表側經驗 2 張，不足就全蓋，不分是不是它自己；
        // 蓋到自己時這回合的加成照給，但之後它是裏側就無效
        const n = Math.min(2, faceUpExp(g, p).length);
        activate(g, p, card);
        yield* payCover(g, p, n);
        f.vanillaBoost[p]++;
        log(g, `【凡骨的意志】${pname(g, p)} 蓋前 ${n} 張表側經驗${card.covered ? '（蓋到自己，之後無效）' : ''}，此回合總攻擊與總防禦各加上戰鬥區白板卡的數量`);
      },
    });
  }
  if (!isFirst(g, p)) {
    for (const poison of Z(g, p, 'exp').filter((x) => x.id === 'Ex卡-中毒' && !x.covered)) {
      out.push({
        label: '【中毒】直擊 3',
        mandatory: true,
        available: () => poison.zone === 'exp' && !poison.covered,
        *run() {
          log(g, `【中毒】${pname(g, p)} 的後攻回合開始`);
          directHit(g, p, 3);
        },
      });
    }
  }
  return out;
}

/** 收招時的效果（進收招時的觸發窗口）：冰與雷之曲（[蓋3] 戰鬥區的卡合計具有「冰」「雷」兩個特徵時，抽 1、回復 1；一張卡兩個特徵或兩張各一個都算） */
export function* onPassEffects(g: GameCtx, p: PlayerId): Gen {
  const song = Z(g, p, 'gear').find((c) => c.id === '冰與雷之曲');
  if (!song) return;
  const has = (traits: string[]) => Z(g, p, 'combat').some((c) => data(c).traits.some((t) => traits.includes(t)));
  yield* triggerWindow(g, p, '收招時', [
    {
      label: '【冰與雷之曲】抽 1，回復 1（蓋3）',
      available: () => song.zone === 'gear' && has(['冰']) && has(['雷']) && canPay(g, p, { cover: 3 }),
      *run(confirmed) {
        if (!(yield* optionalPay(g, p, song, { cover: 3 }, !confirmed))) return;
        yield* draw(g, p, 1);
        recover(g, p, 1);
        log(g, '【冰與雷之曲】抽 1，回復 1');
      },
    },
  ]);
}

/**
 * 商人爆發後的效果（進爆發窗口）：
 * - 調整表側經驗的順序（蓋X 從最前面開始蓋，裏側的卡位置不動）
 * - 覺醒後：把 1 張表側經驗加入手牌
 */
export function merchantBurstEffects(g: GameCtx, p: PlayerId): WindowEffect[] {
  if (g.state.players[p].charId !== '商人') return [];
  return [
    {
      label: '【商人】調整表側經驗的順序',
      available: () => faceUpExp(g, p).length >= 2,
      *run(confirmed) {
        if (!confirmed && !(yield* confirm(g, p, '【商人】要調整表側經驗的順序嗎？'))) return;
        const exp = Z(g, p, 'exp');
        const rest = faceUpExp(g, p);
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
      },
    },
    {
      label: '【商人】覺醒：將 1 張表側經驗加入手牌',
      available: () => awakened(g, p) && faceUpExp(g, p).length > 0,
      *run(confirmed) {
        if (!confirmed && !(yield* confirm(g, p, '【商人】覺醒：要將 1 張表側經驗加入手牌嗎？'))) return;
        const [pick] = yield* chooseCards(g, p, '【商人】選擇 1 張表側經驗加入手牌', faceUpExp(g, p), 1, 1);
        if (pick) {
          move(g, pick, 'hand');
          log(g, `【商人】${pname(g, p)} 將經驗【${data(pick).name}】加入手牌`);
        }
      },
    },
  ];
}
