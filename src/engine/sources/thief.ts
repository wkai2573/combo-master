import { canPay, chooseX, pay } from '../cost';
import { defineSource, lasting, slot } from '../effectKit';
import { isExCardId } from '../../data/exCards';
import { activate, awakened, chooseCards, combatZone, data, discard, draw, isFirst, log, move, newCard, placeExInBuff, pname, topOfZone, Z, type GameCtx } from '../ops';
import { other, type PlayerId } from '../types';

// ───────────────────────── 卡片 ─────────────────────────

/** 伏擊給的這回合總攻擊加成 */
export const 伏擊狀態 = slot('伏擊', () => ({ atk: 0 }));

// 伏擊（盜賊）：[先] 此回合我方 +4+0
export const 伏擊 = defineSource({
  id: '伏擊',
  at: 'moves',
  on: {
    onOpen: (c) => c.effect({ label: '【伏擊】此回合 +4+0', mandatory: true }, () => {
      activate(c.g, c.p, c.self!);
      伏擊狀態.of(c.g, c.p).atk += 4;
      log(c.g, '【伏擊】此回合 +4+0');
    }),
  },
  ask: { flatAtk: lasting((c) => 伏擊狀態.read(c.g, c.p).atk) },
});

/** 順手牽羊給的這回合總防禦加成，是負數 */
export const 順手牽羊狀態 = slot('順手牽羊', () => ({ def: 0 }));

// 順手牽羊（盜賊）：[發_蓋X] 抽X，此回合我方 +0−X。X 最大為 2
export const 順手牽羊 = defineSource({
  id: '順手牽羊',
  at: 'moves',
  on: {
    onPlay: (c) => c.effect(
      { label: '【順手牽羊】蓋 X 張經驗，抽 X，此回合 +0−X', when: () => canPay(c.g, c.p, { cover: 1 }) },
      function* () {
        const x = yield* chooseX(c.g, c.p, c.self!, 2, '蓋 X 張經驗，抽 X，此回合 +0−X');
        if (x === 0) return;
        activate(c.g, c.p, c.self!);
        yield* pay(c.g, c.p, { cover: x });
        yield* draw(c.g, c.p, x);
        順手牽羊狀態.of(c.g, c.p).def -= x;
        log(c.g, `【順手牽羊】抽 ${x}，此回合 +0−${x}`);
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
      // 增益區裡的 Ex 卡（Ex-狂怒）是效果放進去的，不是增益卡，不能選
      const targets = () => [...Z(c.g, other(c.p), 'gear'), ...Z(c.g, other(c.p), 'buff').filter((x) => !isExCardId(x.id))];
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

// 塗毒（盜賊）：[發_蓋2] 當歸還時，將 [Ex-中毒] 移入對方的經驗區
export const 塗毒 = defineSource({
  id: '塗毒',
  at: 'moves',
  on: {
    onPlay: (c) => c.effect({ label: '【塗毒】歸還時，Ex-中毒移入對方的經驗區（蓋2）', cost: { cover: 2 } }, () => {
      塗毒狀態.of(c.g, c.p).armed++;
      log(c.g, '【塗毒】歸還時，[Ex-中毒]將移入對方的經驗區');
    }),
    // 歸還時卡已經離開戰鬥區，所以要明寫 lasting；是否發動看塗毒留下的記號
    afterReturn: lasting((c) => Array.from({ length: 塗毒狀態.read(c.g, c.p).armed }, () =>
      // 歸還的影格已經涵蓋這張卡的出現，所以不另外補錄
      c.effect({ label: '【塗毒】Ex-中毒移入對方的經驗區', mandatory: true, mark: false }, () => {
        塗毒狀態.of(c.g, c.p).armed--;
        const target = other(c.p);
        newCard(c.g, 'Ex-中毒', target, 'exp');
        log(c.g, `【塗毒】[Ex-中毒]移入${pname(c.g, target)}的經驗區`);
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

// 二刀連擊（盜賊）：[頂] 追擊 +1，只有在招式卡疊最上方時才算
export const 二刀連擊 = defineSource({
  id: '二刀連擊',
  at: 'moves',
  ask: { pursuitBonus: (c) => (topOfZone(c.g, c.p) === c.self ? 1 : 0) },
});

/** 我方增益區目前的 Ex-狂怒 張數 */
export const exRageCount = (g: GameCtx, p: PlayerId): number => Z(g, p, 'buff').filter((c) => c.id === 'Ex-狂怒').length;

// 狂怒（盜賊）：
//   [發_蓋2] 將 1 張 [Ex-狂怒] 放入我方增益區（放入時，增益區裡所有 Ex-狂怒 的持續時間指示物歸零重算）
//   [頂] 我方 +2X+0。X＝我方增益區的 [Ex-狂怒] 數量；只有位於招式卡疊最上方時才算
export const 狂怒 = defineSource({
  id: '狂怒',
  at: 'moves',
  on: {
    onPlay: (c) => c.effect({ label: '【狂怒】將 1 張 Ex-狂怒 放入增益區（蓋2）', cost: { cover: 2 } }, () => {
      placeExInBuff(c.g, c.p, 'Ex-狂怒');
      log(c.g, `【狂怒】${pname(c.g, c.p)} 將 [Ex-狂怒] 放入增益區，Ex-狂怒的持續時間重新計算`);
    }),
  },
  ask: { flatAtk: (c) => (topOfZone(c.g, c.p) === c.self ? 2 * exRageCount(c.g, c.p) : 0) },
});

// Ex-狂怒：持續回合 2，放在增益區。計時（增益階段開始 +1、到期移除遊戲）與放置時重設指示物都是引擎對增益區 Ex 卡的通則，
// 效果由狂怒的 [頂] 讀它的張數；這個條目登記它待在增益區，讓卡表同步與文字檢查知道要寫「離開增益區」
export const Ex狂怒 = defineSource({ id: 'Ex-狂怒', at: 'buff' });

/** 手中特徵為「毒」或「藥水」任一的卡 */
const poisonHand = (g: GameCtx, p: PlayerId) => Z(g, p, 'hand').filter((card) => data(card).traits.some((t) => t === '毒' || t === '藥水'));

// 毒藥（盜賊）：[發_蓋X] 捨棄手中 X 張特徵「毒」或「藥水」的卡，將 X 張 [Ex-中毒] 放入對方經驗區。X 最大為 3
// X 在付費用時決定，蓋 X 與捨棄 X 是同一個值，不超過手中符合特徵的張數與我能蓋的張數；手中沒有符合特徵的卡就不能發動。
// 先蓋 X（蓋反應可能改動手牌），再從手牌選要捨棄的卡
export const 毒藥 = defineSource({
  id: '毒藥',
  at: 'moves',
  on: {
    onPlay: (c) => c.effect(
      { label: '【毒藥】蓋 X 張經驗，捨棄 X 張毒或藥水手牌，將 X 張 Ex-中毒放入對方經驗區', when: () => canPay(c.g, c.p, { cover: 1 }) && poisonHand(c.g, c.p).length > 0 },
      function* () {
        const { g, p } = c;
        const x = yield* chooseX(g, p, c.self!, Math.min(3, poisonHand(g, p).length), '蓋 X 張經驗，捨棄 X 張毒或藥水的手牌，將 X 張 Ex-中毒放入對方經驗區');
        if (x === 0) return;
        activate(g, p, c.self!);
        yield* pay(g, p, { cover: x });
        const pool = poisonHand(g, p);
        const n = Math.min(x, pool.length);
        const dropped = yield* chooseCards(g, p, `【毒藥】選擇 ${n} 張特徵「毒」或「藥水」的手牌捨棄`, pool, n, n);
        for (const card of dropped) discard(g, card);
        const foe = other(p);
        for (let i = 0; i < dropped.length; i++) newCard(g, 'Ex-中毒', foe, 'exp');
        log(g, `【毒藥】${pname(g, p)} 捨棄 ${dropped.map((card) => `【${data(card).name}】`).join('')}，[Ex-中毒] ×${dropped.length} 放入${pname(g, foe)}的經驗區`);
      },
    ),
  },
});

// 煙霧陷阱（盜賊）：[頂] 當對方出招時，將此卡放到我方招式疊最下方。強制；位於最上方才觸發。
// 只改疊的順序：其餘規則照疊的最新狀態算，新的最上方卡的頂部效果接手，歸還時也依新的疊序進入經驗區。
// 疊裡只有它一張時它本來就在最下方，不必也沒有東西可動，不發動
export const 煙霧陷阱 = defineSource({
  id: '煙霧陷阱',
  at: 'moves',
  on: {
    onFoePlay: (c) => c.effect(
      { label: '【煙霧陷阱】將此卡放到我方招式疊最下方', mandatory: true, when: () => topOfZone(c.g, c.p) === c.self && Z(c.g, c.p, 'moves').length >= 2 },
      () => {
        activate(c.g, c.p, c.self!);
        move(c.g, c.self!, 'moves', 'bottom');
        log(c.g, `【煙霧陷阱】${pname(c.g, c.p)} 的煙霧陷阱放到招式卡疊最下方`);
      },
    ),
  },
});

/** 冰凍陷阱這回合給的總防禦加成 */
export const 冰凍陷阱狀態 = slot('冰凍陷阱', () => ({ def: 0 }));

// 冰凍陷阱（盜賊）：[經_蓋3] 當對方出招時，且對方所出招式的連擊值＝我方招式疊最上方招式的連擊值，我方 +0+3。
// 觸發窗口出現時才選擇付不付蓋3，條件在窗口開啟時判斷；加成持續到本回合結束，存在狀態槽
export const 冰凍陷阱 = defineSource({
  id: '冰凍陷阱',
  at: 'exp',
  on: {
    onFoePlay: (c) => c.effect(
      {
        label: '【冰凍陷阱】此回合 +0+3（蓋3）',
        cost: { cover: 3 },
        when: () => {
          const top = topOfZone(c.g, c.p);
          return top !== undefined && data(top).combo === data(c.card).combo;
        },
      },
      () => {
        冰凍陷阱狀態.of(c.g, c.p).def += 3;
        log(c.g, `【冰凍陷阱】${pname(c.g, c.p)} 此回合 +0+3`);
      },
    ),
  },
  ask: { flatDef: lasting((c) => 冰凍陷阱狀態.read(c.g, c.p).def) },
});

// ───────────────────────── 角色 ─────────────────────────

/** 刺客兩段效果這回合各自用過了沒 */
export const 刺客狀態 = slot('刺客', () => ({ bleed: false, poison: false }));

// 刺客：(回合1次) 追擊成功時，將 1 張 [Ex-流血] 加入對方經驗區；覺醒（追加）(回合1次) 追擊成功時，再加 1 張 [Ex-中毒]。
// 兩段各自每回合 1 次，放在對方經驗區最後方，表側；同一次追擊成功時兩段都可用，仍是一個效果
export const 刺客 = defineSource({
  id: '刺客',
  at: 'char',
  on: {
    onPursuitSuccess: (c) => {
      const used = () => 刺客狀態.read(c.g, c.p);
      const bleedReady = () => !used().bleed;
      const poisonReady = () => awakened(c.g, c.p) && !used().poison;
      return c.effect({ label: '【刺客】追擊成功：Ex-流血加入對方經驗區', mandatory: true, when: () => bleedReady() || poisonReady() }, () => {
        const foe = other(c.p);
        const added: string[] = [];
        if (bleedReady()) {
          刺客狀態.of(c.g, c.p).bleed = true;
          newCard(c.g, 'Ex-流血', foe, 'exp');
          added.push('[Ex-流血]');
        }
        if (poisonReady()) {
          刺客狀態.of(c.g, c.p).poison = true;
          newCard(c.g, 'Ex-中毒', foe, 'exp');
          added.push('[Ex-中毒]');
        }
        log(c.g, `【刺客】追擊成功，${added.join('與')}加入${pname(c.g, foe)}的經驗區`);
      });
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

/** 狩獵印記這回合是否掛上了「對方收招時」的觸發 */
export const 狩獵印記狀態 = slot('狩獵印記', () => ({ armed: false }));

// 狩獵印記（盜賊）：[先] 當對方收招時，抽X。X＝3 − 對方戰鬥區的招式張數，最低為 0
// 只有作為先手步驟出的招才會掛上；掛上之後和這張卡還在不在戰鬥區無關（被替換後仍然生效）
export const 狩獵印記 = defineSource({
  id: '狩獵印記',
  at: 'moves',
  on: {
    onOpen: (c) => c.effect({ label: '【狩獵印記】這回合對方收招時抽牌', mandatory: true, mark: false }, () => {
      狩獵印記狀態.of(c.g, c.p).armed = true;
      log(c.g, '【狩獵印記】這回合對方收招時，將依對方戰鬥區的招式張數抽牌');
    }),
    onFoePass: lasting((c) => c.effect(
      { label: '【狩獵印記】抽 X（X＝3 − 對方戰鬥區的招式張數）', mandatory: true, when: () => 狩獵印記狀態.read(c.g, c.p).armed && 3 - combatZone(c.g, other(c.p)).length > 0 },
      function* () {
        狩獵印記狀態.of(c.g, c.p).armed = false;
        const x = Math.max(0, 3 - combatZone(c.g, other(c.p)).length);
        yield* draw(c.g, c.p, x);
        log(c.g, `【狩獵印記】對方收招，${pname(c.g, c.p)} 抽 ${x}`);
      },
    )),
  },
});

export const THIEF_SOURCES = [伏擊, 順手牽羊, 卸除鎧甲, 塗毒, 毒藥, 煙霧陷阱, 冰凍陷阱, 幸運兔腳, 二刀連擊, 狂怒, Ex狂怒, 刺客, 先人, 狩獵印記];
