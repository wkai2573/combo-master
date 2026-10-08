import { canPay, chooseX, pay } from '../cost';
import { defineSource, lasting } from '../effectKit';
import { activate, chooseCards, data, discard, draw, log, newCard, pname, Z } from '../ops';
import { other } from '../types';

// 伏擊（盜賊）：[先] 此回合我方總攻擊 +4
export const 伏擊 = defineSource({
  id: '伏擊',
  at: 'combat',
  on: {
    onOpen: (c) => c.effect({ label: '【伏擊】此回合總攻擊 +4', mandatory: true }, () => {
      activate(c.g, c.p, c.self!);
      c.g.state.flags.atkBonus[c.p] += 4;
      log(c.g, '【伏擊】此回合總攻擊 +4');
    }),
  },
});

// 順手牽羊（盜賊）：[發_蓋X] 抽X，此回合我方總防禦 -X。X 最大為 2
export const 順手牽羊 = defineSource({
  id: '順手牽羊',
  at: 'combat',
  on: {
    onPlay: (c) => c.effect(
      { label: '【順手牽羊】蓋 X 張經驗，抽 X，此回合總防禦 −X', when: () => canPay(c.g, c.p, { cover: 1 }) },
      function* () {
        const x = yield* chooseX(c.g, c.p, c.self!, 2, '蓋 X 張經驗，抽 X，此回合總防禦 −X');
        if (x === 0) return;
        activate(c.g, c.p, c.self!);
        yield* pay(c.g, c.p, { cover: x });
        yield* draw(c.g, c.p, x);
        c.g.state.flags.defBonus[c.p] -= x;
        log(c.g, `【順手牽羊】抽 ${x}，此回合總防禦 −${x}`);
      },
    ),
  },
});

// 卸除鎧甲（盜賊）：[發_蓋2] 選擇對方 1 張裝備或增益卡，送入棄牌區
export const 卸除鎧甲 = defineSource({
  id: '卸除鎧甲',
  at: 'combat',
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

// 塗毒（盜賊）：[先_蓋1] 歸還時，將 [Ex卡-中毒] 移入出招卡較少那方的經驗區，相同時落入對方
export const 塗毒 = defineSource({
  id: '塗毒',
  at: 'combat',
  on: {
    onOpen: (c) => c.effect({ label: '【塗毒】歸還時，Ex卡-中毒移入經驗區（蓋1）', cost: { cover: 1 } }, () => {
      c.g.state.flags.poisonQ.push(c.p);
      log(c.g, '【塗毒】歸還時，[Ex卡-中毒]將移入經驗區');
    }),
    // 歸還時卡已經離開戰鬥區，所以要明寫 lasting；是否發動看塗毒留下的記號
    afterReturn: lasting((c) => c.g.state.flags.poisonQ.filter((owner) => owner === c.p).map((owner) =>
      // 歸還的影格已經涵蓋這張卡的出現，所以不另外補錄
      c.effect({ label: '【塗毒】Ex卡-中毒移入經驗區', mandatory: true, mark: false }, () => {
        const f = c.g.state.flags;
        const mine = f.played[owner];
        const theirs = f.played[other(owner)];
        const target = mine < theirs ? owner : other(owner);
        newCard(c.g, 'Ex卡-中毒', target, 'exp');
        log(c.g, `【塗毒】[Ex卡-中毒]移入${pname(c.g, target)}的經驗區`);
      }))),
  },
});

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
        when: () => !c.g.state.flags.rabbitUsed[c.p] && Z(c.g, c.p, 'deck').length > 0,
      },
      function* () {
        c.g.state.flags.rabbitUsed[c.p] = true;
        log(c.g, `【${data(c.self!).name}】額外翻 1 張卡做追擊判定`);
        yield* c.flipExtra();
      },
    ),
  },
});

export const THIEF_SOURCES = [伏擊, 順手牽羊, 卸除鎧甲, 塗毒, 幸運兔腳];
