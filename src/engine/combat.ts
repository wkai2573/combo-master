import {
  ask, cardOpt, chooseCards, combatZone, data, draw, log, mark, markIfLogged, move,
  order, pname, takeDamage, Z, type GameCtx, type Gen,
} from './ops';
import { inRange, judge } from './judge';
import { fire, fireEach, moveRules, query } from './effects';
import { checkWin } from './win';
import { other, type CardInst, type PlayerId } from './types';
import {
  ASSASSIN_CAP, resolveCombatStats, totalAtk, totalDef, type CombatStats, type CombatStatsBreakdown,
} from './combatStats';

// ───────────────────────── 範圍內／可出招判定 ─────────────────────────

/** p 目前可以打出的招式（手牌） */
export function playables(g: GameCtx, p: PlayerId): CardInst[] {
  const cands = Z(g, p, 'hand').filter((c) => data(c).kind === 'move');
  // 招式卡疊只能出現一次「重複連擊值」：已經有同值 2 張之後，招式卡疊裡有的連擊值都不能再打出
  const copies = new Map<number, number>();
  for (const c of Z(g, p, 'moves')) copies.set(data(c).combo, (copies.get(data(c).combo) ?? 0) + 1);
  const hasDuplicate = [...copies.values()].some((n) => n >= 2);
  return cands.filter((c) => inRange(g, p, c) && !(hasDuplicate && copies.has(data(c).combo)));
}

// ───────────────────────── 出招 ─────────────────────────

export function* playMove(g: GameCtx, p: PlayerId, card: CardInst, opening: boolean): Gen {
  move(g, card, 'moves', 'top');
  g.state.flags.played[p]++;
  log(g, `${pname(g, p)} ${opening ? '先手出招' : '出招'}【${data(card).name}】`);
  const cd = data(card);
  mark(g, `${pname(g, p)} ${opening ? '先手出招' : '出招'}【${cd.name}】　攻${cd.atk}　連擊${cd.combo}　守${cd.def}`,
    { type: 'play', player: p, uid: card.uid });

  // 先手出招同時是「先手出招時」與「打出時」，兩者的效果進同一個窗口
  yield* fire(g, p, opening ? (['onOpen', 'onPlay'] as const) : 'onPlay', { card });
  checkWin(g);
}

// ───────────────────────── 總攻擊／總防禦 ─────────────────────────

export { ASSASSIN_CAP, resolveCombatStats, totalAtk, totalDef, type CombatStats, type CombatStatsBreakdown };

// ───────────────────────── 追擊 ─────────────────────────

export function pursuitCount(g: GameCtx, p: PlayerId): number {
  return Math.max(0, 1 + query(g, p, 'pursuitBonus'));
}

function* pursuitStep(g: GameCtx, p: PlayerId): Gen {
  const deck = Z(g, p, 'deck');
  // 追擊+N 可能在追擊中途增加（二連矢），所以每次重新計算張數
  // 瞄準的已使用次數是這個步驟自己的記帳，不屬於任何一張卡
  const aimUsed = { n: 0 };
  for (let i = 0; i < pursuitCount(g, p) && deck.length > 0; i++) {
    yield* aim(g, p, aimUsed);
    yield* afterJudge(g, p, deck[0]);
  }
}

/** 【瞄準】可使用次數：遊俠 1（覺醒 +1）、瞄準器 +1；每個瞄準每回合 1 次 */
export function aimLimit(g: GameCtx, p: PlayerId): number {
  return query(g, p, 'aimLimit');
}

/**
 * 【瞄準】追擊判定翻牌前使用。
 * LV1：看牌組頂 1 張，選擇放到牌組頂（就用這張）或牌組底（改看下一張）。
 * LV2（狙擊印記使本回合升級）：抽 1，然後選擇手中 1 張卡放到牌組頂或底。
 */
function* aim(g: GameCtx, p: PlayerId, used: { n: number }): Gen {
  const limit = aimLimit(g, p);
  if (limit === 0) return;
  const deck = Z(g, p, 'deck');
  while (used.n < limit && deck.length >= 1) {
    const left = limit - used.n;
    const level = 1 + query(g, p, 'aimLevel');
    if (level >= 2) {
      const [use] = yield* ask(g, {
        player: p,
        title: `【瞄準 LV${level}】要使用嗎？抽 1，再選手中 1 張卡放到牌組頂或底。（剩 ${left} 次）`,
        min: 1, max: 1,
        options: [{ key: 'use', label: '使用' }, { key: 'skip', label: '不使用' }],
      });
      if (use !== 'use') return;
      used.n++;
      yield* draw(g, p, 1);
      const [put] = yield* chooseCards(g, p, '【瞄準】選擇手中 1 張卡放到牌組頂或底', Z(g, p, 'hand'), 1, 1);
      if (!put) return;
      const [where] = yield* ask(g, {
        player: p, title: `【瞄準】【${data(put).name}】要放到哪裡？`, min: 1, max: 1,
        options: [{ key: 'top', label: '牌組頂（這次就翻它）' }, { key: 'bottom', label: '牌組底' }],
      });
      move(g, put, 'deck', where === 'top' ? 'top' : 'bottom');
      log(g, `【瞄準】${pname(g, p)} 抽 1，並將 1 張手牌放到牌組${where === 'top' ? '頂' : '底'}`);
      mark(g, g.state.log[g.state.log.length - 1], { type: 'info' });
      continue;
    }
    if (deck.length < 2) return;
    const top = deck[0];
    const hit = !moveRules(top.id).pursuitFails && !inRange(g, p, top);
    const keys = yield* ask(g, {
      player: p,
      title: `【瞄準】牌組頂是【${data(top).name}】（連擊值 ${data(top).combo}），以目前範圍會判定${hit ? '成功' : '失敗'}。（剩 ${left} 次）`,
      min: 1, max: 1,
      options: [
        { ...cardOpt(top, p, `就用這張`), key: 'keep' },
        { key: 'swap', label: '放到牌組底，改看下一張' },
      ],
    });
    if (keys[0] === 'keep') return;
    used.n++;
    move(g, top, 'deck', 'bottom');
    log(g, `【瞄準】${pname(g, p)} 將牌組頂的牌放到牌組底`);
    mark(g, `【瞄準】${pname(g, p)} 將牌組頂的牌放到牌組底，改判定下一張`, { type: 'aimSwap', player: p });
  }
}

function* afterJudge(g: GameCtx, p: PlayerId, card: CardInst): Gen {
  const ok = yield* judge(g, p, card);
  if (ok) return;
  yield* fire(g, p, 'afterPursuitFail', { flipExtra: () => judge(g, p, Z(g, p, 'deck')[0]) });
}

export function* pursuitPhase(g: GameCtx): Gen {
  g.state.phase = '追擊';
  mark(g, '追擊階段：雙方翻開牌組頂的牌做追擊判定', { type: 'banner', kind: 'phase', name: '追擊階段' });
  for (const p of order(g)) yield* pursuitStep(g, p);
  checkWin(g);
}

// ───────────────────────── 傷害、歸還 ─────────────────────────

export function* damageStep(g: GameCtx): Gen {
  g.state.phase = '傷害';
  const s0 = resolveCombatStats(g, 0);
  const s1 = resolveCombatStats(g, 1);
  const dmg: [number, number] = [
    Math.max(0, s1.atk - s0.def),
    Math.max(0, s0.atk - s1.def),
  ];
  mark(g, '傷害計算', { type: 'banner', kind: 'phase', name: '傷害計算' });
  log(g, `傷害計算：玩家A受到 ${dmg[0]}、玩家B受到 ${dmg[1]}`);
  const atk: [number, number] = [s0.atk, s1.atk];
  const def: [number, number] = [s0.def, s1.def];
  mark(g, '攻守拼招：對方總攻擊 − 我方總防禦 ＝ 傷害', { type: 'calc', atk, def, dmg });
  for (const p of order(g)) {
    g.state.flags.damageTaken[p] = dmg[p];
    takeDamage(g, p, dmg[p]);
  }
  mark(
    g,
    dmg[0] + dmg[1] === 0
      ? '雙方都沒有受到傷害'
      : [0, 1].filter((p) => dmg[p] > 0).map((p) => `${pname(g, p as PlayerId)} 受到 ${dmg[p]} 傷害（牌組放入怒氣區）`).join('　'),
    { type: 'damage', dmg },
  );
  yield* markIfLogged(g, function* (): Gen {
    // 經驗區中表側的 [經] 卡：傷害計算後的效果，進觸發窗口，先攻方先處理
    yield* fireEach(g, 'afterDamage', (p) => ({ dealt: dmg[other(p)], taken: dmg[p] }));
  });
  checkWin(g);
}

export function* returnStep(g: GameCtx): Gen {
  g.state.phase = '歸還';
  for (const p of order(g)) {
    // 招式卡疊由最底到最頂，最後是追擊卡疊
    for (const c of combatZone(g, p)) move(g, c, 'exp');
  }
  // 塗毒：歸還時，把 [Ex卡-中毒] 移入出招卡較少那方的經驗區，相同時落入對方
  yield* fireEach(g, 'afterReturn');
  mark(g, '招式與追擊卡依序放入經驗區', { type: 'return' });
}

// ───────────────────────── 戰鬥階段 ─────────────────────────

export function* combatPhase(g: GameCtx): Gen {
  const s = g.state;
  const [first, second] = order(g);

  s.phase = '先手';
  const opening = playables(g, first);
  if (opening.length === 0) {
    const hand = Z(g, first, 'hand').map((c) => data(c).name).join('、') || '（無）';
    log(g, `${pname(g, first)} 沒有可出的招式，展示手牌：${hand}`);
    mark(g, `${pname(g, first)} 沒有可出的招式，展示手牌`, { type: 'info' });
  } else {
    const [c] = yield* chooseCards(g, first, '先手步驟：選擇 1 張招式出招', opening, 1, 1);
    yield* playMove(g, first, c, true);
  }
  s.flags.opened = true;

  s.phase = '反擊';
  let cur: PlayerId = second;
  let firstAction = true;
  // 先手步驟時雙方就被迫收招（即時停損）：沒有進入反擊步驟，不做追擊判定，直接傷害計算
  let straightToDamage = s.passed[0] && s.passed[1];
  for (let guard = 0; guard < 200 && !(s.passed[0] && s.passed[1]); guard++) {
    if (s.passed[cur]) {
      cur = other(cur);
      continue;
    }
    const options = playables(g, cur);
    let playedCard: CardInst | undefined;
    if (options.length > 0) {
      const keys = yield* ask(g, {
        player: cur,
        title: '反擊步驟：選擇 1 張招式出招，或收招',
        min: 1, max: 1,
        options: [...options.map((c) => cardOpt(c, cur)), { key: 'pass', label: '收招' }],
      });
      playedCard = options.find((c) => `c${c.uid}` === keys[0]);
    }
    if (playedCard) {
      yield* playMove(g, cur, playedCard, false);
    } else {
      s.passed[cur] = true;
      log(g, `${pname(g, cur)} 收招`);
      const direct = firstAction && cur === second;
      mark(g, `${pname(g, cur)} 收招${direct ? '，直接進入傷害計算' : ''}`, { type: 'pass', player: cur });
      yield* markIfLogged(g, () => fire(g, cur, 'onPass'));
      if (direct) {
        straightToDamage = true;
        break;
      }
    }
    firstAction = false;
    cur = other(cur);
  }

  if (!straightToDamage) yield* pursuitPhase(g);
  yield* damageStep(g);
  yield* returnStep(g);
  yield* fireEach(g, 'onAwaken'); // 歸還讓經驗區增加，可能進入覺醒
}
