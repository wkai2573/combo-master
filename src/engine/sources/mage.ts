import { defineSource, lasting, slot } from '../effectKit';
import { faceUpExp } from '../cost';
import { activate, awakened, chooseCards, combatZone, data, directHit, discard, draw, log, move, pname, recover, topOfZone, Z } from '../ops';
import { other } from '../types';

// 冰與雷之曲（法師）：[蓋2] 收招時，戰鬥區的卡合計具有「冰」「電」兩個特徵時，抽 1、回復 1；
// 一張卡兩個特徵或兩張各一個都算
export const 冰與雷之曲 = defineSource({
  id: '冰與雷之曲',
  at: 'gear',
  on: {
    onPass: (c) => {
      const has = (traits: string[]) => combatZone(c.g, c.p).some((card) => data(card).traits.some((t) => traits.includes(t)));
      return c.effect(
        { label: '【冰與雷之曲】抽 1，回復 1（蓋2）', cost: { cover: 2 }, when: () => has(['冰']) && has(['電']) },
        function* () {
          yield* draw(c.g, c.p, 1);
          recover(c.g, c.p, 1);
          log(c.g, '【冰與雷之曲】抽 1，回復 1');
        },
      );
    },
  },
});

// 火球（法師）：[先_蓋3] 對方直擊 2
export const 火球 = defineSource({
  id: '火球',
  at: 'moves',
  on: {
    onOpen: (c) => c.effect(
      { label: '【火球】對方直擊 2（蓋3）', cost: { cover: 3 } },
      () => void directHit(c.g, other(c.p), 2),
    ),
  },
});

/** Explosion! 是否讓這回合跳過抽牌階段 */
export const Explosion狀態 = slot('Explosion!', () => ({ skip: false }));

// Explosion!（法師）：[先_蓋8] 對方直擊 4，然後我方收招，並跳過我方下個抽牌階段
export const Explosion = defineSource({
  id: 'Explosion!',
  at: 'moves',
  on: {
    onOpen: (c) => c.effect({ label: '【Explosion!】對方直擊 4，我方收招，跳過抽牌階段（蓋8）', cost: { cover: 8 } }, () => {
      const { g, p } = c;
      directHit(g, other(p), 4);
      g.state.passed[p] = true;
      Explosion狀態.of(g, p).skip = true;
      log(g, `【Explosion!】${pname(g, p)} 收招，並跳過這回合的抽牌階段`);
    }),
  },
  ask: { skipDrawPhase: lasting((c) => Explosion狀態.read(c.g, c.p).skip) },
});

// 冰霜護甲（法師）：[頂_蓋2] 傷害計算時，捨棄我方 X 張裏側經驗，減少受到的 X 點傷害。X 最大為將受到的傷害
// 此卡要在招式卡疊最上方、將受到的傷害至少 1、付得起蓋2 才能發動。蓋2 先付，剛蓋成裏側的卡也算裏側經驗；
// X 至少 1，最多是將受到的傷害與我方裏側經驗張數中較小的；只減傷害計算的傷害，直擊不受影響
export const 冰霜護甲 = defineSource({
  id: '冰霜護甲',
  at: 'moves',
  on: {
    onDamage: (c) => c.effect(
      {
        label: '【冰霜護甲】捨棄 X 張裏側經驗，減少受到的 X 點傷害（蓋2）',
        cost: { cover: 2 },
        when: () => topOfZone(c.g, c.p) === c.self && c.g.state.flags.damagePending[c.p] >= 1,
      },
      function* () {
        const { g, p } = c;
        const pending = g.state.flags.damagePending;
        const covered = Z(g, p, 'exp').filter((card) => card.covered);
        const drop = yield* chooseCards(g, p, '【冰霜護甲】選擇要捨棄的裏側經驗，每張減少 1 點傷害', covered, 1, Math.min(pending[p], covered.length));
        for (const card of drop) discard(g, card);
        pending[p] -= drop.length;
        log(g, `【冰霜護甲】${pname(g, p)} 捨棄 ${drop.length} 張裏側經驗，減少 ${drop.length} 點傷害`);
      },
    ),
  },
});

// 電弧（法師）：[發_蓋1] 抽X，再將 X 張手牌放到牌組底。X = 對方戰鬥區的招式數量
export const 電弧 = defineSource({
  id: '電弧',
  at: 'moves',
  on: {
    onPlay: (c) => c.effect(
      { label: '【電弧】抽 X，再放 X 張手牌到牌組底（蓋1）', cost: { cover: 1 }, when: () => combatZone(c.g, other(c.p)).length > 0 },
      function* () {
        const { g, p } = c;
        const x = combatZone(g, other(p)).length;
        yield* draw(g, p, x);
        const put = yield* chooseCards(g, p, `【電弧】選擇 ${x} 張手牌放到牌組底`, Z(g, p, 'hand'), x, x);
        for (const card of put) move(g, card, 'deck', 'bottom');
        log(g, `【電弧】${pname(g, p)} 抽 ${x}，並將 ${put.length} 張手牌放到牌組底`);
      },
    ),
  },
});

// 力量爆破（法師）：[頂] 我方總攻擊 -3；[追] 此卡追擊判定失敗
export const 力量爆破 = defineSource({ id: '力量爆破', at: 'moves', asMove: { topAtk: -3, pursuitFails: true } });

// 法師：開局多抽 2；覺醒（追加）當我方覺醒時，可以抽 1
export const 法師 = defineSource({
  id: '法師',
  at: 'char',
  on: {
    onAwaken: (c) => c.effect(
      { label: '【法師】覺醒：抽 1', confirm: '【法師】覺醒：要抽 1 張嗎？' },
      function* () {
        yield* draw(c.g, c.p, 1);
        log(c.g, `【法師】${pname(c.g, c.p)} 覺醒時抽 1`);
      },
    ),
  },
  ask: {
    openingDraw: () => 2,
  },
});

/** 【元素】：火、冰、電三種特徵的統稱，毒不算（說明寫在卡表的關鍵字區塊） */
export const ELEMENT_TRAITS = ['火', '冰', '電'];

// 元素法典（id 星界法典，法師飾品）：[蓋3] 當我方收招時，且我方戰鬥區有【元素】特徵時，
// 從表側經驗選擇 1 張有相同【元素】特徵的卡加入手牌。戰鬥區含招式卡疊與追擊卡疊；只能拿 1 張；
// 蓋3 先付，所以可選的是付完之後仍是表側的經驗；沒有符合的卡就不能發動
export const 元素法典 = defineSource({
  id: '星界法典',
  at: 'gear',
  on: {
    onPass: (c) => {
      const present = () => new Set(combatZone(c.g, c.p).flatMap((card) => data(card).traits.filter((t) => ELEMENT_TRAITS.includes(t))));
      const candidates = (afterCover: boolean) => {
        const elements = present();
        const pool = faceUpExp(c.g, c.p);
        return (afterCover ? pool.slice(3) : pool).filter((card) => data(card).traits.some((t) => elements.has(t)));
      };
      return c.effect(
        { label: '【元素法典】將 1 張相同【元素】特徵的表側經驗加入手牌（蓋3）', cost: { cover: 3 }, when: () => candidates(true).length > 0 },
        function* () {
          const [pick] = yield* chooseCards(c.g, c.p, '【元素法典】選擇 1 張有相同【元素】特徵的表側經驗加入手牌', candidates(false), 1, 1);
          if (!pick) return;
          move(c.g, pick, 'hand');
          log(c.g, `【元素法典】${pname(c.g, c.p)} 將經驗【${data(pick).name}】加入手牌`);
        },
      );
    },
  },
});

export const MAGE_SOURCES = [冰與雷之曲, 火球, Explosion, 冰霜護甲, 電弧, 力量爆破, 元素法典, 法師];
