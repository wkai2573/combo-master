import { isVanilla } from '../data/enabledCards';
import {
  ask, cardOpt, chooseCards, combatZone, data, discard, draw, log, mark, markIfLogged, move,
  order, pname, takeDamage, Z, type GameCtx, type Gen,
} from './ops';
import { canPay, pay } from './cost';
import { fire, fireEach, moveRules, query } from './effects';
import { NO_MOVE_RULES } from './effectKit';
import { checkWin } from './win';
import { other, type CardInst, type PlayerId } from './types';

// ───────────────────────── 範圍內／可出招判定 ─────────────────────────

/** 該卡是否在 p 的「範圍內」：雙方招式卡疊最後一張招式的連擊值（含）之間 */
export function inRange(g: GameCtx, p: PlayerId, c: CardInst): boolean {
  const mine = Z(g, p, 'moves');
  const opp = Z(g, other(p), 'moves');
  if (mine.length === 0 || opp.length === 0) return true;
  const m = data(mine[mine.length - 1]).combo;
  const o = data(opp[opp.length - 1]).combo;
  const v = data(c).combo;
  return v >= Math.min(m, o) && v <= Math.max(m, o);
}

/** p 目前可以打出的招式（手牌）；opening 為先手步驟，只能在先手步驟出招的卡只有這時才算 */
export function playables(g: GameCtx, p: PlayerId, opening = false): CardInst[] {
  const cands = Z(g, p, 'hand').filter((c) => data(c).kind === 'move');
  return cands.filter((c) => {
    const rules = moveRules(c.id);
    if (rules.openingOnly && !opening) return false;
    if (rules.playCover > 0 && !canPay(g, p, { cover: rules.playCover })) return false;
    return inRange(g, p, c) && (g.state.flags.breaksRemaining[p] > 0 || !repeatsTopCombo(g, p, c));
  });
}

function repeatsTopCombo(g: GameCtx, p: PlayerId, card: CardInst): boolean {
  const top = Z(g, p, 'moves').at(-1);
  return top !== undefined && data(top).combo === data(card).combo;
}

/** 破格+X：增加我方本回合可用的破格次數 */
export function addBreaks(g: GameCtx, p: PlayerId, count: number): void {
  g.state.flags.breaksRemaining[p] += count;
}

// ───────────────────────── 出招 ─────────────────────────

export function* playMove(g: GameCtx, p: PlayerId, card: CardInst, opening: boolean, zone: 'moves' | 'stunt' = 'moves'): Gen {
  if (zone === 'stunt' || repeatsTopCombo(g, p, card)) g.state.flags.breaksRemaining[p]--;
  move(g, card, zone, 'top');
  g.state.flags.played[p]++;
  const action = zone === 'stunt' ? '特技出招' : opening ? '先手出招' : '出招';
  log(g, `${pname(g, p)} ${action}【${data(card).name}】`);
  const cd = data(card);
  mark(g, `${pname(g, p)} ${action}【${cd.name}】　攻${cd.atk}　連擊${cd.combo}　守${cd.def}`,
    { type: 'play', player: p, uid: card.uid });

  // 出招時必須支付的費用（嘲諷的蓋2）：先付，再處理出招時的效果
  const playCover = moveRules(card.id).playCover;
  if (playCover > 0) {
    log(g, `${pname(g, p)} 出招需支付蓋${playCover}`);
    yield* pay(g, p, { cover: playCover });
  }

  // 先手出招同時是「先手出招時」與「打出時」，兩者的效果進同一個窗口
  const passedBefore = [...g.state.passed];
  yield* fire(g, p, opening ? (['onOpen', 'onPlay'] as const) : 'onPlay', { card });
  checkWin(g);
  // 打出時的效果結算完之後，雙方各開一次出招時的窗口，先攻方先：出招者是「我方打出招式時」，另一方是「對方出招時」
  for (const q of order(g)) yield* fire(g, q, q === p ? 'onMyPlay' : 'onFoePlay', { card });
  checkWin(g);
  // 效果讓玩家被迫收招（Explosion!、即時停損）也是收招：窗口結算完，各自開「收招時」的窗口，先攻方先
  for (const q of order(g)) {
    if (g.state.passed[q] && !passedBefore[q]) {
      yield* markIfLogged(g, () => fire(g, q, 'onPass'));
      yield* markIfLogged(g, () => fire(g, other(q), 'onFoePass'));
    }
  }
}

// ───────────────────────── 追擊判定 ─────────────────────────

/** 這張卡被翻出做追擊判定時會不會成功：必須是招式；追擊判定失敗的卡一律失敗，必定成功的卡一律成功，其餘看連擊值在不在範圍內 */
export function pursuitWouldSucceed(g: GameCtx, p: PlayerId, card: CardInst): boolean {
  if (data(card).kind !== 'move') return false;
  const rules = moveRules(card.id);
  return !rules.pursuitFails && (rules.pursuitSucceeds || !inRange(g, p, card));
}

export function* becomePursuitCard(g: GameCtx, p: PlayerId, card: CardInst): Gen {
  move(g, card, 'pursuit');
  g.state.flags.pursuitSuccess[p]++;
  log(g, `追擊成功：【${data(card).name}】成為追擊卡`);
  mark(g, `追擊成功！【${data(card).name}】成為追擊卡（攻擊 +${data(card).atk}）`,
    { type: 'flipResult', player: p, cardId: card.id, ok: true });
  // 追擊成功時：角色與常駐效果，和該卡自己的 [追] 效果進同一個窗口
  yield* fire(g, p, ['onPursuitSuccess', 'onPursuitCard'], { card });
}

/** 對 card 做追擊判定。回傳是否成功。 */
export function* judge(g: GameCtx, p: PlayerId, card: CardInst): Gen<boolean> {
  const cd = data(card);
  const isMove = cd.kind === 'move';
  const desc = isMove ? `（連擊值 ${cd.combo}）` : '（非招式卡）';

  log(g, `${pname(g, p)} 追擊判定：翻開【${cd.name}】${desc}`);
  mark(g, `${pname(g, p)} 追擊判定：翻開【${cd.name}】${desc}`,
    { type: 'flip', player: p, cardId: card.id });

  const success = pursuitWouldSucceed(g, p, card);
  if (success) {
    yield* becomePursuitCard(g, p, card);
    return true;
  }
  log(g, '追擊判定失敗，該卡加入手中');
  move(g, card, 'hand');
  const failReason = isMove
    ? `【${cd.name}】的連擊值 ${cd.combo} 在範圍內`
    : `【${cd.name}】為非招式卡`;
  mark(g, `追擊失敗：${failReason}，加入手中`,
    { type: 'flipResult', player: p, cardId: card.id, ok: false });
  return false;
}

// ───────────────────────── 追擊階段與流程 ─────────────────────────

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
    const hit = pursuitWouldSucceed(g, p, top);
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

function* afterJudge(g: GameCtx, p: PlayerId, card: CardInst): Gen<boolean> {
  const ok = yield* judge(g, p, card);
  if (!ok) yield* fire(g, p, 'afterPursuitFail', { flipExtra: () => judge(g, p, Z(g, p, 'deck')[0]) });
  return ok;
}

/**
 * 效果在非追擊階段呼叫的單次追擊判定：翻開 p 牌組頂的 1 張卡，照標準規則判定成敗並處理連動
 * （成功成為追擊卡並觸發 [追] 與追擊成功時的效果；失敗加入手牌並開追擊失敗後的窗口）。
 * 範圍照標準規則算：任一方招式卡疊沒有招式時所有連擊值都在範圍內，所以判定必定失敗。
 * 追擊階段「任一方沒有招式就不翻牌」的通則只管追擊階段，不管這次判定，也不取代追擊階段的判定。牌組沒有牌就不翻
 */
export function* judgeTop(g: GameCtx, p: PlayerId): Gen<boolean> {
  const top = Z(g, p, 'deck')[0];
  if (!top) {
    log(g, `${pname(g, p)} 的牌組沒有牌，無法做追擊判定`);
    return false;
  }
  return yield* afterJudge(g, p, top);
}

export function* pursuitPhase(g: GameCtx): Gen {
  g.state.phase = '追擊';
  mark(g, '追擊階段：雙方翻開牌組頂的牌做追擊判定', { type: 'banner', kind: 'phase', name: '追擊階段' });
  for (const p of order(g)) yield* pursuitStep(g, p);
  checkWin(g);
}

// ───────────────────────── 總攻擊／總防禦與結算明細 ─────────────────────────

export interface CombatStatsBreakdown {
  combatZoneAtk: number;
  combatZoneDef: number;
  /** 盾擊把攻擊力補到原始防禦力的總增加量 */
  shieldLift: number;
  pursuitAtk: number;
  pursuitDef: number;
  flagBonusAtk: number;
  flagBonusDef: number;
  vanillaBonus: number;
  charBonusAtk: number;
  charBonusDef: number;
}

export interface CombatStats {
  atk: number;
  def: number;
  breakdown: CombatStatsBreakdown;
}

/** 我方戰鬥區白板卡（無特徵、無效果的招式）數量 */
function vanillaCount(g: GameCtx, p: PlayerId): number {
  return combatZone(g, p).filter((c) => isVanilla(data(c))).length;
}

/** 完整結算該玩家目前的攻守數據與明細 */
export function resolveCombatStats(g: GameCtx, p: PlayerId): CombatStats {
  const stacks = [Z(g, p, 'moves'), Z(g, p, 'stunt')];
  // 狂戰：我方戰鬥區卡片效果全部無效，[頂] 與 [追] 的數值修正都不算，只剩卡面數值
  const voided = query(g, p, 'combatEffectsVoid');
  const rulesOf = (c: CardInst) => (voided ? NO_MOVE_RULES : moveRules(c.id));
  let combatZoneAtk = 0;
  let combatZoneDef = 0;
  let shieldLift = 0;

  // [頂] 盾擊：位於招式卡疊最上方時，戰鬥區（含追擊卡疊）每張招式卡的攻擊力至少是它的原始防禦力（先補，再套用其他加成與修正）
  const lift = stacks.some((stack) => {
    const top = stack.at(-1);
    return top && rulesOf(top).liftAtkToDef;
  });

  // 盾擊補的攻擊力累計進 shieldLift
  const liftedAtk = (c: CardInst): number => {
    const printedAtk = data(c).atk;
    const atk = lift ? Math.max(printedAtk, data(c).def) : printedAtk;
    shieldLift += atk - printedAtk;
    return atk;
  };

  for (const stack of stacks) {
    const top = stack.at(-1);
    for (const card of stack) {
      const rules = rulesOf(card);
      const atkMod = card === top ? rules.topAtk : 0;
      const defMod = card === top ? rules.topDef : 0;
      combatZoneAtk += Math.max(0, liftedAtk(card) + atkMod);
      combatZoneDef += Math.max(0, data(card).def + defMod);
    }
  }

  let pursuitAtk = 0;
  let pursuitDef = 0;
  for (const c of Z(g, p, 'pursuit')) {
    const rules = rulesOf(c);
    const atk = liftedAtk(c);
    pursuitAtk += atk + rules.pursuitAtk;
    pursuitDef += rules.pursuitDef;
  }

  const flagBonusAtk = query(g, p, 'flatAtk');
  const flagBonusDef = query(g, p, 'flatDef');
  const vanillaBonus = query(g, p, 'vanillaBoost') * vanillaCount(g, p);

  // 基礎攻擊力（未加角色被動前）
  const baseAtk = Math.max(0, combatZoneAtk + pursuitAtk + flagBonusAtk + vanillaBonus);
  let baseDef = Math.max(0, combatZoneDef + pursuitDef + flagBonusDef + vanillaBonus);

  // 角色專屬攻防修正
  const bonus = query(g, p, 'combatBonus', { baseAtk });
  if (bonus.pursuitDef) {
    pursuitDef += bonus.pursuitDef;
    baseDef += bonus.pursuitDef;
  }

  return {
    atk: baseAtk + bonus.atk,
    def: baseDef + bonus.def,
    breakdown: {
      combatZoneAtk,
      combatZoneDef,
      shieldLift,
      pursuitAtk,
      pursuitDef,
      flagBonusAtk,
      flagBonusDef,
      vanillaBonus,
      charBonusAtk: bonus.atk,
      charBonusDef: bonus.def,
    },
  };
}

/** 相容轉接器：取得總攻擊 */
export function totalAtk(g: GameCtx, p: PlayerId): number {
  return resolveCombatStats(g, p).atk;
}

/** 相容轉接器：取得總防禦 */
export function totalDef(g: GameCtx, p: PlayerId): number {
  return resolveCombatStats(g, p).def;
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
  // 傷害計算時：傷害算出來了、還沒放進怒氣區。進觸發窗口，先攻方先處理完自己的窗口再換後攻方；
  // 窗口裡的效果直接改 damagePending，先發動的效果會影響後面的條件，例如減免了傷害，復仇之嚎的比較也跟著變
  g.state.flags.damagePending = [dmg[0], dmg[1]];
  yield* markIfLogged(g, function* (): Gen {
    yield* fireEach(g, 'onDamage');
  });
  const final = g.state.flags.damagePending;
  for (const p of order(g)) {
    g.state.flags.damageTaken[p] = final[p];
    takeDamage(g, p, final[p]);
  }
  mark(
    g,
    final[0] + final[1] === 0
      ? '雙方都沒有受到傷害'
      : [0, 1].filter((p) => final[p] > 0).map((p) => `${pname(g, p as PlayerId)} 受到 ${final[p]} 傷害（牌組放入怒氣區）`).join('　'),
    { type: 'damage', dmg: [final[0], final[1]] },
  );
  checkWin(g);
}

export function* returnStep(g: GameCtx): Gen {
  g.state.phase = '歸還';
  // 歸還時，卡還在戰鬥區：整理魔導書在這裡數白板卡並抽牌
  yield* fireEach(g, 'beforeReturn');
  checkWin(g);
  const count: [number, number] = [0, 0];
  for (const p of order(g)) {
    // 依戰鬥區的牌疊順序歸還，各疊由底到頂
    for (const c of combatZone(g, p)) {
      move(g, c, 'exp');
      count[p]++;
    }
  }
  // 塗毒：歸還時，把 [Ex-中毒] 移入出招卡較少那方的經驗區，相同時落入對方
  yield* fireEach(g, 'afterReturn');
  mark(g, '戰鬥區的卡依序放入經驗區', { type: 'return', count });
}

// ───────────────────────── 戰鬥階段 ─────────────────────────

function stuntCosts(g: GameCtx, p: PlayerId, card: CardInst): CardInst[] {
  if (g.state.phase !== '反擊' || Z(g, p, 'moves').length === 0) return [];
  if (g.state.flags.breaksRemaining[p] <= 0) return [];
  const hand = Z(g, p, 'hand');
  const printed = data(card);
  if (!hand.includes(card) || printed.kind !== 'move') return [];
  const rules = moveRules(card.id);
  if (rules.openingOnly || !canPay(g, p, { cover: rules.playCover })) return [];
  // 裝備與增益資料以 0 填補未印在卡面上的連擊值。
  return hand.filter((cost) => {
    const payment = data(cost);
    return cost !== card && payment.combo === printed.combo && (payment.kind === 'move' || payment.combo !== 0);
  });
}

function* chooseStunt(g: GameCtx, p: PlayerId, candidates: CardInst[]): Gen<[CardInst, CardInst] | undefined> {
  const cancel = { key: 'cancel', label: '取消' };
  const [cardKey] = yield* ask(g, {
    player: p, title: '特技出招：選擇要打出的招式', min: 1, max: 1, dropZone: 'stunt',
    options: [...candidates.map((c) => cardOpt(c, p)), cancel],
  });
  const card = candidates.find((c) => `c${c.uid}` === cardKey);
  if (!card) return;
  const costs = stuntCosts(g, p, card);
  if (costs.length === 0) return;
  const [costKey] = yield* ask(g, {
    player: p, title: `特技出招：選擇要為「${data(card).name}」捨棄的同連擊值手牌`, min: 1, max: 1,
    options: [...costs.map((c) => cardOpt(c, p)), cancel],
  });
  const cost = costs.find((c) => `c${c.uid}` === costKey);
  if (!cost) return;
  const [confirmed] = yield* ask(g, {
    player: p, title: `捨棄「${data(cost).name}」，打出特技「${data(card).name}」？`, min: 1, max: 1,
    options: [{ key: 'confirm-stunt', label: '確認特技出招' }, cancel],
  });
  if (confirmed === 'confirm-stunt' && stuntCosts(g, p, card).includes(cost)) return [cost, card];
}

function* counter(g: GameCtx, p: PlayerId, previous: CardInst | undefined): Gen<CardInst | undefined> {
  while (true) {
    const normal = playables(g, p);
    const stunts = Z(g, p, 'hand').filter((card) => stuntCosts(g, p, card).length > 0);
    if (normal.length === 0 && stunts.length === 0) return;
    const target = previous?.zone === 'stunt' ? `（上一招「${data(previous).name}」）` : '';
    const [key] = yield* ask(g, {
      player: p,
      title: `反擊步驟${target}：選擇 1 張招式出招、或收招`,
      min: 1, max: 1, dropZone: 'moves',
      options: [
        ...normal.map((c) => cardOpt(c, p)),
        ...(stunts.length > 0 ? [{ key: 'stunt', label: '特技出招' }] : []),
        { key: 'pass', label: '收招' },
      ],
    });
    if (key === 'pass') return;
    if (key === 'stunt' && stunts.length > 0) {
      const pair = yield* chooseStunt(g, p, stunts);
      if (!pair) continue;
      const [cost, card] = pair;
      discard(g, cost);
      log(g, `${pname(g, p)} 捨棄「${data(cost).name}」支付特技出招代價`);
      yield* playMove(g, p, card, false, 'stunt');
      return card;
    }
    const card = normal.find((c) => `c${c.uid}` === key);
    if (!card) continue;
    yield* playMove(g, p, card, false);
    return card;
  }
}

export function* combatPhase(g: GameCtx): Gen {
  const s = g.state;
  const [first, second] = order(g);

  s.phase = '先手';
  const opening = playables(g, first, true);
  if (opening.length === 0) {
    const hand = Z(g, first, 'hand').map((c) => data(c).name).join('、') || '（無）';
    log(g, `${pname(g, first)} 沒有可出的招式，展示手牌：${hand}`);
    mark(g, `${pname(g, first)} 沒有可出的招式，展示手牌`, { type: 'info' });
  } else {
    const [c] = yield* chooseCards(g, first, '先手步驟：選擇 1 張招式出招', opening, 1, 1, 'moves');
    yield* playMove(g, first, c, true);
  }
  s.flags.opened = true;

  s.phase = '反擊';
  let cur: PlayerId = second;
  let firstAction = true;
  let previous: CardInst | undefined;
  // 先手步驟時雙方就被迫收招（即時停損）：沒有進入反擊步驟，不做追擊判定，直接傷害計算
  let straightToDamage = s.passed[0] && s.passed[1];
  for (let guard = 0; guard < 200 && !(s.passed[0] && s.passed[1]); guard++) {
    if (s.passed[cur]) {
      cur = other(cur);
      continue;
    }
    const playedCard = yield* counter(g, cur, previous?.owner === other(cur) ? previous : undefined);
    if (playedCard) {
      previous = playedCard;
    } else {
      s.passed[cur] = true;
      log(g, `${pname(g, cur)} 收招`);
      // 後攻方第一個動作就收招：先攻方不能再出招，直接傷害計算；嘲諷讓先攻方可以繼續出招
      const direct = firstAction && cur === second && !query(g, first, 'continueAfterFoePass');
      mark(g, `${pname(g, cur)} 收招${direct ? '，直接進入傷害計算' : ''}`, { type: 'pass', player: cur });
      yield* markIfLogged(g, () => fire(g, cur, 'onPass'));
      yield* markIfLogged(g, () => fire(g, other(cur), 'onFoePass'));
      if (direct) {
        straightToDamage = true;
        break;
      }
    }
    firstAction = false;
    cur = other(cur);
  }

  if (!straightToDamage) {
    // 追擊通則：只要有一方的招式卡疊沒有招式，就不追擊，雙方都不翻牌
    if (Z(g, 0, 'moves').length > 0 && Z(g, 1, 'moves').length > 0) yield* pursuitPhase(g);
    else log(g, '有一方沒有出招，不進行追擊');
  }
  yield* damageStep(g);
  yield* returnStep(g);
  yield* fireEach(g, 'onAwaken'); // 歸還讓經驗區增加，可能進入覺醒
}
