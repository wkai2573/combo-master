import { defineSource } from '../effectKit';
import { directHit, log, pname } from '../ops';

// Ex-中毒：[經] 當回合開始時，直擊我方 1，強制
export const Ex中毒 = defineSource({
  id: 'Ex-中毒',
  at: 'exp',
  on: {
    turnStart: (c) => ({
      label: '【中毒】直擊 1',
      card: c.self ?? undefined,
      mandatory: true,
      available: () => c.here(),
      *run() {
        log(c.g, `【中毒】${pname(c.g, c.p)} 的回合開始`);
        directHit(c.g, c.p, 1);
      },
    }),
  },
});

// Ex-流血：[經] 我方總防禦 −1
export const Ex流血 = defineSource({
  id: 'Ex-流血',
  at: 'exp',
  ask: { flatDef: () => -1 },
});

export const COMMON_SOURCES = [Ex中毒, Ex流血];
