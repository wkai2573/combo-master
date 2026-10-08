import { canPay, chooseX, faceUpExp, pay } from '../cost';
import { hasExpEffect } from '../effects';
import { defineSource } from '../effectKit';
import { activate, awakened, chooseCards, confirm, data, draw, log, move, pname, recover, settle, Z, type GameCtx, type Gen } from '../ops';
import { other, type CardInst, type PlayerId } from '../types';

// 招財貓（商人）：[蓋2] 爆發時，額外抽 1
export const 招財貓 = defineSource({
  id: '招財貓',
  at: 'gear',
  on: {
    afterBurst: (c) => c.effect(
      { label: '【招財貓】爆發時，抽 1（蓋2）', cost: { cover: 2 } },
      function* () {
        yield* draw(c.g, c.p, 1);
        log(c.g, `【招財貓】${pname(c.g, c.p)} 爆發時額外抽 1`);
      },
    ),
  },
});

/**
 * 商人爆發後的效果：
 * - 調整表側經驗的順序（蓋X 從最前面開始蓋，裏側的卡位置不動）
 * - 覺醒後：把 1 張表側經驗加入手牌
 */
export const 商人 = defineSource({
  id: '商人',
  at: 'char',
  on: {
    afterBurst: ({ g, p }) => [
      {
        label: '【商人】調整表側經驗的順序',
        available: () => faceUpExp(g, p).length >= 2,
        *run(confirmed) {
          if (!confirmed && !(yield* confirm(g, p, '【商人】要調整表側經驗的順序嗎？'))) return;
          const exp = Z(g, p, 'exp');
          const rest = faceUpExp(g, p);
          const order_: CardInst[] = [];
          while (rest.length > 1) {
            const [pick] = yield* chooseCards(g, p, `【商人】選擇排在第 ${order_.length + 1} 位的表側經驗（最前面的最先被蓋）`, rest, 1, 1);
            order_.push(pick);
            rest.splice(rest.indexOf(pick), 1);
          }
          order_.push(...rest);
          const slots = exp.map((card, i) => (card.covered ? -1 : i)).filter((i) => i >= 0);
          order_.forEach((card, k) => {
            exp[slots[k]] = card;
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
    ],
  },
});

// 交涉（商人）：[發_蓋X] 抽X，再將 X 張手牌放到牌組底。X 最大為 3
export const 交涉 = defineSource({
  id: '交涉',
  at: 'combat',
  on: {
    onPlay: (c) => c.effect(
      { label: '【交涉】蓋 X 張經驗，抽 X，再放 X 張手牌到牌組底', when: () => canPay(c.g, c.p, { cover: 1 }) },
      function* () {
        const { g, p } = c;
        const x = yield* chooseX(g, p, c.self!, 3, '蓋 X 張經驗，抽 X，再放 X 張手牌到牌組底');
        if (x === 0) return;
        activate(g, p, c.self!);
        yield* pay(g, p, { cover: x });
        yield* draw(g, p, x);
        const put = yield* chooseCards(g, p, `【交涉】選擇 ${x} 張手牌放到牌組底`, Z(g, p, 'hand'), x, x);
        for (const card of put) move(g, card, 'deck', 'bottom');
        log(g, `【交涉】抽 ${x}，並將 ${put.length} 張手牌放到牌組底`);
      },
    ),
  },
});

// 即時停損（商人）：[發_蓋4] 此卡打出後雙方立即收招
export const 即時停損 = defineSource({
  id: '即時停損',
  at: 'combat',
  on: {
    onPlay: (c) => c.effect({ label: '【即時停損】雙方立即收招（蓋4）', cost: { cover: 4 } }, () => {
      c.g.state.passed = [true, true];
      log(c.g, '【即時停損】雙方立即收招');
    }),
  },
});

// 高利貸（商人）：[發] 對方蓋X。X = 對方帶 [經] 的表側經驗張數
export const 高利貸 = defineSource({
  id: '高利貸',
  at: 'combat',
  on: {
    onPlay: (c) => {
      const foe = other(c.p);
      const count = () => faceUpExp(c.g, foe).filter((card) => hasExpEffect(card.id)).length;
      return c.effect({ label: '【高利貸】對方蓋X', mandatory: true, when: () => count() > 0 }, function* () {
        const x = count();
        activate(c.g, c.p, c.self!);
        log(c.g, `【高利貸】${pname(c.g, foe)} 的表側經驗中有 ${x} 張帶 [經]，強制蓋 ${x}`);
        yield* pay(c.g, foe, { cover: x });
      });
    },
  },
});

/** 蓋反應：強制，自己錄發動與步驟影格，所以結算完不再補錄 */
const coverReaction = (id: string, text: string, react: (g: GameCtx, p: PlayerId) => Gen | void) =>
  defineSource({
    id,
    at: 'exp',
    on: {
      onCovered: (c) => c.effect({ label: `【${id}】被蓋成裏側：${text}`, mandatory: true, mark: false }, function* () {
        log(c.g, `【${data(c.self!).name}】被蓋成裏側`);
        activate(c.g, c.p, c.self!, `【${data(c.self!).name}】被蓋成裏側，效果發動`);
        const r = react(c.g, c.p);
        if (r) yield* r;
        settle(c.g);
      }),
    },
  });

// 低價買進（商人）：[經] 此卡被蓋成裏側時，回復 3
export const 低價買進 = coverReaction('低價買進', '回復 3', (g, p) => void recover(g, p, 3));
// 高價賣出（商人）：[經] 此卡被蓋成裏側時，抽 1
export const 高價賣出 = coverReaction('高價賣出', '抽 1', function* (g, p) {
  yield* draw(g, p, 1);
});

export const MERCHANT_SOURCES = [招財貓, 商人, 交涉, 即時停損, 高利貸, 低價買進, 高價賣出];
