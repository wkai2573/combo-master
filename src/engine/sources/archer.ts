import { defineSource } from '../effectKit';
import { draw, log, pname } from '../ops';

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

export const ARCHER_SOURCES = [遊俠];
