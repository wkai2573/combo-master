import { getCharacter } from '../data/cards';
import { combatPhase } from './combat';
import { merchantAfterBurst, turnStartEffects } from './scripts';
import {
  ask, awakened, cardOpt, data, draw, drawPlain, GameOver, log, mark, move, newCard,
  markIfLogged, optionalPay, order, pname, toExp, Z, type Gen,
} from './ops';
import { Rng } from './rng';
import { checkWin } from './win';
import { viewFor, type RawFrame } from './view';
import {
  FRAME_MS, other, type CardInst, type FrameFx, type GameSetup, type GameState, type Phase, type PlayerId, type PlayerState,
  type Request, type TurnFlags, type ZoneName,
} from './types';

const ZONES: ZoneName[] = ['deck', 'hand', 'discard', 'rage', 'exp', 'combat', 'pursuit', 'gear', 'buff'];

function emptyFlags(): TurnFlags {
  return {
    played: [0, 0], opened: false, pursuitPlus: [0, 0], pursuitSuccess: [0, 0],
    rabbitUsed: [false, false], aimUsed: [0, 0], atkBonus: [0, 0], aimUp: [0, 0], vanillaBoost: [0, 0], poisonQ: [],
    skipDraw: [false, false], damageTaken: [0, 0],
  };
}

function emptyPlayer(id: PlayerId, charId: string): PlayerState {
  const zones = {} as Record<ZoneName, CardInst[]>;
  for (const z of ZONES) zones[z] = [];
  return { id, charId, zones };
}

export class Game {
  state: GameState;
  rng: Rng;
  nextUid = 1;
  /** 目前等待回應的提示；遊戲結束時為 null */
  pending: Request | null = null;
  private it: Generator<Request, void, string[]>;
  private frames: RawFrame[] = [];

  /** 取出並清空自上次以來錄下的動畫影格 */
  drainFrames(): RawFrame[] {
    const out = this.frames;
    this.frames = [];
    return out;
  }

  frame = (caption: string, fx: FrameFx): void => {
    if (!this.setup.animate) return;
    this.frames.push({
      views: [viewFor(this, 0, false), viewFor(this, 1, false)],
      logLen: this.state.log.length, caption, fx, ms: FRAME_MS[fx.type],
    });
  };

  constructor(private setup: GameSetup) {
    this.rng = new Rng(setup.seed);
    this.state = {
      players: [emptyPlayer(0, setup.decks[0].charId), emptyPlayer(1, setup.decks[1].charId)],
      first: 0, turn: 0, phase: '設置', flags: emptyFlags(), passed: [false, false],
      log: [], winner: null, winReason: '',
    };
    this.it = this.run();
    this.advance(undefined);
  }

  get over(): boolean {
    return this.state.winner !== null;
  }

  /** 玩家離線或認輸：對手獲勝 */
  forfeit(player: PlayerId, reason: string): void {
    if (this.over) return;
    this.state.winner = other(player);
    this.state.winReason = reason;
    this.state.phase = '結束';
    this.pending = null;
    log(this, `${pname(this, other(player))} 獲勝（${reason}）`);
  }

  /** 玩家回應目前的提示（回應為被選擇的選項 key） */
  submit(player: PlayerId, keys: string[]): void {
    const req = this.pending;
    if (!req) throw new Error('目前沒有待回應的提示');
    if (req.player !== player) throw new Error('還沒輪到這位玩家');
    const valid = new Set(req.options.map((o) => o.key));
    if (keys.length < req.min || keys.length > req.max) throw new Error('選擇的數量不合法');
    if (new Set(keys).size !== keys.length || keys.some((k) => !valid.has(k))) throw new Error('選項不合法');
    this.advance(keys);
  }

  private advance(resp: string[] | undefined): void {
    try {
      const r = this.it.next(resp as string[]);
      this.pending = r.done ? null : r.value;
    } catch (e) {
      if (e instanceof GameOver) {
        this.pending = null;
        return;
      }
      throw e;
    }
  }

  private *run(): Gen {
    const g = this;
    const s = this.state;
    this.setupGame();
    this.setup.afterSetup?.(this);
    checkWin(g);
    if (this.setup.singlePhase && this.setup.startPhase) {
      s.turn = 1;
      yield* this.runSinglePhase(this.setup.startPhase);
      s.phase = '結束';
      return;
    }

    while (!this.over) {
      s.turn++;
      s.flags = emptyFlags();
      s.passed = [false, false];
      log(g, `── 第 ${s.turn} 回合（先攻：${pname(g, s.first)}）──`);

      const start = s.turn === 1 ? this.setup.startPhase : undefined;

      if (!start || start === '重置') {
        s.phase = '重置';
        // 橫置狀態的卡改為重置狀態：目前沒有卡片使用橫置，保留階段供日後擴充
        // 回合開始時的效果：家族相片、凡骨的意志、中毒
        yield* markIfLogged(g, () => turnStartEffects(g));
        checkWin(g);
      }
      if (!start || start === '重置' || start === '起手' || start === '反擊' || start === '追擊' || start === '傷害' || start === '歸還') {
        mark(g, `第 ${s.turn} 回合・戰鬥階段（先攻：${pname(g, s.first)}）`, { type: 'phase' });
        yield* combatPhase(g);
      }
      if (!start || start === '重置' || start === '起手' || start === '反擊' || start === '追擊' || start === '傷害' || start === '歸還' || start === '抽牌') {
        yield* drawPhase(g);
      }
      if (!start || start === '重置' || start === '起手' || start === '反擊' || start === '追擊' || start === '傷害' || start === '歸還' || start === '抽牌' || start === '爆發') {
        yield* burstPhase(g);
      }
      yield* buffPhase(g);

      s.phase = '回合結束';
      s.first = other(s.first);
      mark(g, '回合結束：交換先攻與後攻', { type: 'phase' });
      checkWin(g);
    }
  }

  private *runSinglePhase(phase: Phase): Gen {
    const g = this;
    const s = this.state;
    switch (phase) {
      case '重置':
        s.phase = '重置';
        yield* markIfLogged(g, () => turnStartEffects(g));
        break;
      case '起手':
      case '反擊':
      case '追擊':
      case '傷害':
      case '歸還':
        yield* combatPhase(g);
        break;
      case '抽牌':
        yield* drawPhase(g);
        break;
      case '爆發':
        yield* burstPhase(g);
        break;
      case '增益':
        yield* buffPhase(g);
        break;
    }
    checkWin(g);
  }

  private setupGame(): void {
    const s = this.state;
    const { decks, noShuffle } = this.setup;
    for (const p of [0, 1] as PlayerId[]) {
      for (const id of decks[p].cards) newCard(this, id, p, 'deck');
      if (!noShuffle) this.rng.shuffle(s.players[p].zones.deck);
    }
    s.first = this.setup.first ?? (this.rng.int(2) as PlayerId);
    log(this, `先攻：${pname(this, s.first)}`);
    for (const p of [0, 1] as PlayerId[]) {
      const extra = getCharacter(decks[p].charId).id === '法師' ? 2 : 0;
      drawPlain(this, p, 5 + extra);
    }
  }
}

// ───────────────────────── 抽牌／爆發／增益階段 ─────────────────────────

function* drawPhase(g: Game): Gen {
  g.state.phase = '抽牌';
  const skipped: PlayerId[] = [];
  for (const p of order(g)) {
    // Explosion!：跳過抽牌階段（連法師覺醒的額外抽牌一起跳過）
    if (g.state.flags.skipDraw[p]) {
      skipped.push(p);
      log(g, `【Explosion!】${pname(g, p)} 跳過抽牌階段`);
      continue;
    }
    yield* draw(g, p, 1);
    if (g.state.players[p].charId === '法師' && awakened(g, p)) {
      yield* draw(g, p, 1);
      log(g, `【法師】${pname(g, p)} 抽牌階段額外抽 1`);
    }
  }
  mark(g, skipped.length ? `抽牌階段：${skipped.map((p) => pname(g, p)).join('、')} 跳過` : '抽牌階段：雙方各抽 1 張', { type: 'draw' });
  checkWin(g);
}

function* burstPhase(g: Game): Gen {
  g.state.phase = '爆發';
  for (const p of order(g)) {
    const hand = Z(g, p, 'hand');
    if (hand.length === 0) continue;
    const keys = yield* ask(g, {
      player: p, title: '爆發階段：可選擇 1 張手牌放入經驗區，然後抽 2', min: 0, max: 1,
      options: hand.map((c) => cardOpt(c)),
    });
    if (keys.length === 0) continue;
    const card = hand.find((c) => `c${c.uid}` === keys[0])!;
    toExp(g, card);
    log(g, `${pname(g, p)} 爆發：將【${data(card).name}】放入經驗區`);
    yield* draw(g, p, 2);
    mark(g, `${pname(g, p)} 爆發：1 張手牌放入經驗區，抽 2`, { type: 'info' });
    // 招財貓：[蓋2] 爆發時，額外抽 1
    const cat = Z(g, p, 'gear').find((c) => c.id === '招財貓');
    if (cat && (yield* optionalPay(g, p, cat, { cover: 2 }))) {
      yield* draw(g, p, 1);
      log(g, `【招財貓】${pname(g, p)} 爆發時額外抽 1`);
      mark(g, g.state.log[g.state.log.length - 1], { type: 'info' });
    }
    yield* markIfLogged(g, () => merchantAfterBurst(g, p));
  }
  checkWin(g);
}

function* buffPhase(g: Game): Gen {
  g.state.phase = '增益';
  const logBefore = g.state.log.length;
  // 增益階段開始時：增益的持續時間指示物（目前沒有增益卡有效果，只負責到期放入經驗區）
  for (const p of order(g)) {
    for (const b of [...Z(g, p, 'buff')]) {
      b.counters++;
      if (b.counters >= (data(b).duration ?? Infinity)) {
        log(g, `增益【${data(b).name}】持續時間結束，放入經驗區`);
        toExp(g, b);
      }
    }
  }
  if (g.state.log.length > logBefore) mark(g, g.state.log[g.state.log.length - 1], { type: 'info' });
  // 回合 1 次：打出 1 張裝備或增益
  for (const p of order(g)) {
    const exp = Z(g, p, 'exp').length;
    const gear = Z(g, p, 'gear');
    const buffs = Z(g, p, 'buff');
    const options = Z(g, p, 'hand').filter((c) => {
      const d = data(c);
      if (d.kind === 'move' || exp < d.expReq) return false;
      if (d.kind === 'equip') return !gear.some((x) => data(x).slot === d.slot);
      return !buffs.some((x) => x.id === c.id);
    });
    if (options.length === 0) continue;
    const keys = yield* ask(g, {
      player: p, title: '增益階段：可打出 1 張裝備或增益', min: 0, max: 1,
      options: options.map((c) => cardOpt(c)),
    });
    if (keys.length === 0) continue;
    const card = options.find((c) => `c${c.uid}` === keys[0])!;
    move(g, card, data(card).kind === 'equip' ? 'gear' : 'buff');
    log(g, `${pname(g, p)} 打出${data(card).kind === 'equip' ? '裝備' : '增益'}【${data(card).name}】`);
    mark(g, g.state.log[g.state.log.length - 1], { type: 'info' });
  }
  checkWin(g);
}
