import { faceUpExp } from '../cost';
import { defineSource } from '../effectKit';
import { awakened, chooseCards, confirm, data, draw, log, move, pname, Z } from '../ops';
import type { CardInst } from '../types';

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

export const MERCHANT_SOURCES = [招財貓, 商人];
