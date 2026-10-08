import { defineSource } from '../effectKit';
import { directHit, isFirst, log, pname } from '../ops';

// Ex卡-中毒：[經] 當我方後攻的回合開始時，直擊我方 3，強制
export const Ex卡中毒 = defineSource({
  id: 'Ex卡-中毒',
  at: 'exp',
  on: {
    turnStart: (c) => {
      if (isFirst(c.g, c.p)) return null;
      return {
        label: '【中毒】直擊 3',
        mandatory: true,
        available: () => c.here(),
        *run() {
          log(c.g, `【中毒】${pname(c.g, c.p)} 的後攻回合開始`);
          directHit(c.g, c.p, 3);
        },
      };
    },
  },
});

export const COMMON_SOURCES = [Ex卡中毒];
