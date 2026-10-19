import { defineSource, lasting, slot } from '../effectKit';
import { isClassCard } from '../../data/enabledCards';
import { awakened, chooseCards, data, directHit, log, move, pname, recover, Z } from '../ops';

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

// 布甲（共用防具）：[蓋1] 當我方收招時，+0+1。加成只在這回合
export const 布甲 = defineSource({
  id: '布甲',
  at: 'gear',
  on: {
    onPass: (c) => c.effect({ label: '【布甲】此回合 +0+1（蓋1）', cost: { cover: 1 } }, () => {
      布甲狀態.of(c.g, c.p).def += 1;
      log(c.g, `【布甲】${pname(c.g, c.p)} 此回合 +0+1`);
    }),
  },
  ask: { flatDef: lasting((c) => 布甲狀態.read(c.g, c.p).def) },
});

/** 木棍這回合給的總攻擊加成 */
export const 木棍狀態 = slot('木棍', () => ({ atk: 0 }));

// 木棍（共用武器）：[蓋1] 當我方收招時，+1+0。加成只在這回合
export const 木棍 = defineSource({
  id: '木棍',
  at: 'gear',
  on: {
    onPass: (c) => c.effect({ label: '【木棍】此回合 +1+0（蓋1）', cost: { cover: 1 } }, () => {
      木棍狀態.of(c.g, c.p).atk += 1;
      log(c.g, `【木棍】${pname(c.g, c.p)} 此回合 +1+0`);
    }),
  },
  ask: { flatAtk: lasting((c) => 木棍狀態.read(c.g, c.p).atk) },
});

// 生命藥水（共用招式）：[發_蓋3] 回復 3
export const 生命藥水 = defineSource({
  id: '生命藥水',
  at: 'moves',
  on: {
    onPlay: (c) => c.effect({ label: '【生命藥水】回復 3（蓋3）', cost: { cover: 3 } }, () => {
      recover(c.g, c.p, 3);
      log(c.g, `【生命藥水】${pname(c.g, c.p)} 回復 3`);
    }),
  },
});

// 職業專精書（共用招式）：[發_蓋1] 看牌組上方 5 張卡，選擇其中 1 張職業卡加入手牌，其餘隨機放到牌組底
// 加入手牌的卡來自牌組，所以生命值少 1；上方沒有職業卡時 5 張全部放到牌組底
export const 職業專精書 = defineSource({
  id: '職業專精書',
  at: 'moves',
  on: {
    onPlay: (c) => c.effect({ label: '【職業專精書】看牌組上方 5 張，選 1 張職業卡加入手牌（蓋1）', cost: { cover: 1 } }, function* () {
      const { g, p } = c;
      const seen = Z(g, p, 'deck').slice(0, 5);
      const classCards = seen.filter((card) => isClassCard(data(card)));
      const looked = `【職業專精書】看到：${seen.map((card) => data(card).name).join('、')}`;
      // 沒有職業卡時開一個什麼都不能選的提示，讓玩家看得到這幾張牌（按略過繼續）
      const [pick] = classCards.length > 0
        ? yield* chooseCards(g, p, `${looked}。選擇 1 張職業卡加入手牌`, classCards, 1, 1)
        : yield* chooseCards(g, p, `${looked}。沒有職業卡，全部隨機放到牌組底`, seen, 0, 0);
      if (pick) move(g, pick, 'hand');
      const rest = g.rng.shuffle(seen.filter((card) => card !== pick));
      for (const card of rest) move(g, card, 'deck', 'bottom');
      log(g, pick
        ? `【職業專精書】${pname(g, p)} 看牌組上方 ${seen.length} 張，將職業卡加入手牌，其餘放到牌組底`
        : `【職業專精書】${pname(g, p)} 看牌組上方 ${seen.length} 張，沒有職業卡，全部放到牌組底`);
    }),
  },
});

// 修行者（教學專用角色）：覺醒中（追加）我方總攻擊 +2。數值加成，不是事件型，不彈提示
export const 修行者 = defineSource({
  id: '修行者',
  at: 'char',
  ask: { combatBonus: (c) => ({ atk: awakened(c.g, c.p) ? 2 : 0 }) },
});

export const COMMON_SOURCES = [Ex中毒, Ex流血, 布甲, 木棍, 生命藥水, 職業專精書, 修行者];
