import { canPay, chooseX, faceUpExp, pay } from '../cost';
import { hasExpEffect } from '../effects';
import { defineSource, type EffectSource } from '../effectKit';
import { activate, awakened, chooseCards, confirm, data, discard, draw, log, move, pname, recover, settle, Z, type GameCtx, type Gen } from '../ops';
import type { CardInst, PlayerId } from '../types';

// 招財貓（商人）：[蓋2] 爆發時，額外抽 1
export const 招財貓 = defineSource({
  id: '招財貓',
  at: 'gear',
  on: {
    afterBurst: (c) => c.effect(
      { label: '【招財貓】爆發時，抽 1（蓋2）', cost: { cover: 2 } },
      function* () {
        yield* draw(c.g, c.p, 1);
        log(c.g, `【招財貓】${pname(c.g, c.p)} 爆發時額外抽 1`);
      },
    ),
  },
});

/**
 * 商人爆發後的效果：
 * - 調整表側經驗的順序（蓋X 從最前面開始蓋，裏側的卡位置不動）
 * - 覺醒後：把 1 張表側經驗加入手牌
 */
/** 可以放到最前方的表側經驗：已經在經驗區最前方的那張不用選 */
const frontCandidates = (g: GameCtx, p: PlayerId) => faceUpExp(g, p).filter((card) => card !== Z(g, p, 'exp')[0]);

// 商人：爆發後，可以將 1 張表側經驗放到最前方；覺醒（追加）可以將 1 張表側經驗加入手牌
export const 商人 = defineSource({
  id: '商人',
  at: 'char',
  on: {
    afterBurst: ({ g, p }) => [
      {
        label: '【商人】將 1 張表側經驗放到最前方',
        available: () => frontCandidates(g, p).length > 0,
        *run(confirmed) {
          if (!confirmed && !(yield* confirm(g, p, '【商人】要將 1 張表側經驗放到最前方嗎？'))) return;
          const [pick] = yield* chooseCards(g, p, '【商人】選擇 1 張表側經驗放到經驗區最前方', frontCandidates(g, p), 1, 1);
          // 提示等待期間經驗區可能被作弊改動：選到的卡已經不是表側經驗就不處理
          const exp = Z(g, p, 'exp');
          if (!pick || pick.covered || !exp.includes(pick)) return;
          exp.splice(exp.indexOf(pick), 1);
          exp.unshift(pick);
          g.touched++;
          log(g, `【商人】${pname(g, p)} 將經驗【${data(pick).name}】放到經驗區最前方`);
        },
      },
      {
        label: '【商人】覺醒：將 1 張表側經驗加入手牌',
        available: () => awakened(g, p) && faceUpExp(g, p).length > 0,
        *run(confirmed) {
          if (!confirmed && !(yield* confirm(g, p, '【商人】覺醒：要將 1 張表側經驗加入手牌嗎？'))) return;
          const [pick] = yield* chooseCards(g, p, '【商人】選擇 1 張表側經驗加入手牌', faceUpExp(g, p), 1, 1);
          if (pick) {
            move(g, pick, 'hand');
            log(g, `【商人】${pname(g, p)} 將經驗【${data(pick).name}】加入手牌`);
          }
        },
      },
    ],
  },
});

// 交涉（商人）：[發_蓋X] 抽X，再將 X 張手牌放到牌組底。X 最大為 3
export const 交涉 = defineSource({
  id: '交涉',
  at: 'moves',
  on: {
    onPlay: (c) => c.effect(
      { label: '【交涉】蓋 X 張經驗，抽 X，再放 X 張手牌到牌組底', when: () => canPay(c.g, c.p, { cover: 1 }) },
      function* () {
        const { g, p } = c;
        const x = yield* chooseX(g, p, c.self!, 3, '蓋 X 張經驗，抽 X，再放 X 張手牌到牌組底');
        if (x === 0) return;
        activate(g, p, c.self!);
        yield* pay(g, p, { cover: x });
        yield* draw(g, p, x);
        const put = yield* chooseCards(g, p, `【交涉】選擇 ${x} 張手牌放到牌組底`, Z(g, p, 'hand'), x, x);
        for (const card of put) move(g, card, 'deck', 'bottom');
        log(g, `【交涉】抽 ${x}，並將 ${put.length} 張手牌放到牌組底`);
      },
    ),
  },
});

// 即時停損（商人）：[發_蓋4] 此卡打出後雙方立即收招
export const 即時停損 = defineSource({
  id: '即時停損',
  at: 'moves',
  on: {
    onPlay: (c) => c.effect({ label: '【即時停損】雙方立即收招（蓋4）', cost: { cover: 4 } }, () => {
      c.g.state.passed = [true, true];
      log(c.g, '【即時停損】雙方立即收招');
    }),
  },
});

/** 蓋反應：強制，自己錄發動與步驟影格，所以結算完不再補錄 */
const coverReaction = (id: string, text: string, react: (g: GameCtx, p: PlayerId, self: CardInst) => Gen | void, extraOn: EffectSource['on'] = {}) =>
  defineSource({
    id,
    at: 'exp',
    on: {
      ...extraOn,
      onCovered: (c) => c.effect({ label: `【${data(c.self!).name}】被蓋成裏側：${text}`, mandatory: true, mark: false }, function* () {
        log(c.g, `【${data(c.self!).name}】被蓋成裏側`);
        activate(c.g, c.p, c.self!, `【${data(c.self!).name}】被蓋成裏側，效果發動`);
        const r = react(c.g, c.p, c.self!);
        if (r) yield* r;
        settle(c.g);
      }),
    },
  });

// 低價買進（商人）：[經] 此卡被蓋成裏側時，回復 1
export const 低價買進 = coverReaction('低價買進', '回復 1', (g, p) => void recover(g, p, 1));
// 高價賣出（商人）：[經] 此卡被蓋成裏側時，抽 1
export const 高價賣出 = coverReaction('高價賣出', '抽 1', function* (g, p) {
  yield* draw(g, p, 1);
});

// 公開資訊（id 高利貸，商人）：[經] 當此卡被蓋為裏側時，翻開最多 3 張我方裏側經驗，然後捨棄此卡
// 翻開的對象不含它自己（它馬上就被捨棄）；裏側經驗超過 3 張時由擁有者選 3 張，不足就全部翻開
export const 公開資訊 = coverReaction(
  '高利貸',
  '翻開最多 3 張我方裏側經驗，然後捨棄此卡',
  function* (g, p, self) {
    const candidates = () => Z(g, p, 'exp').filter((card) => card.covered && card !== self);
    const pool = candidates();
    const opened = pool.length <= 3
      ? pool
      : yield* chooseCards(g, p, '【公開資訊】選擇 3 張裏側經驗翻開', pool, 3, 3);
    for (const card of opened) {
      // 提示等待期間經驗區可能被作弊改動：選到的卡已經不是裏側經驗就略過
      if (card.covered && Z(g, p, 'exp').includes(card)) card.covered = false;
    }
    if (opened.length > 0) g.touched++;
    log(g, `【公開資訊】${pname(g, p)} 翻開 ${opened.length} 張裏側經驗`);
    if (Z(g, p, 'exp').includes(self)) discard(g, self);
    log(g, `【公開資訊】${pname(g, p)} 捨棄此卡`);
  },
);

// 財富管理（id 投資，商人）：
//   [發_蓋1] 必須將牌組上方 3 張卡以裏側放入經驗區（牌組不足 3 張不能發動；放在經驗區最後方；牌組就是生命值，放完剩 0 張就落敗）
//   [經] 當此卡被蓋為裏側時，必須選擇 2 張經驗放回牌組底（表側裏側都可以，可含此卡；不足 2 張全放回；Ex 卡離開經驗區就移除遊戲，不會進牌組）
export const 財富管理 = coverReaction(
  '投資',
  '選擇 2 張經驗放回牌組底',
  function* (g, p) {
    const back = yield* chooseCards(g, p, '【財富管理】選擇 2 張經驗放回牌組底', Z(g, p, 'exp'), 2, 2);
    for (const card of back) move(g, card, 'deck', 'bottom');
    log(g, `【財富管理】${pname(g, p)} 將 ${back.length} 張經驗放回牌組底`);
  },
  {
    onPlay: (c) => c.effect(
      { label: '【財富管理】將牌組上方 3 張卡以裏側放入經驗區（蓋1）', cost: { cover: 1 }, when: () => Z(c.g, c.p, 'deck').length >= 3 },
      () => {
        // 發動條件在付費之前檢查；付費時被蓋的卡可能讓牌組變少（例如高價賣出抽牌），那就放入剩下的全部
        const top = Z(c.g, c.p, 'deck').slice(0, 3);
        for (const card of top) {
          move(c.g, card, 'exp');
          card.covered = true;
        }
        log(c.g, `【財富管理】${pname(c.g, c.p)} 將牌組上方 ${top.length} 張卡以裏側放入經驗區`);
      },
    ),
  },
);

export const MERCHANT_SOURCES = [招財貓, 商人, 交涉, 即時停損, 公開資訊, 低價買進, 高價賣出, 財富管理];
