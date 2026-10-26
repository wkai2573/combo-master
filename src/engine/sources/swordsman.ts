import { discardRage, faceUpExp, pay } from '../cost';
import { defineSource } from '../effectKit';
import { activate, awakened, chooseCards, combatZone, data, directHit, discard, isFirst, log, move, pname, recover, topOfZone, Z, type GameCtx } from '../ops';
import { isClassCard, isVanilla } from '../../data/enabledCards';
import { other, type PlayerId } from '../types';

// 家族相片（劍士）：[蓋1_怒2] 回合開始時，回復 1，可選
export const 家族相片 = defineSource({
  id: '家族相片',
  at: 'gear',
  on: {
    turnStart: (c) => c.effect(
      { label: '【家族相片】回復 1（蓋1、怒2）', cost: { cover: 1, rage: 2 } },
      () => void recover(c.g, c.p, 1),
    ),
  },
});

// 凡骨的意志（劍士）：[經] 我方 +X+X，表側在經驗區就持續有效；
// [經] 回合開始時必須蓋前 2 張表側經驗（強制）。兩個效果各自獨立：加成不需要在回合開始發動過，
// 蓋到自己變成裏側，加成就跟著消失
export const 凡骨的意志 = defineSource({
  id: '凡骨的意志',
  at: 'exp',
  on: {
    turnStart: (c) => {
      const { g, p } = c;
      const card = c.self!;
      return {
        label: '【凡骨的意志】蓋前 2 張表側經驗',
        card,
        mandatory: true,
        // 前面的效果（例如家族相片、另一張凡骨的意志）已經把它蓋成裏側，就無效
        available: () => c.here(),
        *run() {
          // 蓋是效果處理而非費用：蓋最前面的表側經驗 2 張，不足就全蓋，不分是不是它自己
          const n = Math.min(2, faceUpExp(g, p).length);
          activate(g, p, card);
          yield* pay(g, p, { cover: n });
          log(g, `【凡骨的意志】${pname(g, p)} 蓋前 ${n} 張表側經驗${card.covered ? '，蓋到自己，加成消失' : ''}`);
        },
      };
    },
  },
  // 加成跟著卡走：只有常駐在經驗區表側時才會被問到，被蓋成裏側或離開經驗區就沒有
  ask: { vanillaBoost: () => 1 },
});

// 復仇之嚎（劍士）：[經_怒3] 傷害計算時，若對方給予的傷害 > 我方給予的傷害，將怒氣區上方 1 張卡加入手牌
// 傷害計算時還沒把這回合的傷害放進怒氣區，所以取的是原本就在怒氣區的卡；要有至少 4 張才能發動（怒3 之後還要有卡可取）。
// 「給予的傷害」讀窗口當下的數字：先發動的減免會讓後面的比較跟著變
export const 復仇之嚎 = defineSource({
  id: '復仇之嚎',
  at: 'exp',
  on: {
    onDamage: (c) => {
      const pending = () => c.g.state.flags.damagePending;
      return c.effect(
        {
          label: '【復仇之嚎】將怒氣區上方 1 張卡加入手牌（怒3）',
          cost: { rage: 3 },
          when: () => pending()[c.p] > pending()[other(c.p)] && Z(c.g, c.p, 'rage').length >= 4,
        },
        () => {
          const top = Z(c.g, c.p, 'rage')[0];
          if (!top) return;
          move(c.g, top, 'hand');
          log(c.g, `【復仇之嚎】${pname(c.g, c.p)} 將怒氣區上方 1 張卡加入手牌`);
        },
      );
    },
  },
});

// 熔岩之擊（劍士）：[發_怒3] 對方直擊 1
export const 熔岩之擊 = defineSource({
  id: '熔岩之擊',
  at: 'moves',
  on: {
    onPlay: (c) => c.effect(
      { label: '【熔岩之擊】對方直擊 1（怒3）', cost: { rage: 3 } },
      () => void directHit(c.g, other(c.p), 1),
    ),
  },
});

// 戒備打擊（劍士）：[頂] 我方 +1+2
export const 戒備打擊 = defineSource({ id: '戒備打擊', at: 'moves', asMove: { topAtk: 1, topDef: 2 } });

// 盾擊（劍士）：[頂] 我方戰鬥區的招式卡，若原始攻擊力小於原始防禦力，則該卡的攻擊力改為原始防禦力
export const 盾擊 = defineSource({ id: '盾擊', at: 'moves', asMove: { liftAtkToDef: true } });

// 嘲諷（劍士）：此卡只能在先手步驟出招，出招時必須支付 [蓋2]；
// [先] 後攻方第一個動作就收招（對方沒有招式）時，我方可以繼續出招；沒有總防禦的扣減
export const 嘲諷 = defineSource({
  id: '嘲諷',
  at: 'moves',
  asMove: { openingOnly: true, playCover: 2 },
  // 嘲諷只能在先手步驟出招，所以它在招式卡疊裡就代表這是先手出招的那張
  ask: { continueAfterFoePass: () => true },
});

// 勇者：戰鬥結算前的基礎攻擊達到門檻時，+2+0；覺醒時門檻較低
export const 勇者 = defineSource({
  id: '勇者',
  at: 'char',
  ask: { combatBonus: (c, { baseAtk }) => ({ atk: baseAtk >= (awakened(c.g, c.p) ? 10 : 15) ? 2 : 0 }) },
});

// 後人：後攻回合總防禦 +1；覺醒（追加）後攻回合，每張追擊卡若為白板卡，其防禦也計入總防禦，否則 +0+2
export const 後人 = defineSource({
  id: '後人',
  at: 'char',
  ask: {
    combatBonus: (c) => {
      if (isFirst(c.g, c.p)) return {};
      let pursuitDef = 0;
      let extra = 0;
      if (awakened(c.g, c.p)) {
        for (const card of Z(c.g, c.p, 'pursuit')) {
          if (isVanilla(data(card))) pursuitDef += data(card).def;
          else extra += 2;
        }
      }
      return { def: 1 + extra, pursuitDef };
    },
  },
});
// 洩憤（劍士）：[發_蓋3] 將怒氣區上方 2 張卡捨棄，然後其中的職業卡加入手牌
// 沒有看與選擇：2 張先進棄牌區（雙方都看得到），其中的職業卡全部再從棄牌區加入手牌
export const 洩憤 = defineSource({
  id: '洩憤',
  at: 'moves',
  on: {
    onPlay: (c) => c.effect({ label: '【洩憤】怒氣區上方 2 張捨棄，其中的職業卡加入手牌（蓋3）', cost: { cover: 3 } }, () => {
      const { g, p } = c;
      const top = Z(g, p, 'rage').slice(0, 2);
      for (const card of top) discard(g, card);
      const taken = top.filter((card) => isClassCard(data(card)));
      for (const card of taken) move(g, card, 'hand');
      const name = (cards: typeof top) => cards.map((card) => `【${data(card).name}】`).join('') || '（無）';
      log(g, `【洩憤】${pname(g, p)} 捨棄怒氣區上方 ${top.length} 張：${name(top)}，職業卡加入手牌：${name(taken)}`);
    }),
  },
});

// 威嚇戰吼（劍士）：[頂] 當對方出招時，且我方怒氣區卡片數 > 對方牌組卡片數，對方直擊 X。X＝對方戰鬥區的卡片數。
// 強制；每次對方出招都在那張招式放上戰鬥區之後重新判斷條件與 X，X 含剛打出的那張。只有位於招式卡疊最上方時才觸發
const 威嚇條件 = (g: GameCtx, p: PlayerId) =>
  Z(g, p, 'rage').length > Z(g, other(p), 'deck').length;
export const 威嚇戰吼 = defineSource({
  id: '威嚇戰吼',
  at: 'moves',
  on: {
    onFoePlay: (c) => c.effect(
      { label: '【威嚇戰吼】對方直擊 X（X＝對方戰鬥區的卡片數）', mandatory: true, when: () => topOfZone(c.g, c.p) === c.self && 威嚇條件(c.g, c.p) },
      () => {
        const { g, p } = c;
        const foe = other(p);
        const x = combatZone(g, foe).length;
        activate(g, p, c.self!);
        log(g, `【威嚇戰吼】${pname(g, foe)} 出招，${pname(g, p)} 的怒氣區多於對方牌組，對方直擊 ${x}`);
        directHit(g, foe, x);
      },
    ),
  },
});

// 盛怒漩渦（劍士）：[發] 選擇我方棄牌區 3 張卡放到怒氣區頂。沒有費用；強制效果，棄牌區不足 3 張就有幾張放幾張。
// 放進怒氣區的牌誰都看不到牌面，紀錄只寫張數
export const 盛怒漩渦 = defineSource({
  id: '盛怒漩渦',
  at: 'moves',
  on: {
    onPlay: (c) => c.effect(
      { label: '【盛怒漩渦】選擇棄牌區 3 張卡放到怒氣區頂', mandatory: true, when: () => Z(c.g, c.p, 'discard').length > 0 },
      function* () {
        const { g, p } = c;
        activate(g, p, c.self!);
        const picked = yield* chooseCards(g, p, '【盛怒漩渦】選擇棄牌區 3 張卡放到怒氣區頂', Z(g, p, 'discard'), 3, 3);
        for (const card of picked) move(g, card, 'rage', 'top');
        log(g, `【盛怒漩渦】${pname(g, p)} 將棄牌區 ${picked.length} 張卡放到怒氣區頂`);
      },
    ),
  },
});

// 狂戰（劍士）：三個 [經] 效果，都只在表側經驗區有效，被蓋成裏側就全部停止，翻回表側恢復：
// ① 我方戰鬥區卡片效果全部無效（查詢 combatEffectsVoid，登記表與戰鬥結算都尊重它）
// ② 我方 +X+0，X＝我方戰鬥區的招式數量（招式卡疊加追擊卡疊）
// ③ 回合開始時（強制）必須捨棄怒氣區 5 張，有幾張捨幾張；不足 5 張時，捨完全部怒氣之後再把自己捨棄到棄牌區。
//   捨棄的怒氣進棄牌區後雙方才看得到，紀錄只寫張數
export const 狂戰 = defineSource({
  id: '狂戰',
  at: 'exp',
  on: {
    turnStart: (c) => c.effect(
      { label: '【狂戰】必須捨棄 5 張怒氣，不足 5 張時此卡捨棄', mandatory: true, group: '狂戰' },
      () => {
        const { g, p } = c;
        const card = c.self!;
        activate(g, p, card);
        const n = discardRage(g, p, 5);
        if (n < 5) {
          discard(g, card);
          log(g, `【狂戰】${pname(g, p)} 捨棄怒氣 ${n} 張，不足 5 張，【狂戰】捨棄到棄牌區`);
        } else {
          log(g, `【狂戰】${pname(g, p)} 捨棄怒氣 5 張`);
        }
      },
    ),
  },
  ask: {
    combatEffectsVoid: () => true,
    flatAtk: (c) => combatZone(c.g, c.p).length,
  },
});

export const SWORDSMAN_SOURCES = [家族相片, 凡骨的意志, 復仇之嚎, 熔岩之擊, 戒備打擊, 盾擊, 嘲諷, 洩憤, 威嚇戰吼, 盛怒漩渦, 狂戰, 勇者, 後人];
