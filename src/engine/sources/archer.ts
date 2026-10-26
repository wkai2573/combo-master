import { parseCardText } from '../../data/cardText';
import { defineSource, lasting, slot } from '../effectKit';
import { activate, awakened, chooseCards, data, discard, draw, log, move, pname, recover, topOfZone, Z, type GameCtx } from '../ops';
import type { CardInst, PlayerId } from '../types';

// 遊俠：當我方覺醒時，可以抽 2；瞄準上限 1，覺醒時 2
export const 遊俠 = defineSource({
  id: '遊俠',
  at: 'char',
  on: {
    onAwaken: (c) => c.effect(
      { label: '【遊俠】覺醒：抽 2', confirm: '【遊俠】覺醒：要抽 2 張嗎？' },
      function* () {
        yield* draw(c.g, c.p, 2);
        log(c.g, `【遊俠】${pname(c.g, c.p)} 覺醒時抽 2`);
      },
    ),
  },
  ask: { aimLimit: (c) => (awakened(c.g, c.p) ? 2 : 1) },
});

// 瞄準器（弓箭手）：裝備，瞄準上限 +1
export const 瞄準器 = defineSource({
  id: '瞄準器',
  at: 'gear',
  ask: { aimLimit: () => 1 },
});

/** 二連矢讓這回合追擊增加的次數 */
export const 二連矢狀態 = slot('二連矢', () => ({ plus: 0 }));

// 二連矢（弓箭手）：[追] 追擊 +1
export const 二連矢 = defineSource({
  id: '二連矢',
  at: 'pursuit',
  on: {
    onPursuitCard: (c) => c.effect({ label: '【二連矢】追擊 +1', mandatory: true, mark: false }, () => {
      activate(c.g, c.p, c.self!);
      二連矢狀態.of(c.g, c.p).plus++;
      log(c.g, '【二連矢】追擊+1');
    }),
  },
  // 追擊 +1 要算到整個追擊階段結束，這時卡早就離開了追擊區
  ask: { pursuitBonus: lasting((c) => 二連矢狀態.read(c.g, c.p).plus) },
});

// 狙擊蓄力（弓箭手）：[發_蓋4] 抽2，再選擇 1 張手牌放到牌組頂
export const 狙擊蓄力 = defineSource({
  id: '狙擊蓄力',
  at: 'moves',
  on: {
    onPlay: (c) => c.effect({ label: '【狙擊蓄力】抽 2，再放 1 張手牌到牌組頂（蓋4）', cost: { cover: 4 } }, function* () {
      yield* draw(c.g, c.p, 2);
      const [card] = yield* chooseCards(c.g, c.p, '【狙擊蓄力】選擇 1 張手牌放到牌組頂', Z(c.g, c.p, 'hand'), 1, 1);
      if (card) {
        move(c.g, card, 'deck', 'top');
        log(c.g, `【狙擊蓄力】${pname(c.g, c.p)} 抽 2，並將 1 張手牌放到牌組頂`);
      }
    }),
  },
});

/** 狙擊印記讓這回合瞄準升級的次數 */
export const 狙擊印記狀態 = slot('狙擊印記', () => ({ up: 0 }));

// 狙擊印記（弓箭手）：[先] 此回合我方的瞄準升級 1
export const 狙擊印記 = defineSource({
  id: '狙擊印記',
  at: 'moves',
  on: {
    onOpen: (c) => c.effect({ label: '【狙擊印記】此回合瞄準升級 1', mandatory: true }, () => {
      狙擊印記狀態.of(c.g, c.p).up++;
      log(c.g, '【狙擊印記】此回合瞄準升級 1');
    }),
  },
  ask: { aimLevel: lasting((c) => 狙擊印記狀態.read(c.g, c.p).up) },
});

// 魅影射擊（弓箭手）：[追] 作為追擊卡時防禦力也計入總防禦
export const 魅影射擊 = defineSource({ id: '魅影射擊', at: 'pursuit', asMove: { pursuitDef: 4 } });

// 地雷陷阱（弓箭手）：[追] 我方 +4+0
export const 地雷陷阱 = defineSource({ id: '地雷陷阱', at: 'pursuit', asMove: { pursuitAtk: 4 } });

// 生命偷取（弓箭手）：[頂] 當我方追擊判定成功時，回復 2
export const 生命偷取 = defineSource({
  id: '生命偷取',
  at: 'moves',
  on: {
    onPursuitSuccess: (c) => c.effect(
      { label: '【生命偷取】回復 2', mandatory: true, when: () => topOfZone(c.g, c.p) === c.self },
      () => {
        activate(c.g, c.p, c.self!);
        recover(c.g, c.p, 2);
        log(c.g, `【生命偷取】${pname(c.g, c.p)} 追擊判定成功，回復 2`);
      },
    ),
  },
});

// 追跡箭矢（弓箭手）：此卡追擊判定必定成功；[發_蓋2] 抽1；[追] 抽1
export const 追跡箭矢 = defineSource({
  id: '追跡箭矢',
  at: 'moves',
  asMove: { pursuitSucceeds: true },
  on: {
    onPlay: (c) => c.effect({ label: '【追跡箭矢】抽 1（蓋2）', cost: { cover: 2 } }, function* () {
      yield* draw(c.g, c.p, 1);
      log(c.g, `【追跡箭矢】${pname(c.g, c.p)} 打出時抽 1`);
    }),
    onPursuitCard: (c) => c.effect({ label: '【追跡箭矢】抽 1', mandatory: true, mark: false }, function* () {
      activate(c.g, c.p, c.self!);
      yield* draw(c.g, c.p, 1);
      log(c.g, `【追跡箭矢】${pname(c.g, c.p)} 成為追擊卡時抽 1`);
    }),
  },
});

/** 這張卡有沒有 [追] 效果：只看卡文每一行開頭的標籤，卡文中提到「[追] 效果」的說明不算 */
export const hasPursuitEffect = (card: CardInst): boolean => parseCardText(data(card).text).some((l) => l.tags.includes('追'));

/** 箭雨讓這回合追擊增加的次數 */
export const 箭雨狀態 = slot('箭雨', () => ({ plus: 0 }));

/** 手中持有 [追] 效果的卡 */
const handPursuitCards = (g: GameCtx, p: PlayerId) => Z(g, p, 'hand').filter(hasPursuitEffect);

// 箭雨（弓箭手）：[頂] 當我方追擊判定成功時，可以捨棄手中 2 張持有 [追] 效果的卡，若如此，追擊+1。
// 沒有每回合次數限制：手牌夠，每次追擊判定成功都能發動。追擊+1 要算到整個追擊階段結束，所以用狀態槽
export const 箭雨 = defineSource({
  id: '箭雨',
  at: 'moves',
  on: {
    onPursuitSuccess: (c) => c.effect(
      {
        label: '【箭雨】捨棄手中 2 張持有 [追] 效果的卡，追擊+1',
        confirm: '【箭雨】要捨棄手中 2 張持有 [追] 效果的卡，使追擊+1 嗎？',
        when: () => topOfZone(c.g, c.p) === c.self && handPursuitCards(c.g, c.p).length >= 2,
      },
      function* () {
        const { g, p } = c;
        activate(g, p, c.self!);
        const dropped = yield* chooseCards(g, p, '【箭雨】選擇手中 2 張持有 [追] 效果的卡捨棄', handPursuitCards(g, p), 2, 2);
        for (const card of dropped) discard(g, card);
        箭雨狀態.of(g, p).plus++;
        log(g, `【箭雨】${pname(g, p)} 捨棄 ${dropped.map((card) => `【${data(card).name}】`).join('')}，追擊+1`);
      },
    ),
  },
  ask: { pursuitBonus: lasting((c) => 箭雨狀態.read(c.g, c.p).plus) },
});

/** 天譴之箭這回合給的總攻擊加成 */
export const 天譴之箭狀態 = slot('天譴之箭', () => ({ atk: 0 }));

// 天譴之箭（弓箭手）：[先_怒5] 我方 +X+0，X＝此卡費用捨棄的卡中，有 [追] 效果的張數。加成只在這回合
// 怒氣區的牌面不公開：費用捨棄的 5 張進了棄牌區之後才公開，所以到這時才數張數。
// 付費時剛捨棄的 5 張就是棄牌區最後的 5 張（捨棄一律加在棄牌區最後面，付費到效果之間沒有別的捨棄）
export const 天譴之箭 = defineSource({
  id: '天譴之箭',
  at: 'moves',
  on: {
    onOpen: (c) => c.effect({ label: '【天譴之箭】此回合 +X+0，X＝捨棄的怒氣中持有 [追] 效果的卡片張數（怒5）', cost: { rage: 5 } }, () => {
      const { g, p } = c;
      const paid = Z(g, p, 'discard').slice(-5);
      const x = paid.filter(hasPursuitEffect).length;
      天譴之箭狀態.of(g, p).atk += x;
      log(g, `【天譴之箭】${pname(g, p)} 捨棄的 5 張怒氣中有 ${x} 張持有 [追] 效果：${paid.map((card) => `【${data(card).name}】`).join('')}，此回合 +${x}+0`);
    }),
  },
  ask: { flatAtk: lasting((c) => 天譴之箭狀態.read(c.g, c.p).atk) },
});

// 穿雲箭（弓箭手）：[發_蓋2] 我方翻開牌組頂 1 張卡做追擊判定。
// 打出當下用標準規則判定一次（不是進入追擊階段）：先手步驟對方沒有招式，所有連擊值都在範圍內，必定失敗，翻到的牌加入手牌；
// 成功就成為追擊卡。判定自己會錄影格，所以結算完不再補錄；追擊階段另外照常判定
export const 穿雲箭 = defineSource({
  id: '穿雲箭',
  at: 'moves',
  on: {
    onPlay: (c) => c.effect(
      { label: '【穿雲箭】翻開牌組頂 1 張卡做追擊判定（蓋2）', cost: { cover: 2 }, mark: false, when: () => Z(c.g, c.p, 'deck').length > 0 },
      function* () {
        log(c.g, `【穿雲箭】${pname(c.g, c.p)} 翻開牌組頂 1 張卡做追擊判定`);
        yield* c.judgeTop();
      },
    ),
  },
});

export const ARCHER_SOURCES = [遊俠, 瞄準器, 二連矢, 狙擊蓄力, 狙擊印記, 魅影射擊, 地雷陷阱, 生命偷取, 追跡箭矢, 箭雨, 天譴之箭, 穿雲箭];
