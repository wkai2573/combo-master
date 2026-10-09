import { defineSource, lasting, slot } from '../effectKit';
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
      group: 'Ex-中毒', // 好幾張中毒的結算順序無關，窗口併成一個選項
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

// ───────────────────────── 共用裝備 ─────────────────────────

/** 布甲這回合給的總防禦加成 */
export const 布甲狀態 = slot('布甲', () => ({ def: 0 }));

// 布甲（id 皮甲，共用防具）：[蓋1] 當我方收招時，總防禦 +1。加成只在這回合
export const 布甲 = defineSource({
  id: '皮甲',
  at: 'gear',
  on: {
    onPass: (c) => c.effect({ label: '【布甲】此回合總防禦 +1（蓋1）', cost: { cover: 1 } }, () => {
      布甲狀態.of(c.g, c.p).def += 1;
      log(c.g, `【布甲】${pname(c.g, c.p)} 此回合總防禦 +1`);
    }),
  },
  ask: { flatDef: lasting((c) => 布甲狀態.read(c.g, c.p).def) },
});

/** 木棍這回合給的總攻擊加成 */
export const 木棍狀態 = slot('木棍', () => ({ atk: 0 }));

// 木棍（共用武器）：[蓋1] 當我方收招時，總攻擊 +1。加成只在這回合
export const 木棍 = defineSource({
  id: '木棍',
  at: 'gear',
  on: {
    onPass: (c) => c.effect({ label: '【木棍】此回合總攻擊 +1（蓋1）', cost: { cover: 1 } }, () => {
      木棍狀態.of(c.g, c.p).atk += 1;
      log(c.g, `【木棍】${pname(c.g, c.p)} 此回合總攻擊 +1`);
    }),
  },
  ask: { flatAtk: lasting((c) => 木棍狀態.read(c.g, c.p).atk) },
});

export const COMMON_SOURCES = [Ex中毒, Ex流血, 布甲, 木棍];
