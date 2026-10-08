import { defineSource } from '../effectKit';
import { activate, chooseCards, data, directHit, discard, draw, log, move, pname, recover, Z } from '../ops';
import { other } from '../types';

// 冰與雷之曲（法師）：[蓋3] 收招時，戰鬥區的卡合計具有「冰」「電」兩個特徵時，抽 1、回復 1；
// 一張卡兩個特徵或兩張各一個都算
export const 冰與雷之曲 = defineSource({
  id: '冰與雷之曲',
  at: 'gear',
  on: {
    onPass: (c) => {
      const has = (traits: string[]) => Z(c.g, c.p, 'combat').some((card) => data(card).traits.some((t) => traits.includes(t)));
      return c.effect(
        { label: '【冰與雷之曲】抽 1，回復 1（蓋3）', cost: { cover: 3 }, when: () => has(['冰']) && has(['電']) },
        function* () {
          yield* draw(c.g, c.p, 1);
          recover(c.g, c.p, 1);
          log(c.g, '【冰與雷之曲】抽 1，回復 1');
        },
      );
    },
  },
});

// 火球（法師）：[先_蓋3] 對方直擊 2
export const 火球 = defineSource({
  id: '火球',
  at: 'combat',
  on: {
    onOpen: (c) => c.effect(
      { label: '【火球】對方直擊 2（蓋3）', cost: { cover: 3 } },
      () => void directHit(c.g, other(c.p), 2),
    ),
  },
});

// Explosion!（法師）：[先_蓋8] 對方直擊 5，然後我方收招，並跳過我方下個抽牌階段
export const Explosion = defineSource({
  id: 'Explosion!',
  at: 'combat',
  on: {
    onOpen: (c) => c.effect({ label: '【Explosion!】對方直擊 5，我方收招，跳過抽牌階段（蓋8）', cost: { cover: 8 } }, () => {
      const { g, p } = c;
      directHit(g, other(p), 5);
      g.state.passed[p] = true;
      g.state.flags.skipDraw[p] = true;
      log(g, `【Explosion!】${pname(g, p)} 收招，並跳過這回合的抽牌階段`);
    }),
  },
});

// 冰霜護甲（法師）：[發_蓋2] 回復X，再捨棄我方 3 張裏側經驗。X = 我方裏側經驗的張數；不足 3 張就全捨棄
export const 冰霜護甲 = defineSource({
  id: '冰霜護甲',
  at: 'combat',
  on: {
    onPlay: (c) => c.effect({ label: '【冰霜護甲】回復X，捨棄 3 張裏側經驗（蓋2）', cost: { cover: 2 } }, function* () {
      const { g, p } = c;
      const covered = Z(g, p, 'exp').filter((card) => card.covered);
      recover(g, p, covered.length);
      const drop = yield* chooseCards(g, p, '【冰霜護甲】選擇 3 張裏側經驗捨棄', covered, 3, 3);
      for (const card of drop) discard(g, card);
      log(g, `【冰霜護甲】回復 ${covered.length}，捨棄 ${drop.length} 張裏側經驗`);
    }),
  },
});

// 電弧（法師）：[發] 抽X，再將 X 張手牌放到牌組底。X = 對方戰鬥區的招式數量
export const 電弧 = defineSource({
  id: '電弧',
  at: 'combat',
  on: {
    onPlay: (c) => c.effect(
      { label: '【電弧】抽 X，再放 X 張手牌到牌組底', mandatory: true, when: () => Z(c.g, other(c.p), 'combat').length > 0 },
      function* () {
        const { g, p } = c;
        const x = Z(g, other(p), 'combat').length;
        activate(g, p, c.self!);
        yield* draw(g, p, x);
        const put = yield* chooseCards(g, p, `【電弧】選擇 ${x} 張手牌放到牌組底`, Z(g, p, 'hand'), x, x);
        for (const card of put) move(g, card, 'deck', 'bottom');
        log(g, `【電弧】${pname(g, p)} 抽 ${x}，並將 ${put.length} 張手牌放到牌組底`);
      },
    ),
  },
});

export const MAGE_SOURCES = [冰與雷之曲, 火球, Explosion, 冰霜護甲, 電弧];
