import { canPay, chooseX, pay } from '../cost';
import { defineSource, lasting, slot } from '../effectKit';
import { activate, awakened, chooseCards, data, discard, draw, isFirst, log, newCard, pname, Z } from '../ops';
import { other } from '../types';

/** 刺客「追擊判定成功」加成的總上限 */
export const ASSASSIN_CAP = 5;

// ───────────────────────── 卡片 ─────────────────────────

/** 伏擊給的這回合總攻擊加成 */
export const 伏擊狀態 = slot('伏擊', () => ({ atk: 0 }));

// 伏擊（盜賊）：[先] 此回合我方總攻擊 +4
export const 伏擊 = defineSource({
  id: '伏擊',
  at: 'moves',
  on: {
    onOpen: (c) => c.effect({ label: '【伏擊】此回合總攻擊 +4', mandatory: true }, () => {
      activate(c.g, c.p, c.self!);
      伏擊狀態.of(c.g, c.p).atk += 4;
      log(c.g, '【伏擊】此回合總攻擊 +4');
    }),
  },
  ask: { flatAtk: lasting((c) => 伏擊狀態.read(c.g, c.p).atk) },
});

/** 順手牽羊給的這回合總防禦加成，是負數 */
export const 順手牽羊狀態 = slot('順手牽羊', () => ({ def: 0 }));

// 順手牽羊（盜賊）：[發_蓋X] 抽X，此回合我方總防禦 -X。X 最大為 2
export const 順手牽羊 = defineSource({
  id: '順手牽羊',
  at: 'moves',
  on: {
    onPlay: (c) => c.effect(
      { label: '【順手牽羊】蓋 X 張經驗，抽 X，此回合總防禦 −X', when: () => canPay(c.g, c.p, { cover: 1 }) },
      function* () {
        const x = yield* chooseX(c.g, c.p, c.self!, 2, '蓋 X 張經驗，抽 X，此回合總防禦 −X');
        if (x === 0) return;
        activate(c.g, c.p, c.self!);
        yield* pay(c.g, c.p, { cover: x });
        yield* draw(c.g, c.p, x);
        順手牽羊狀態.of(c.g, c.p).def -= x;
        log(c.g, `【順手牽羊】抽 ${x}，此回合總防禦 −${x}`);
      },
    ),
  },
  ask: { flatDef: lasting((c) => 順手牽羊狀態.read(c.g, c.p).def) },
});

// 卸除鎧甲（盜賊）：[發_蓋2] 選擇對方 1 張裝備或增益卡，送入棄牌區
export const 卸除鎧甲 = defineSource({
  id: '卸除鎧甲',
  at: 'moves',
  on: {
    onPlay: (c) => {
      const targets = () => [...Z(c.g, other(c.p), 'gear'), ...Z(c.g, other(c.p), 'buff')];
      return c.effect(
        { label: '【卸除鎧甲】對方 1 張裝備或增益卡送入棄牌區（蓋2）', cost: { cover: 2 }, when: () => targets().length > 0 },
        function* () {
          const [t] = yield* chooseCards(c.g, c.p, '【卸除鎧甲】選擇對方 1 張裝備或增益卡送入棄牌區', targets(), 1, 1);
          if (t) {
            discard(c.g, t);
            log(c.g, `【卸除鎧甲】對方的【${data(t).name}】送入棄牌區`);
          }
        },
      );
    },
  },
});

/** 塗毒在這回合被發動的次數；歸還時依此放出中毒 */
export const 塗毒狀態 = slot('塗毒', () => ({ armed: 0 }));

// 塗毒（盜賊）：[先_蓋1] 歸還時，將 [Ex卡-中毒] 移入出招卡較少那方的經驗區，相同時落入對方
export const 塗毒 = defineSource({
  id: '塗毒',
  at: 'moves',
  on: {
    onOpen: (c) => c.effect({ label: '【塗毒】歸還時，Ex卡-中毒移入經驗區（蓋1）', cost: { cover: 1 } }, () => {
      塗毒狀態.of(c.g, c.p).armed++;
      log(c.g, '【塗毒】歸還時，[Ex卡-中毒]將移入經驗區');
    }),
    // 歸還時卡已經離開戰鬥區，所以要明寫 lasting；是否發動看塗毒留下的記號
    afterReturn: lasting((c) => Array.from({ length: 塗毒狀態.read(c.g, c.p).armed }, () =>
      // 歸還的影格已經涵蓋這張卡的出現，所以不另外補錄
      c.effect({ label: '【塗毒】Ex卡-中毒移入經驗區', mandatory: true, mark: false }, () => {
        塗毒狀態.of(c.g, c.p).armed--;
        const f = c.g.state.flags;
        const mine = f.played[c.p];
        const theirs = f.played[other(c.p)];
        const target = mine < theirs ? c.p : other(c.p);
        newCard(c.g, 'Ex卡-中毒', target, 'exp');
        log(c.g, `【塗毒】[Ex卡-中毒]移入${pname(c.g, target)}的經驗區`);
      }))),
  },
});

/** 幸運兔腳這回合是否已經發動過 */
export const 幸運兔腳狀態 = slot('幸運兔腳', () => ({ used: false }));

// 幸運兔腳（盜賊）：[蓋2] 追擊判定失敗時，額外翻 1 張卡做追擊判定，每回合 1 次
export const 幸運兔腳 = defineSource({
  id: '幸運兔腳',
  at: 'gear',
  on: {
    afterPursuitFail: (c) => c.effect(
      {
        label: '【幸運兔腳】額外翻 1 張卡做追擊判定（蓋2）',
        cost: { cover: 2 },
        mark: false, // 額外判定自己會錄影格
        when: () => !幸運兔腳狀態.read(c.g, c.p).used && Z(c.g, c.p, 'deck').length > 0,
      },
      function* () {
        幸運兔腳狀態.of(c.g, c.p).used = true;
        log(c.g, `【${data(c.self!).name}】額外翻 1 張卡做追擊判定`);
        yield* c.flipExtra();
      },
    ),
  },
});

// 二刀連擊（盜賊）：[頂] 招式卡疊只有此卡時，追擊 +1（追擊卡疊不算）
export const 二刀連擊 = defineSource({
  id: '二刀連擊',
  at: 'moves',
  ask: { pursuitBonus: (c) => (Z(c.g, c.p, 'moves').length === 1 ? 1 : 0) },
});

// ───────────────────────── 角色 ─────────────────────────

// 刺客：追擊判定成功的次數加成總攻擊，覺醒時加倍，上限 ASSASSIN_CAP
export const 刺客 = defineSource({
  id: '刺客',
  at: 'char',
  ask: {
    combatBonus: (c) => {
      const mult = awakened(c.g, c.p) ? 2 : 1;
      return { atk: Math.min(ASSASSIN_CAP, mult * c.g.state.flags.pursuitSuccess[c.p]) };
    },
  },
});

// 先人：先攻回合總攻擊 +（出招張數 − 1）；覺醒時先攻回合追擊 +1
export const 先人 = defineSource({
  id: '先人',
  at: 'char',
  ask: {
    combatBonus: (c) => (isFirst(c.g, c.p) ? { atk: Math.max(0, c.g.state.flags.played[c.p] - 1) } : {}),
    pursuitBonus: (c) => (awakened(c.g, c.p) && isFirst(c.g, c.p) ? 1 : 0),
  },
});

export const THIEF_SOURCES = [伏擊, 順手牽羊, 卸除鎧甲, 塗毒, 幸運兔腳, 二刀連擊, 刺客, 先人];
