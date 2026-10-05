import { isVanilla } from '../data/enabledCards';
import {
  ask, awakened, cardOpt, chooseCards, data, draw, isFirst, log, mark, markIfLogged, move, optionalPay,
  newCard, order, pname, takeDamage, Z, type GameCtx, type Gen,
} from './ops';
import { onPassEffects, scripts } from './scripts';
import { checkWin } from './win';
import { other, type CardInst, type PlayerId } from './types';

// ───────────────────────── 範圍內／可出招判定 ─────────────────────────

/** 該卡是否在 p 的「範圍內」：雙方戰鬥區最後一張招式的連擊值（含）之間 */
export function inRange(g: GameCtx, p: PlayerId, c: CardInst): boolean {
  const mine = Z(g, p, 'combat');
  const opp = Z(g, other(p), 'combat');
  if (mine.length === 0 || opp.length === 0) return true;
  const m = data(mine[mine.length - 1]).combo;
  const o = data(opp[opp.length - 1]).combo;
  const v = data(c).combo;
  return v >= Math.min(m, o) && v <= Math.max(m, o);
}

/** p 目前可以打出的招式（手牌） */
export function playables(g: GameCtx, p: PlayerId): CardInst[] {
  const cands = Z(g, p, 'hand').filter((c) => data(c).kind === 'move');
  // 戰鬥區已有「重複連擊值」（同值 2 張）時，就不能再打出同連擊值的卡
  const copies = new Map<number, number>();
  for (const c of Z(g, p, 'combat')) copies.set(data(c).combo, (copies.get(data(c).combo) ?? 0) + 1);
  return cands.filter((c) => inRange(g, p, c) && (copies.get(data(c).combo) ?? 0) < MAX_SAME_COMBO);
}

/** 同一連擊值在自己的戰鬥區最多 2 張（第 1 次重複可以，已重複就不能再出） */
const MAX_SAME_COMBO = 2;

// ───────────────────────── 出招 ─────────────────────────

export function* playMove(g: GameCtx, p: PlayerId, card: CardInst, opening: boolean): Gen {
  move(g, card, 'combat', 'top');
  g.state.flags.played[p]++;
  log(g, `${pname(g, p)} ${opening ? '起手' : '出招'}【${data(card).name}】`);
  const cd = data(card);
  mark(g, `${pname(g, p)} ${opening ? '起手' : '出招'}【${cd.name}】　攻${cd.atk}　連擊${cd.combo}　守${cd.def}`,
    { type: 'play', player: p, uid: card.uid });

  const sc = scripts[card.id];
  yield* markIfLogged(g, function* (): Gen {
    if (opening && sc?.onOpen) yield* sc.onOpen(g, p, card);
    if (sc?.onPlay) yield* sc.onPlay(g, p, card);
  });
  checkWin(g);
}

// ───────────────────────── 總攻擊／總防禦 ─────────────────────────

/** 刺客「追擊判定成功」加成的總上限 */
export const ASSASSIN_CAP = 5;

/** 我方戰鬥區白板卡（無特徵、無效果的招式）數量 */
function vanillaCount(g: GameCtx, p: PlayerId): number {
  return Z(g, p, 'combat').filter((c) => isVanilla(data(c))).length;
}

export function totalAtk(g: GameCtx, p: PlayerId): number {
  const zone = Z(g, p, 'combat');
  let base = 0;
  zone.forEach((c, i) => {
    const mod = i === zone.length - 1 ? scripts[c.id]?.atkMod ?? 0 : 0;
    base += Math.max(0, data(c).atk + mod);
  });
  for (const c of Z(g, p, 'pursuit')) base += data(c).atk + (scripts[c.id]?.pursuitAtkBonus ?? 0);
  base += g.state.flags.atkBonus[p];
  // [頂] 依場面加成的總攻擊（盾擊）
  const topCard = zone[zone.length - 1];
  base += scripts[topCard?.id ?? '']?.topAtkBonus?.(g, p) ?? 0;
  base += g.state.flags.vanillaBoost[p] * vanillaCount(g, p);
  base = Math.max(0, base);

  const awake = awakened(g, p);
  let bonus = 0;
  switch (g.state.players[p].charId) {
    case '勇者':
      if (base >= (awake ? 10 : 15)) bonus += 3;
      break;
    case '刺客':
      bonus += Math.min(ASSASSIN_CAP, (awake ? 2 : 1) * g.state.flags.pursuitSuccess[p]);
      break;
    case '先人':
      if (isFirst(g, p)) bonus += Math.max(0, g.state.flags.played[p] - 1);
      break;
  }
  return base + bonus;
}

export function totalDef(g: GameCtx, p: PlayerId): number {
  const zone = Z(g, p, 'combat');
  let total = 0;
  zone.forEach((c, i) => {
    const mod = i === zone.length - 1 ? scripts[c.id]?.defMod ?? 0 : 0;
    total += Math.max(0, data(c).def + mod);
  });
  const rearGuard = g.state.players[p].charId === '後人';
  for (const c of Z(g, p, 'pursuit')) {
    total += scripts[c.id]?.pursuitDefBonus ?? 0;
    if (rearGuard && awakened(g, p) && !isFirst(g, p)) total += data(c).def;
  }
  if (rearGuard && !isFirst(g, p)) total += 2;
  total += g.state.flags.vanillaBoost[p] * vanillaCount(g, p);
  return total;
}

// ───────────────────────── 追擊 ─────────────────────────

export function pursuitCount(g: GameCtx, p: PlayerId): number {
  const f = g.state.flags;
  let n = 1 + f.pursuitPlus[p];
  if (g.state.players[p].charId === '先人' && awakened(g, p) && isFirst(g, p)) n += 1;
  // [頂] 戰鬥區只有這張卡時追擊 +N（二刀連擊）
  const combat = Z(g, p, 'combat');
  if (combat.length === 1) n += scripts[combat[0].id]?.soloPursuitPlus ?? 0;
  return Math.max(0, n);
}

function* becomePursuitCard(g: GameCtx, p: PlayerId, card: CardInst): Gen {
  move(g, card, 'pursuit');
  g.state.flags.pursuitSuccess[p]++;
  log(g, `追擊成功：【${data(card).name}】成為追擊卡`);
  mark(g, `追擊成功！【${data(card).name}】成為追擊卡（攻擊 +${data(card).atk}）`,
    { type: 'flipResult', player: p, cardId: card.id, ok: true });
  const sc = scripts[card.id];
  if (sc?.onPursuitCard) yield* sc.onPursuitCard(g, p, card);
}

/** 對 card 做追擊判定。回傳是否成功。 */
function* judge(g: GameCtx, p: PlayerId, card: CardInst): Gen<boolean> {
  log(g, `${pname(g, p)} 追擊判定：翻開【${data(card).name}】（連擊值 ${data(card).combo}）`);
  mark(g, `${pname(g, p)} 追擊判定：翻開【${data(card).name}】（連擊值 ${data(card).combo}）`,
    { type: 'flip', player: p, cardId: card.id });

  const success = !scripts[card.id]?.pursuitFail && !inRange(g, p, card);
  if (success) {
    yield* becomePursuitCard(g, p, card);
    return true;
  }
  log(g, '追擊判定失敗，該卡加入手中');
  move(g, card, 'hand');
  mark(g, `追擊失敗：【${data(card).name}】的連擊值 ${data(card).combo} 在範圍內，回到手中`,
    { type: 'flipResult', player: p, cardId: card.id, ok: false });
  return false;
}

function* pursuitStep(g: GameCtx, p: PlayerId): Gen {
  const deck = Z(g, p, 'deck');
  // 追擊+N 可能在追擊中途增加（二連矢），所以每次重新計算張數
  for (let i = 0; i < pursuitCount(g, p) && deck.length > 0; i++) {
    yield* aim(g, p);
    yield* afterJudge(g, p, deck[0]);
  }
}

/** 【瞄準】可使用次數：遊俠 1（覺醒 +1）、瞄準器 +1；每個瞄準每回合 1 次 */
export function aimLimit(g: GameCtx, p: PlayerId): number {
  let n = 0;
  if (g.state.players[p].charId === '遊俠') n += awakened(g, p) ? 2 : 1;
  if (Z(g, p, 'gear').some((c) => c.id === '瞄準器')) n++;
  return n;
}

/**
 * 【瞄準】追擊判定翻牌前使用。
 * LV1：看牌組頂 1 張，選擇放到牌組頂（就用這張）或牌組底（改看下一張）。
 * LV2（狙擊印記使本回合升級）：抽 1，然後選擇手中 1 張卡放到牌組頂或底。
 */
function* aim(g: GameCtx, p: PlayerId): Gen {
  const limit = aimLimit(g, p);
  if (limit === 0) return;
  const deck = Z(g, p, 'deck');
  while (g.state.flags.aimUsed[p] < limit && deck.length >= 1) {
    const left = limit - g.state.flags.aimUsed[p];
    const level = 1 + g.state.flags.aimUp[p];
    if (level >= 2) {
      const [use] = yield* ask(g, {
        player: p,
        title: `【瞄準 LV${level}】要使用嗎？抽 1，再選手中 1 張卡放到牌組頂或底。（剩 ${left} 次）`,
        min: 1, max: 1,
        options: [{ key: 'use', label: '使用' }, { key: 'skip', label: '不使用' }],
      });
      if (use !== 'use') return;
      g.state.flags.aimUsed[p]++;
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
    const hit = !scripts[top.id]?.pursuitFail && !inRange(g, p, top);
    const keys = yield* ask(g, {
      player: p,
      title: `【瞄準】牌組頂是【${data(top).name}】（連擊值 ${data(top).combo}），以目前範圍會判定${hit ? '成功' : '失敗'}。（剩 ${left} 次）`,
      min: 1, max: 1,
      options: [
        { ...cardOpt(top, `就用這張`), key: 'keep' },
        { key: 'swap', label: '放到牌組底，改看下一張' },
      ],
    });
    if (keys[0] === 'keep') return;
    g.state.flags.aimUsed[p]++;
    move(g, top, 'deck', 'bottom');
    log(g, `【瞄準】${pname(g, p)} 將牌組頂的牌放到牌組底`);
    mark(g, `【瞄準】${pname(g, p)} 將牌組頂的牌放到牌組底，改判定下一張`, { type: 'info' });
  }
}

function* afterJudge(g: GameCtx, p: PlayerId, card: CardInst): Gen {
  const ok = yield* judge(g, p, card);
  if (ok || g.state.flags.rabbitUsed[p]) return;
  const rabbit = Z(g, p, 'gear').find((c) => c.id === '幸運兔腳');
  const deck = Z(g, p, 'deck');
  if (rabbit && deck.length > 0 && (yield* optionalPay(g, p, rabbit, { cover: 2 }))) {
    g.state.flags.rabbitUsed[p] = true;
    log(g, `【${data(rabbit).name}】額外翻 1 張卡做追擊判定`);
    yield* judge(g, p, deck[0]);
  }
}

export function* pursuitPhase(g: GameCtx): Gen {
  g.state.phase = '追擊';
  mark(g, '追擊階段：雙方翻開牌組頂的牌做追擊判定', { type: 'phase' });
  for (const p of order(g)) yield* pursuitStep(g, p);
  checkWin(g);
}

// ───────────────────────── 傷害、歸還 ─────────────────────────

export function* damageStep(g: GameCtx): Gen {
  g.state.phase = '傷害';
  const dmg: [number, number] = [0, 0];
  for (const p of [0, 1] as PlayerId[]) {
    dmg[p] = Math.max(0, totalAtk(g, other(p)) - totalDef(g, p));
  }
  log(g, `傷害計算：玩家A受到 ${dmg[0]}、玩家B受到 ${dmg[1]}`);
  const atk: [number, number] = [totalAtk(g, 0), totalAtk(g, 1)];
  const def: [number, number] = [totalDef(g, 0), totalDef(g, 1)];
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
    // 經驗區中正面的 [經] 卡：傷害計算後的反應（復仇之嚎）
    for (const p of order(g)) {
      for (const card of [...Z(g, p, 'exp')]) {
        if (card.covered || card.zone !== 'exp') continue;
        const sc = scripts[card.id];
        if (sc?.afterDamageExp) yield* sc.afterDamageExp(g, p, card, { dealt: dmg[other(p)], taken: dmg[p] });
      }
    }
  });
  checkWin(g);
}

export function returnStep(g: GameCtx): void {
  g.state.phase = '歸還';
  for (const p of order(g)) {
    // 戰鬥區由最底到最頂，最後是追擊卡
    for (const c of [...Z(g, p, 'combat'), ...Z(g, p, 'pursuit')]) move(g, c, 'exp');
  }
  // 塗毒：歸還時，把 [Ex卡-中毒] 移入出招卡較少那方的經驗區，相同時落入對方
  const f = g.state.flags;
  for (const owner of f.poisonQ) {
    const mine = f.played[owner];
    const theirs = f.played[other(owner)];
    const target = mine < theirs ? owner : other(owner);
    newCard(g, 'Ex卡-中毒', target, 'exp');
    log(g, `【塗毒】[Ex卡-中毒]移入${pname(g, target)}的經驗區`);
  }
  f.poisonQ = [];
  mark(g, '招式與追擊卡依序放入經驗區', { type: 'return' });
}

// ───────────────────────── 戰鬥階段 ─────────────────────────

export function* combatPhase(g: GameCtx): Gen {
  const s = g.state;
  const [first, second] = order(g);

  s.phase = '起手';
  const opening = playables(g, first);
  if (opening.length === 0) {
    const hand = Z(g, first, 'hand').map((c) => data(c).name).join('、') || '（無）';
    log(g, `${pname(g, first)} 沒有可出的招式，展示手牌：${hand}`);
    mark(g, `${pname(g, first)} 沒有可出的招式，展示手牌`, { type: 'info' });
  } else {
    const [c] = yield* chooseCards(g, first, '起手步驟：選擇 1 張招式出招', opening, 1, 1);
    yield* playMove(g, first, c, true);
  }
  s.flags.opened = true;

  s.phase = '反擊';
  let cur: PlayerId = second;
  let firstAction = true;
  // 起手時雙方就被迫收招（即時停損）：沒有進入反擊步驟，不做追擊判定，直接傷害計算
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
        options: [...options.map((c) => cardOpt(c)), { key: 'pass', label: '收招' }],
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
      yield* markIfLogged(g, () => onPassEffects(g, cur));
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
  returnStep(g);
}
