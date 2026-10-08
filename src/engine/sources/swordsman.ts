import { faceUpExp, pay } from '../cost';
import { defineSource } from '../effectKit';
import { activate, log, move, pname, recover, Z } from '../ops';

// 家族相片（劍士）：[蓋1_怒3] 回合開始時，回復 1，可選
export const 家族相片 = defineSource({
  id: '家族相片',
  at: 'gear',
  on: {
    turnStart: (c) => c.effect(
      { label: '【家族相片】回復 1（蓋1、怒3）', cost: { cover: 1, rage: 3 } },
      () => void recover(c.g, c.p, 1),
    ),
  },
});

// 凡骨的意志（劍士）：[經] 回合開始時需蓋前 2 張表側經驗，此回合總攻擊 +X、總防禦 +X，強制
export const 凡骨的意志 = defineSource({
  id: '凡骨的意志',
  at: 'exp',
  on: {
    turnStart: (c) => {
      const { g, p } = c;
      const card = c.self!;
      return {
        label: '【凡骨的意志】蓋前 2 張表側經驗，此回合總攻擊與總防禦加上戰鬥區白板卡的數量',
        mandatory: true,
        // 前面的效果（例如家族相片）已經把它蓋成裏側，就無效
        available: () => c.here() && faceUpExp(g, p).length > 0,
        *run() {
          // 蓋是效果處理而非費用：蓋最前面的表側經驗 2 張，不足就全蓋，不分是不是它自己；
          // 蓋到自己時這回合的加成照給，但之後它是裏側就無效
          const n = Math.min(2, faceUpExp(g, p).length);
          activate(g, p, card);
          yield* pay(g, p, { cover: n });
          g.state.flags.vanillaBoost[p]++;
          log(g, `【凡骨的意志】${pname(g, p)} 蓋前 ${n} 張表側經驗${card.covered ? '（蓋到自己，之後無效）' : ''}，此回合總攻擊與總防禦各加上戰鬥區白板卡的數量`);
        },
      };
    },
  },
});

// 復仇之嚎（劍士）：[經_怒3] 傷害計算後，若對方給予的傷害 > 我方給予的傷害，將怒氣區上方 1 張卡加入手牌
export const 復仇之嚎 = defineSource({
  id: '復仇之嚎',
  at: 'exp',
  on: {
    afterDamage: (c) => {
      if (c.taken <= c.dealt) return null;
      return c.effect(
        { label: '【復仇之嚎】將怒氣區上方 1 張卡加入手牌（怒3）', cost: { rage: 3 } },
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

export const SWORDSMAN_SOURCES = [家族相片, 凡骨的意志, 復仇之嚎];
