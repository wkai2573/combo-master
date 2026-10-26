import { isExCardId } from '../../data/exCards';
import { canPay, chooseX, faceUpExp, pay } from '../cost';
import { hasExpEffect } from '../effects';
import { defineSource, lasting, slot, type EffectSource } from '../effectKit';
import { activate, awakened, chooseCards, confirm, data, directHit, discard, draw, log, move, newCard, pname, recover, settle, Z, type GameCtx, type Gen } from '../ops';
import { other, type CardInst, type PlayerId } from '../types';

/** 可以放到最前方的表側經驗：已經在經驗區最前方的那張不用選 */
const frontCandidates = (g: GameCtx, p: PlayerId) => faceUpExp(g, p).filter((card) => card !== Z(g, p, 'exp')[0]);

/** 把 1 張表側經驗放到經驗區最前方（裏側的卡位置不動，放到的是整個經驗區的最前方，之後蓋X 從最前面的表側開始蓋） */
function* moveToFront(g: GameCtx, p: PlayerId, who: string): Gen {
  const [pick] = yield* chooseCards(g, p, `【${who}】選擇 1 張表側經驗放到經驗區最前方`, frontCandidates(g, p), 1, 1);
  // 提示等待期間經驗區可能被作弊改動：選到的卡已經不是表側經驗就不處理
  const exp = Z(g, p, 'exp');
  if (!pick || pick.covered || !exp.includes(pick)) return;
  exp.splice(exp.indexOf(pick), 1);
  exp.unshift(pick);
  g.touched++;
  log(g, `【${who}】${pname(g, p)} 將經驗【${data(pick).name}】放到經驗區最前方`);
}

// 招財貓（商人）：當爆發後，可以將 1 張表側經驗放到最前方。沒有費用；與商人角色的同類效果各是爆發後窗口的一個選項
export const 招財貓 = defineSource({
  id: '招財貓',
  at: 'gear',
  on: {
    afterBurst: (c) => c.effect(
      { label: '【招財貓】將 1 張表側經驗放到最前方', confirm: '【招財貓】要將 1 張表側經驗放到最前方嗎？', when: () => frontCandidates(c.g, c.p).length > 0 },
      () => moveToFront(c.g, c.p, '招財貓'),
    ),
  },
});

// 商人：爆發後，可以將 1 張表側經驗放到最前方；覺醒（追加）爆發後，且我方手牌張數 ≤ 6 時，可以將 1 張表側經驗加入手牌
// 手牌張數在窗口內選到這個效果的當下才數
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
          yield* moveToFront(g, p, '商人');
        },
      },
      {
        label: '【商人】覺醒：將 1 張表側經驗加入手牌',
        available: () => awakened(g, p) && faceUpExp(g, p).length > 0 && Z(g, p, 'hand').length <= 6,
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

/**
 * 蓋反應：強制，自己錄發動與步驟影格，所以結算完不再補錄。
 * group：好幾張同名的卡一起被蓋到、結算順序互不影響時，窗口把它們併成一個選項（每張各自結算）
 */
const coverReaction = (id: string, text: string, react: (g: GameCtx, p: PlayerId, self: CardInst) => Gen | void, extraOn: EffectSource['on'] = {}, group?: string) =>
  defineSource({
    id,
    at: 'exp',
    on: {
      ...extraOn,
      onCovered: (c) => c.effect({ label: `【${data(c.self!).name}】被蓋成裏側：${text}`, mandatory: true, mark: false, group }, function* () {
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

// 公開資訊（商人）：[經] 當此卡被蓋為裏側時，翻開最多 3 張我方裏側經驗，然後捨棄此卡
// 翻開的對象不含它自己（它馬上就被捨棄）；裏側經驗超過 3 張時由擁有者選 3 張，不足就全部翻開
export const 公開資訊 = coverReaction(
  '公開資訊',
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

// 財富管理（商人）：
//   [發_蓋1] 必須將牌組上方 3 張卡以裏側放入經驗區（牌組不足 3 張不能發動；放在經驗區最後方；牌組就是生命值，放完剩 0 張就落敗）
//   [經] 當此卡被蓋為裏側時，必須捨棄此卡，然後選擇 2 張經驗放回牌組底（先進棄牌區、雙方都看得到，選不到自己；表側裏側都可以選；
//   不足 2 張全放回；Ex 卡離開經驗區就移除遊戲，不會進牌組）。做法比照公開資訊的「蓋反應時捨棄自己」
export const 財富管理 = coverReaction(
  '財富管理',
  '捨棄此卡，然後選擇 2 張經驗放回牌組底',
  function* (g, p, self) {
    if (Z(g, p, 'exp').includes(self)) {
      discard(g, self);
      log(g, `【財富管理】${pname(g, p)} 捨棄此卡`);
    }
    const back = yield* chooseCards(g, p, '【財富管理】選擇 2 張經驗放回牌組底', Z(g, p, 'exp'), 2, 2);
    for (const card of back) move(g, card, 'deck', 'bottom');
    // Ex 卡離開經驗區是移除遊戲，不會進牌組，紀錄要分開寫
    const removed = back.filter((card) => isExCardId(card.id)).length;
    log(g, `【財富管理】${pname(g, p)} 將 ${back.length - removed} 張經驗放回牌組底${removed > 0 ? `，${removed} 張 Ex 卡移除遊戲` : ''}`);
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

// 強力過件（商人）：[發_蓋2] 將我方牌組上方 3 張卡移入怒氣區，將 5 張 [Ex-貸款] 加入對方經驗
// 對象是我方自己的牌組；移入怒氣區不是直擊（直擊是進棄牌區），不經過防禦、不觸發受到傷害相關的效果。
// 發動條件在付費之前檢查（牌組至少 3 張）；付費時被蓋的卡若讓牌組變少，就移入剩下的全部。剛好打光會落敗。
// 怒氣區的牌面對所有人隱藏（ADR 0006），紀錄不寫卡名；Ex-貸款以表側放進對方經驗區最後方，張數沒有上限
export const 強力過件 = defineSource({
  id: '強力過件',
  at: 'moves',
  on: {
    onPlay: (c) => c.effect(
      { label: '【強力過件】牌組上方 3 張卡移入怒氣區，5 張 Ex-貸款加入對方經驗（蓋2）', cost: { cover: 2 }, when: () => Z(c.g, c.p, 'deck').length >= 3 },
      () => {
        const { g, p } = c;
        const top = Z(g, p, 'deck').slice(0, 3);
        for (const card of top) move(g, card, 'rage', 'top');
        log(g, `【強力過件】${pname(g, p)} 將牌組上方 ${top.length} 張卡移入怒氣區`);
        const foe = other(p);
        for (let i = 0; i < 5; i++) newCard(g, 'Ex-貸款', foe, 'exp');
        log(g, `【強力過件】5 張 [Ex-貸款] 加入${pname(g, foe)}的經驗區`);
      },
    ),
  },
});

// Ex-貸款：[經] 當此卡被蓋為裏側時，我方直擊1，對方回復1。蓋反應，強制；「我方」是這張卡所在經驗區的擁有者，「對方」是他的對手。
// 付蓋X 時被蓋到的每一張各自觸發，進同一個蓋反應窗口；結算順序互不影響，所以併成一個選項
export const Ex貸款 = coverReaction(
  'Ex-貸款',
  '我方直擊 1，對方回復 1',
  (g, p) => {
    directHit(g, p, 1);
    recover(g, other(p), 1);
  },
  {},
  'Ex-貸款',
);

/** 捕熊陷阱這回合給的總攻擊加成 */
export const 捕熊陷阱狀態 = slot('捕熊陷阱', () => ({ atk: 0 }));

// 捕熊陷阱（商人）：[經] 當此卡被蓋為裏側時，我方 +3+0。蓋反應，強制，觸發方式同低價買進。
// 加成持續到本回合結束，存在狀態槽；之後它翻回表側或離開經驗區都不影響已拿到的加成，也不會再觸發
export const 捕熊陷阱 = {
  ...coverReaction('捕熊陷阱', '我方 +3+0（本回合）', (g, p) => {
    捕熊陷阱狀態.of(g, p).atk += 3;
    log(g, `【捕熊陷阱】${pname(g, p)} 本回合 +3+0`);
  }, {}, '捕熊陷阱'),
  ask: { flatAtk: lasting((c: { g: GameCtx; p: PlayerId }) => 捕熊陷阱狀態.read(c.g, c.p).atk) },
} satisfies EffectSource;

// 作假帳（商人）：[發_蓋1] 將 1 張表側經驗放到最前方
// 蓋 1 一定從最前面的表側經驗開始，付完之後經驗區最前面的卡必定是裏側，剩下的表側經驗全都能選。
// 發動前表側經驗不到 2 張，付完就沒有可選的卡，不提供發動（不白付費用）
export const 作假帳 = defineSource({
  id: '作假帳',
  at: 'moves',
  on: {
    onPlay: (c) => c.effect(
      { label: '【作假帳】將 1 張表側經驗放到最前方（蓋1）', cost: { cover: 1 }, when: () => faceUpExp(c.g, c.p).length >= 2 },
      function* () {
        // 付費時的蓋反應可能改變經驗區，沒有可選的卡就不處理
        if (frontCandidates(c.g, c.p).length === 0) return;
        yield* moveToFront(c.g, c.p, '作假帳');
      },
    ),
  },
});

/** 煉金印記這回合是否已啟用 */
export const 煉金印記狀態 = slot('煉金印記', () => ({ armed: false }));

// 煉金印記（商人）：[先] 當我方打出招式時，可以將 1 張表側經驗放到最前方
// 先手步驟打出後，本回合我方每打出 1 張招式（含它自己這一次）都可以發動，每次可選發。
// 啟用之後和這張卡還在不在戰鬥區無關，回合開始由狀態槽清空
export const 煉金印記 = defineSource({
  id: '煉金印記',
  at: 'moves',
  on: {
    onOpen: (c) => c.effect({ label: '【煉金印記】這回合我方打出招式時，可以將 1 張表側經驗放到最前方', mandatory: true, mark: false }, () => {
      煉金印記狀態.of(c.g, c.p).armed = true;
      log(c.g, '【煉金印記】這回合我方每打出 1 張招式，可以將 1 張表側經驗放到最前方');
    }),
    onMyPlay: lasting((c) => c.effect(
      {
        label: '【煉金印記】將 1 張表側經驗放到最前方',
        confirm: '【煉金印記】要將 1 張表側經驗放到最前方嗎？',
        when: () => 煉金印記狀態.read(c.g, c.p).armed && frontCandidates(c.g, c.p).length > 0,
      },
      () => moveToFront(c.g, c.p, '煉金印記'),
    )),
  },
});

export const MERCHANT_SOURCES = [招財貓, 商人, 交涉, 即時停損, 強力過件, 公開資訊, 低價買進, 高價賣出, 財富管理, Ex貸款, 捕熊陷阱, 作假帳, 煉金印記];
