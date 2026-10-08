import { defineSource } from '../effectKit';
import { data, draw, log, recover, Z } from '../ops';

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

export const MAGE_SOURCES = [冰與雷之曲];
