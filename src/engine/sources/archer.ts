import { defineSource } from '../effectKit';
import { activate, chooseCards, draw, log, move, pname, Z } from '../ops';

// 遊俠：當我方覺醒時，可以抽 2（獲得第二個瞄準是常駐效果，見 aimLimit）
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
});

// 二連矢（弓箭手）：[追] 追擊 +1
export const 二連矢 = defineSource({
  id: '二連矢',
  at: 'pursuit',
  on: {
    onPursuitCard: (c) => c.effect({ label: '【二連矢】追擊 +1', mandatory: true, mark: false }, () => {
      activate(c.g, c.p, c.self!);
      c.g.state.flags.pursuitPlus[c.p]++;
      log(c.g, '【二連矢】追擊+1');
    }),
  },
});

// 狙擊蓄力（弓箭手）：[發_蓋4] 抽2，再選擇 1 張手牌放到牌組頂
export const 狙擊蓄力 = defineSource({
  id: '狙擊蓄力',
  at: 'combat',
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

// 狙擊印記（弓箭手）：[先] 此回合我方的瞄準升級 1
export const 狙擊印記 = defineSource({
  id: '狙擊印記',
  at: 'combat',
  on: {
    onOpen: (c) => c.effect({ label: '【狙擊印記】此回合瞄準升級 1', mandatory: true }, () => {
      c.g.state.flags.aimUp[c.p]++;
      log(c.g, '【狙擊印記】此回合瞄準升級 1');
    }),
  },
});

export const ARCHER_SOURCES = [遊俠, 二連矢, 狙擊蓄力, 狙擊印記];
