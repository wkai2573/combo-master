import { defineSource, lasting, slot } from '../effectKit';
import { activate, awakened, chooseCards, draw, log, move, pname, recover, topOfZone, Z } from '../ops';

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

export const ARCHER_SOURCES = [遊俠, 瞄準器, 二連矢, 狙擊蓄力, 狙擊印記, 魅影射擊, 地雷陷阱, 生命偷取, 追跡箭矢];
