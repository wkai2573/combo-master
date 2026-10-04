import { isTrap } from '../data/cards';
import {
  ask, awakened, canPay, cardOpt, chooseCards, data, discard, draw, isFirst, log, mark, markIfLogged, move, optionalPay,
  order, pay, pname, takeDamage, topOfZone, Z, type GameCtx, type Gen,
} from './ops';
import { scripts } from './scripts';
import { checkWin } from './win';
import { other, type CardInst, type PlayerId } from './types';

// ───────────────────────── 範圍內／可出招判定 ─────────────────────────

/** 該卡是否在 p 的「範圍內」。forPlay：出招時（3連擊 可視為 6 或 8） */
export function inRange(g: GameCtx, p: PlayerId, c: CardInst, forPlay: boolean): boolean {
  const mine = Z(g, p, 'combat');
  const opp = Z(g, other(p), 'combat');
  if (mine.length === 0 || opp.length === 0) return true;
  const mTop = mine[mine.length - 1];
  const oVal = data(opp[opp.length - 1]).combo;
  const mVals = [data(mTop).combo, ...(forPlay ? scripts[mTop.id]?.comboAlt ?? [] : [])];
  const v = data(c).combo;
  return mVals.some((m) => v >= Math.min(m, oVal) && v <= Math.max(m, oVal));
}

/** p 目前可以打出的招式（手牌；先手時含經驗區的先祖圖騰） */
export function playables(g: GameCtx, p: PlayerId, opening: boolean): CardInst[] {
  const cands = Z(g, p, 'hand').filter((c) => data(c).kind === 'move');
  if (isFirst(g, p)) {
    cands.push(...Z(g, p, 'exp').filter((c) => !c.covered && c.id === '先祖圖騰'));
  }
  // 戰鬥區已有「重複連擊值」（同值 2 張）時，就不能再打出同連擊值的卡
  const copies = new Map<number, number>();
  for (const c of Z(g, p, 'combat')) copies.set(data(c).combo, (copies.get(data(c).combo) ?? 0) + 1);
  return cands.filter(
    (c) => !(opening && scripts[c.id]?.noOpen) && inRange(g, p, c, true) && (copies.get(data(c).combo) ?? 0) < MAX_SAME_COMBO,
  );
}

/** 同一連擊值在自己的戰鬥區最多 2 張（第 1 次重複可以，已重複就不能再出） */
const MAX_SAME_COMBO = 2;

// ───────────────────────── 出招 ─────────────────────────

export function* playMove(g: GameCtx, p: PlayerId, card: CardInst, opening: boolean): Gen {
  const f = g.state.flags;
  const opp = other(p);
  const oppTop = topOfZone(g, opp);
  const combo = data(card).combo;
  const fromExp = card.zone === 'exp';
  move(g, card, 'combat', 'top');
  f.played[p]++;
  log(g, `${pname(g, p)} ${opening ? '起手' : '出招'}【${data(card).name}】${fromExp ? '（自經驗區）' : ''}`);
  const cd = data(card);
  mark(g, `${pname(g, p)} ${opening ? '起手' : '出招'}【${cd.name}】　攻${cd.atk}　連擊${cd.combo}　守${cd.def}`,
    { type: 'play', player: p, uid: card.uid });

  const sc = scripts[card.id];
  if (f.alchemy[p]) {
    const rage = Z(g, p, 'rage');
    if (rage.length > 0) move(g, rage[0], 'deck', 'top');
    log(g, '【煉金印記】回復 1');
  }
  if (f.sniper[p] && sc?.onPlay) {
    const rage = Z(g, p, 'rage');
    if (rage.length > 0) move(g, rage[0], 'hand');
    const [d] = yield* chooseCards(g, p, '【狙擊印記】捨棄 1 張手牌', Z(g, p, 'hand'), 1, 1);
    if (d) discard(g, d);
  }
  if (oppTop?.id === '黑暗詛咒') {
    const front = Z(g, p, 'exp').find((c) => !c.covered);
    if (front) {
      front.covered = true;
      log(g, `【黑暗詛咒】${pname(g, p)} 的經驗【${data(front).name}】被覆蓋`);
    }
  }
  yield* markIfLogged(g, function* (): Gen {
    if (opening && sc?.onOpen) yield* sc.onOpen(g, p, card);
    if (sc?.onPlay) yield* sc.onPlay(g, p, card);
    yield* responseWindows(g, p, card, combo);
  });
  checkWin(g);
}

/** 對手出招時，另一方可插入發動的 [經] 效果（對手的 [發] 已先處理） */
function* responseWindows(g: GameCtx, active: PlayerId, played: CardInst, combo: number): Gen {
  const q = other(active);
  for (let guard = 0; guard < 20; guard++) {
    const cands: CardInst[] = [];
    for (const c of Z(g, q, 'exp')) {
      if (c.covered) continue;
      const m = /^陷阱([3-7])$/.exec(c.id);
      if (m && Number(m[1]) === combo && canPay(g, q, { cover: 1 }, c)) cands.push(c);
      if (c.id === '式不過3' && g.state.flags.played[active] === 4 && played.zone === 'combat' &&
          Z(g, q, 'hand').length >= 1) cands.push(c);
    }
    if (cands.length === 0) return;
    const keys = yield* ask(g, {
      player: q,
      title: `對手打出【${data(played).name}】，是否發動經驗區的效果？`,
      min: 0, max: 1,
      options: cands.map((c) => cardOpt(c)),
    });
    if (keys.length === 0) return;
    const c = cands.find((x) => `c${x.uid}` === keys[0])!;
    if (c.id === '式不過3') {
      const [h] = yield* chooseCards(g, q, '【式不過3】捨棄 1 張手牌', Z(g, q, 'hand'), 1, 1);
      discard(g, c);
      discard(g, h);
      discard(g, played);
      log(g, `【式不過3】${pname(g, q)} 捨棄了對手的【${data(played).name}】`);
      return;
    }
    pay(g, q, { cover: 1 }, c);
    move(g, c, 'combat', 'bottom');
    log(g, `【${data(c).name}】${pname(g, q)} 將其置於戰鬥區底`);
  }
}

// ───────────────────────── 總攻擊／總防禦 ─────────────────────────

/** 刺客「追擊判定成功」加成的總上限 */
export const ASSASSIN_CAP = 5;

export function totalAtk(g: GameCtx, p: PlayerId): number {
  const zone = Z(g, p, 'combat');
  let base = 0;
  zone.forEach((c, i) => {
    const mod = i === zone.length - 1 ? scripts[c.id]?.atkMod ?? 0 : 0;
    base += Math.max(0, data(c).atk + mod);
  });
  for (const c of Z(g, p, 'pursuit')) base += data(c).atk;

  const awake = awakened(g, p);
  let bonus = 0;
  switch (g.state.players[p].charId) {
    case '勇者':
      if (base >= (awake ? 10 : 15)) bonus += 3;
      break;
    case '刺客':
      bonus += Math.min(ASSASSIN_CAP, (awake ? 2 : 1) * g.state.flags.pursuitSuccess[p]);
      break;
    case '商人':
      if (awake && Z(g, p, 'hand').length > 3) bonus += 3;
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
    if (scripts[c.id]?.pursuitDef || (rearGuard && awakened(g, p) && !isFirst(g, p))) total += data(c).def;
  }
  if (rearGuard && !isFirst(g, p)) total += 2;
  return total;
}

// ───────────────────────── 追擊 ─────────────────────────

export function pursuitCount(g: GameCtx, p: PlayerId): number {
  const f = g.state.flags;
  let n = 1 + f.pursuitPlus[p] - f.pursuitMinus[p];
  if (g.state.players[p].charId === '先人' && awakened(g, p) && isFirst(g, p)) n += 1;
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
  const topSc = scripts[topOfZone(g, p)?.id ?? ''];

  if (topSc?.pursuitMode === 'trapSwap' && isTrap(data(card))) {
    move(g, card, 'exp');
    const [t] = yield* chooseCards(
      g, p, '【陷阱變換】選擇經驗區 1 張陷阱作為追擊卡', Z(g, p, 'exp').filter((c) => isTrap(data(c))), 1, 1,
    );
    if (t) {
      yield* becomePursuitCard(g, p, t);
      return true;
    }
    return false;
  }

  const success = !scripts[card.id]?.pursuitFail && !inRange(g, p, card, false);
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
  const count = pursuitCount(g, p);
  const deck = Z(g, p, 'deck');
  const topSc = scripts[topOfZone(g, p)?.id ?? ''];

  if (topSc?.pursuitMode === 'precise' && count > 0) {
    yield* draw(g, p, count);
    const picks = yield* chooseCards(g, p, `【精準追擊】選擇手牌 ${count} 張作為追擊判定`, Z(g, p, 'hand'), count, count);
    for (const c of picks) yield* afterJudge(g, p, c);
    return;
  }
  for (let i = 0; i < count && deck.length > 0; i++) {
    yield* aim(g, p);
    yield* afterJudge(g, p, deck[0]);
  }
}

/**
 * 遊俠・瞄準：追擊判定翻牌前，先看牌組頂 1 張；不想要就放到牌組底，改看下一張。
 * 每回合 1 次（覺醒 2 次）。牌組只剩 1 張時換不到別張，不詢問。
 */
function* aim(g: GameCtx, p: PlayerId): Gen {
  if (g.state.players[p].charId !== '遊俠') return;
  const limit = awakened(g, p) ? 2 : 1;
  const deck = Z(g, p, 'deck');
  while (g.state.flags.aimUsed[p] < limit && deck.length >= 2) {
    const top = deck[0];
    const hit = !scripts[top.id]?.pursuitFail && !inRange(g, p, top, false);
    const keys = yield* ask(g, {
      player: p,
      title: `【瞄準】牌組頂是【${data(top).name}】（連擊值 ${data(top).combo}），以目前範圍會判定${hit ? '成功' : '失敗'}。（剩 ${limit - g.state.flags.aimUsed[p]} 次）`,
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
  const rabbit = Z(g, p, 'gear').find((c) => c.id === '兔腳項鍊');
  const deck = Z(g, p, 'deck');
  if (rabbit && deck.length > 0 && (yield* optionalPay(g, p, rabbit, { cover: 2 }))) {
    g.state.flags.rabbitUsed[p] = true;
    log(g, '【兔腳項鍊】額外翻 1 張卡做追擊判定');
    yield* judge(g, p, deck[0]);
  }
}

export function* pursuitPhase(g: GameCtx): Gen {
  g.state.phase = '追擊';
  mark(g, '追擊階段：雙方翻開牌組頂的牌做追擊判定', { type: 'phase' });
  // 追擊階段開始時：誘餌圖騰
  for (const p of order(g)) {
    const totem = Z(g, p, 'exp').find((c) => !c.covered && c.id === '誘餌圖騰');
    if (totem && canPay(g, p, { cover: 3 }, totem)) {
      const ok = yield* optionalPay(g, p, totem, { cover: 3 }, totem);
      if (ok) {
        discard(g, totem);
        g.state.flags.pursuitMinus[other(p)]++;
        log(g, `【誘餌圖騰】${pname(g, other(p))} 此回合追擊-1`);
      }
    }
  }
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
    for (const p of order(g)) {
      const top = topOfZone(g, p);
      if (!top) continue;
      const sc = scripts[top.id];
      if (sc?.afterDamage) yield* sc.afterDamage(g, p, top, { dealt: dmg[other(p)], taken: dmg[p] });
      if (sc?.keepOrder && dmg[other(p)] > dmg[p]) {
        g.state.flags.noSwap = true;
        log(g, `【${data(top).name}】此回合結束時不交換先後攻`);
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
  mark(g, '招式與追擊卡依序放入經驗區', { type: 'return' });
}

// ───────────────────────── 戰鬥階段 ─────────────────────────

export function* combatPhase(g: GameCtx): Gen {
  const s = g.state;
  const [first, second] = order(g);

  s.phase = '起手';
  const opening = playables(g, first, true);
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
  let straightToDamage = false;
  for (let guard = 0; guard < 200 && !(s.passed[0] && s.passed[1]); guard++) {
    if (s.passed[cur]) {
      cur = other(cur);
      continue;
    }
    const options = playables(g, cur, false);
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
