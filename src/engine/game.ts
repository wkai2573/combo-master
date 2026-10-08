import { cheatAdd, cheatRemove, cheatReorder, cheatSnapshot, cheatSwitch, type CheatSnapshot, type CheatZone } from './cheat';
import { combatPhase } from './combat';
import { fire, fireEach, query } from './effects';
import {
  ask, awakened, cardOpt, data, draw, drawPlain, GameOver, log, mark, move, newCard,
  markIfLogged, order, pname, settle, toExp, Z, type Gen,
} from './ops';
import { Rng } from './rng';
import { checkWin } from './win';
import { diffFlights, flightsTotalMs } from './flights';
import { viewFor, type GameView, type RawFrame } from './view';
import {
  FRAME_MS, other, type CardInst, type FrameFx, type GameSetup, type GameState, type PlayerId, type PlayerState,
  type Request, type StartPhase, type TurnFlags, type ZoneName,
} from './types';

/** 飛行播完後，影格再多停留一下 */
const FLY_BUFFER_MS = 120;

const ZONES: ZoneName[] = ['deck', 'hand', 'discard', 'rage', 'exp', 'combat', 'pursuit', 'gear', 'buff'];

function emptyFlags(): TurnFlags {
  return {
    played: [0, 0], opened: false, pursuitSuccess: [0, 0], damageTaken: [0, 0],
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
  touched = 0;
  /** 目前等待回應的提示；遊戲結束時為 null */
  pending: Request | null = null;
  private it: Generator<Request, void, string[]>;
  private frames: RawFrame[] = [];
  private lastView: GameView | null = null;

  /** 取出並清空自上次以來錄下的動畫影格 */
  drainFrames(): RawFrame[] {
    const out = this.frames;
    this.frames = [];
    return out;
  }

  frame = (caption: string, fx: FrameFx): void => {
    this.touched = 0;
    if (!this.setup.animate) return;
    const views: [GameView, GameView] = [viewFor(this, 0, false), viewFor(this, 1, false)];
    // 這個影格裡有卡片飛行時，停留要夠久，讓整批飛行播完才換下一個影格
    const fly = this.lastView ? flightsTotalMs(diffFlights(this.lastView, views[0])) : 0;
    this.lastView = views[0];
    this.frames.push({
      views, logLen: this.state.log.length, caption, fx,
      ms: Math.max(FRAME_MS[fx.type], fly > 0 ? fly + FLY_BUFFER_MS : 0),
    });
  };

  constructor(private setup: GameSetup) {
    this.rng = new Rng(setup.seed);
    this.state = {
      players: [emptyPlayer(0, setup.decks[0].charId), emptyPlayer(1, setup.decks[1].charId)],
      first: 0, turn: 0, phase: '設置', flags: emptyFlags(), passed: [false, false],
      log: [], winner: null, winReason: '', awakeSeen: [false, false], slots: [{}, {}],
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
    this.frame(`${pname(this, other(player))} 獲勝（${reason}）`, { type: 'gameEnd', winner: other(player) });
  }

  // ───────────────────────── 作弊 ─────────────────────────
  // 不經過提示直接改桌面，用來快速建立想測的場面。操作被拒絕時丟出說明原因的錯誤，且不改動任何東西。
  // 作弊不錄動畫影格；操作後重新檢查勝負（勝負已定就中斷流程）。

  /** 雙方所有牌區的完整內容（含對方手牌、牌組與裏側卡） */
  cheatSnapshot(): CheatSnapshot {
    return cheatSnapshot(this);
  }

  /** by 開啟或關閉作弊模式（只寫紀錄；開關本身由連線層記錄） */
  cheatSwitch(by: PlayerId, on: boolean): void {
    this.cheat(() => cheatSwitch(this, by, on));
  }

  /** by 把一張卡加入 target 的手牌（全卡池，不含 Ex 卡） */
  cheatAdd(by: PlayerId, target: PlayerId, cardId: string): void {
    this.cheat(() => cheatAdd(this, by, target, cardId));
  }

  /** by 把 target 的一張手牌移出遊戲 */
  cheatRemove(by: PlayerId, target: PlayerId, uid: number): void {
    this.cheat(() => cheatRemove(this, by, target, uid));
  }

  /** by 調整 target 某個牌區的順序；uids 是新的順序（牌組與怒氣區的第一張在最上方，經驗區的第一張在最前方） */
  cheatReorder(by: PlayerId, target: PlayerId, zone: CheatZone, uids: number[]): void {
    this.cheat(() => cheatReorder(this, by, target, zone, uids));
  }

  private cheat(op: () => void): void {
    if (this.over) throw new Error('遊戲已結束，不能再使用作弊');
    op();
    // 作弊的變化不演動畫，之後的影格也不把它當成新的變化
    this.touched = 0;
    if (this.setup.animate) this.lastView = viewFor(this, 0, false);
    try {
      checkWin(this);
    } catch (e) {
      if (!(e instanceof GameOver)) throw e;
      this.pending = null;
    }
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
      // 把控制權交還給玩家（或遊戲結束）之前，把還沒呈現的變化補成一個影格
      settle(this);
      this.pending = r.done ? null : r.value;
    } catch (e) {
      if (e instanceof GameOver) {
        settle(this);
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
    // 開局（含測試改寫區域之後）已經覺醒的狀態不算進入覺醒
    s.awakeSeen = [awakened(g, 0), awakened(g, 1)];
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
      s.slots = [{}, {}];
      s.passed = [false, false];
      log(g, `── 第 ${s.turn} 回合（先攻：${pname(g, s.first)}）──`);

      // 起始階段只適用於第 1 回合
      const from = s.turn === 1 && this.setup.startPhase ? phaseIndex(this.setup.startPhase) : 0;
      for (const step of PHASES.slice(from)) yield* step.run(this, true);

      s.phase = '回合結束';
      s.first = other(s.first);
      mark(g, '回合結束：交換先攻與後攻', { type: 'phase' });
      checkWin(g);
    }
  }

  private *runSinglePhase(phase: StartPhase): Gen {
    yield* PHASES[phaseIndex(phase)].run(this, false);
    checkWin(this);
  }

  private setupGame(): void {
    const s = this.state;
    const { decks, noShuffle } = this.setup;
    for (const p of [0, 1] as PlayerId[]) {
      for (const id of decks[p].cards) newCard(this, id, p, 'deck');
      if (!noShuffle) this.rng.shuffle(s.players[p].zones.deck);
    }
    mark(this, '雙方牌組洗牌', { type: 'shuffle' });
    s.first = this.setup.first ?? (this.rng.int(2) as PlayerId);
    log(this, `先攻：${pname(this, s.first)}`);
    for (const p of [0, 1] as PlayerId[]) {
      drawPlain(this, p, 5 + query(this, p, 'openingDraw'));
    }
    mark(this, '雙方抽起始手牌', { type: 'deal' });
  }
}

// ───────────────────────── 階段表 ─────────────────────────

/** 回合內的階段順序，只在這裡寫一次：完整對局從起點往後依序跑，單階段只跑起點那一項 */
const PHASES: { start: StartPhase; run: (g: Game, full: boolean) => Gen }[] = [
  {
    start: '重置',
    // 橫置狀態的卡改為重置狀態：目前沒有卡片使用橫置，保留階段供日後擴充
    // 回合開始時的效果：家族相片、凡骨的意志、中毒
    *run(g) {
      g.state.phase = '重置';
      yield* markIfLogged(g, () => fireEach(g, 'turnStart'));
      checkWin(g);
    },
  },
  {
    start: '先手',
    // 戰鬥階段整塊是一項：內部的反擊、追擊、傷害、歸還不能單獨進入
    *run(g, full) {
      const s = g.state;
      if (full) mark(g, `第 ${s.turn} 回合・戰鬥階段（先攻：${pname(g, s.first)}）`, { type: 'banner', kind: 'turn', turn: s.turn, first: s.first });
      yield* combatPhase(g);
    },
  },
  { start: '抽牌', run: drawPhase },
  { start: '爆發', run: burstPhase },
  { start: '增益', run: buffPhase },
];

/** 起點在階段表裡的位置；不認得的起點直接報錯，不悄悄跑錯階段 */
function phaseIndex(start: StartPhase): number {
  const i = PHASES.findIndex((x) => x.start === start);
  if (i < 0) throw new Error(`不能從「${start}」階段開始`);
  return i;
}

// ───────────────────────── 抽牌／爆發／增益階段 ─────────────────────────

function* drawPhase(g: Game): Gen {
  g.state.phase = '抽牌';
  const skipped: PlayerId[] = [];
  for (const p of order(g)) {
    // 跳過抽牌階段時，連額外抽牌一起跳過
    if (query(g, p, 'skipDrawPhase')) {
      skipped.push(p);
      log(g, `${pname(g, p)} 跳過抽牌階段`);
      continue;
    }
    yield* draw(g, p, 1);
    const more = query(g, p, 'drawPhaseExtra');
    if (more > 0) {
      yield* draw(g, p, more);
      log(g, `${pname(g, p)} 抽牌階段額外抽 ${more}`);
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
    // 爆發後的觸發窗口：招財貓、商人的調整順序、商人覺醒的加入手牌，以及這次爆發讓經驗區達到覺醒經驗時的覺醒效果
    yield* fire(g, p, 'afterBurst');
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
  yield* fireEach(g, 'onAwaken');
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
