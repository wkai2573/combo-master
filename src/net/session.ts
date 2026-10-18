import { getCard } from '../data/cards';
import { validateDeck } from '../deck/validate';
import { botChoice } from '../engine/bot';
import type { CheatSnapshot, CheatZone } from '../engine/cheat';
import { Rng } from '../engine/rng';
import { CORE_COMBAT_1, matchesFrame, resolveText, type TutorialChapter, type TutorialProgress } from '../tutorial/script';
import { setTutorialDone } from '../tutorial/completion';
import { chapterSetup } from '../tutorial/setup';
import { trackPlay, type PlayType } from '../stats/analytics';
import { recordFromView, type Opponent } from '../stats/records';
import { defaultRecordReporter, type RecordReporter } from '../stats/reporter';
import { APP_VERSION } from '../version';
import type { Frame, GameView } from '../engine/view';
import type { PlayerId } from '../engine/types';
import {
  peerHostTransport, peerGuestTransport,
  type HostLink, type GuestLink, type HostTransport, type GuestTransport,
  type Room, type GuestConnection,
} from './transport';
import { Match, type MatchUpdate, type SeatUpdate } from './match';
import {
  FORFEIT_AFTER_S, OFFLINE_AFTER_MS, PING_EVERY_MS, randomRoomCode,
  type CheatOp, type ClientMsg, type DeckPayload, type HostMsg,
} from './protocol';

export type SessionStatus = 'connecting' | 'waiting' | 'playing' | 'over' | 'error';

export interface SessionState {
  status: SessionStatus;
  view: GameView | null;
  message: string;
  roomCode?: string;
  /** 對手是否在線（單機一律在線） */
  opponentOnline: boolean;
  /** 對手離線後，剩餘幾秒判負 */
  forfeitIn: number | null;
  /** 最新一批要播放的動畫影格（id 每次遞增，介面據此判斷是否有新的一批） */
  batch: { id: number; frames: Frame[]; /** 最後一格播完後停在那一格（新手教學的停點） */ hold?: boolean };
  /** 各玩家是否開啟作弊模式（索引為玩家編號）；對方開啟時畫面頂端會提示 */
  cheatOn: [boolean, boolean];
  /** 訪客收到的作弊檢視（只有自己開啟作弊時房主才會附上）；單機與房主直接讀引擎，用不到 */
  cheatSnap: CheatSnapshot | null;
  /** 新手教學的進度；一般對局是 null */
  tutorial: TutorialProgress | null;
}

/**
 * 作弊操作：結果是 null 表示成功，否則是被拒絕的原因（訪客的操作要等房主回覆，所以是非同步）。
 * target 是被操作的玩家（可以是自己或對方）。
 */
export interface CheatApi {
  /** 開關自己的作弊模式 */
  setOn(on: boolean): void;
  /** 作弊檢視；還沒收到（或沒開啟）時是 null */
  snapshot(): CheatSnapshot | null;
  add(target: PlayerId, cardId: string): Promise<string | null>;
  remove(target: PlayerId, uid: number): Promise<string | null>;
  reorder(target: PlayerId, zone: CheatZone, uids: number[]): Promise<string | null>;
  /** 把牌區的一張卡移出遊戲 */
  deleteCard(target: PlayerId, zone: CheatZone, uid: number): Promise<string | null>;
  /** 加一張卡到牌區的第一格 */
  insert(target: PlayerId, zone: CheatZone, cardId: string): Promise<string | null>;
  /** 經驗區的卡翻面 */
  flip(target: PlayerId, uid: number): Promise<string | null>;
}

export interface Session {
  readonly me: PlayerId;
  readonly cheat?: CheatApi;
  getState(): SessionState;
  subscribe(cb: () => void): () => void;
  submit(keys: string[]): void;
  /** 新手教學：進入下一步（只有教學場次有） */
  advance?(): void;
  leave(): void;
}

/** 三種連線方式共用的作弊介面：run 執行一個操作並回報結果，closed 為 true 時一律拒絕 */
function makeCheatApi(parts: {
  setOn(on: boolean): void;
  snapshot(): CheatSnapshot | null;
  run(op: CheatOp): Promise<string | null>;
  closed(): boolean;
}): CheatApi {
  const run = (op: CheatOp) => (parts.closed() ? Promise.resolve('已離開遊戲') : parts.run(op));
  return {
    setOn: (on) => {
      if (!parts.closed()) parts.setOn(on);
    },
    snapshot: parts.snapshot,
    add: (target, cardId) => run({ k: 'add', target, cardId }),
    remove: (target, uid) => run({ k: 'remove', target, uid }),
    reorder: (target, zone, uids) => run({ k: 'reorder', target, zone, uids }),
    deleteCard: (target, zone, uid) => run({ k: 'delete', target, zone, uid }),
    insert: (target, zone, cardId) => run({ k: 'insert', target, zone, cardId }),
    flip: (target, uid) => run({ k: 'flip', target, uid }),
  };
}

abstract class Base implements Session {
  abstract readonly me: PlayerId;
  /** 這場對局的對手類型，結束時寫進戰績 */
  protected abstract readonly opponent: Opponent;
  private recorded = false;
  private started = false;
  private finished = false;
  protected s: SessionState = {
    status: 'connecting', view: null, message: '', opponentOnline: true, forfeitIn: null,
    batch: { id: 0, frames: [] }, cheatOn: [false, false], cheatSnap: null, tutorial: null,
  };
  private batchId = 0;
  protected nextBatch(frames: Frame[], hold = false) {
    return { id: ++this.batchId, frames, ...(hold ? { hold } : {}) };
  }
  private subs = new Set<() => void>();
  getState = () => this.s;
  subscribe = (cb: () => void) => {
    this.subs.add(cb);
    return () => this.subs.delete(cb);
  };
  /** 持有引擎的一方（單機與房主）把自己那份對局更新呈現到畫面 */
  protected show(mine: SeatUpdate, over: boolean, extra: Partial<SessionState> = {}, hold = false) {
    this.set({
      status: over ? 'over' : 'playing', view: mine.view, message: '', cheatOn: mine.cheatOn,
      batch: this.nextBatch(mine.frames, hold), ...extra,
    });
  }
  protected set(patch: Partial<SessionState>) {
    this.s = { ...this.s, ...patch };
    this.trackPlay();
    this.recordIfOver();
    this.subs.forEach((f) => f());
  }
  /**
   * 流量統計：畫面第一次拿到對局視角算開始，正常分出勝負算打完；離線判負與認輸不算打完。
   * 單機、房主、訪客各記各的，所以訪客也記（和戰績不同，這裡算的是有沒有人玩過）。
   */
  private trackPlay() {
    const view = this.s.view;
    if (!view) return;
    if (!this.started) {
      this.started = true;
      trackPlay('start', this.playType);
    }
    if (!this.finished && this.s.status === 'over' && view.winner !== null && view.forfeited !== true) {
      this.finished = true;
      trackPlay('finish', this.playType);
    }
  }
  constructor(protected reporter: RecordReporter = defaultRecordReporter()) {}
  /** 流量統計記的對戰類型：預設就是對手類型，教學另外記 */
  protected get playType(): PlayType {
    return this.opponent;
  }
  /** 這個場次是不是負責上傳戰績：連線對局只由房主上傳，一場只留一筆，訪客不上傳 */
  protected readonly uploadsRecord: boolean = true;
  /** 對局第一次進入結束狀態時留下戰績並交給上傳；離線判負、作弊過的對局由 recordFromView 排除 */
  private recordIfOver() {
    if (this.recorded || this.s.status !== 'over' || !this.s.view) return;
    this.recorded = true;
    if (!this.uploadsRecord) return;
    const record = recordFromView(this.s.view, this.opponent, APP_VERSION);
    if (record) this.reporter.submit(record);
  }
  abstract submit(keys: string[]): void;
  abstract leave(): void;
}

// ───────────────────────── 單機練習 ─────────────────────────

export class LocalSession extends Base {
  readonly me: PlayerId = 0;
  protected readonly opponent = 'cpu' as const;
  private match: Match;
  private rng = new Rng();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private closed = false;

  readonly cheat: CheatApi = makeCheatApi({
    setOn: (on) => this.publish(this.match.cheatSwitch(0, on)),
    snapshot: () => this.match.cheatSnapshot(0),
    run: async (op) => {
      const r = this.match.cheat(0, op);
      if (!r.error) this.publish(r.update);
      return r.error;
    },
    closed: () => this.closed,
  });

  constructor(mine: DeckPayload, theirs: DeckPayload, reporter: RecordReporter = defaultRecordReporter()) {
    super(reporter);
    this.match = new Match([mine, theirs]);
    this.sync(this.match.flush());
  }

  submit(keys: string[]) {
    if (this.closed) return;
    const r = this.match.submit(0, keys);
    if (r.error) {
      this.set({ message: r.error });
      return;
    }
    this.sync(r.update);
  }

  private botView: GameView | undefined;

  /** 只更新畫面：不重設機器人的出招計時，連續作弊也不會讓它一直等 */
  private publish([mine, theirs]: MatchUpdate) {
    this.botView = theirs.view;
    this.show(mine, this.match.over);
  }

  private sync(update: MatchUpdate) {
    this.publish(update);
    clearTimeout(this.timer);
    const m = this.match;
    if (!m.over && m.pending?.player === 1) {
      this.timer = setTimeout(() => {
        if (this.closed || m.pending?.player !== 1) return;
        const view = this.botView ?? m.snapshot()[1].view;
        const r = m.submit(1, botChoice(m.pending, this.rng, view));
        if (r.error) throw new Error(`機器人的出招不合法：${r.error}`);
        this.sync(r.update);
      }, 900);
    }
  }

  leave() {
    this.closed = true;
    clearTimeout(this.timer);
  }
}

// ───────────────────────── 新手教學 ─────────────────────────

/** 開局的洗牌與抽起始手牌不播：教學的牌面是開局後改寫的，播了會先看到 5 張起始手牌再被換掉 */
const SETUP_FX = new Set(['shuffle', 'deal']);

export class TutorialSession extends Base {
  readonly me: PlayerId = 0;
  // 教學不送戰績，所以對手類型用不到；流量統計另外記教學的開始與完成
  protected readonly opponent = 'cpu' as const;
  protected readonly uploadsRecord = false;
  protected get playType(): PlayType {
    return 'tutorial';
  }
  private match: Match;
  /** 目前執行到腳本的第幾步；等於步驟數表示腳本走完 */
  private step = 0;
  private closed = false;
  private completed = false;
  /** 引擎已經走到、但還沒交給畫面的影格：停在影格的步驟只送到停點為止，剩下的先扣著 */
  private held: Frame[] = [];
  /** 引擎目前的桌面（最新一次更新） */
  private live!: SeatUpdate;
  /** 畫面上的桌面就是引擎目前的桌面：沒有停在某一格，也沒有還沒送出的變化 */
  private shownLive = false;
  /** 正在一個停點裡：接在後面的說明維持停住的那一格，不放開扣著的影格 */
  private pauseFrame: Frame | null = null;

  constructor(reporter: RecordReporter = defaultRecordReporter(), private chapter: TutorialChapter = CORE_COMBAT_1) {
    super(reporter);
    const { decks, setup } = chapterSetup(chapter);
    this.match = new Match(decks, setup);
    this.take(this.match.flush());
    this.proceed();
  }

  /** 引擎有了新的更新：桌面記下來，影格先扣著 */
  private take([mine]: MatchUpdate) {
    this.live = mine;
    this.held.push(...mine.frames.filter((f) => !SETUP_FX.has(f.fx.type)));
    this.shownLive = false;
  }

  /**
   * 腳本往下走，直到遇到要等玩家的步驟：
   * - 對手的出牌立刻執行
   * - 停在影格：只把影格送到符合的那一格，畫面停在那裡
   * - 其他要等玩家的步驟：把扣著的影格都送出去，畫面回到引擎目前的桌面
   * 一路累積的影格一次交給畫面；分批交出去的話，後一批會蓋掉前一批，玩家就看不到前面的動畫。
   * 畫面上的桌面沒有變時只更新教學進度。
   */
  private proceed() {
    const sent: Frame[] = [];
    let stop: Frame | null = null;
    for (;;) {
      const step = this.chapter.steps[this.step];
      if (step?.kind === 'opponent-play') {
        this.opponentPlay(step.card);
        this.step++;
        this.pauseFrame = null;
        continue;
      }
      if (step?.kind === 'at-frame') {
        const at = this.held.findIndex((f) => matchesFrame(step.match, f.fx, this.me));
        if (at < 0) throw new Error(`教學腳本的第 ${this.step + 1} 步：找不到要停的影格`);
        sent.push(...this.held.splice(0, at + 1));
        stop = sent[sent.length - 1];
        this.pauseFrame = stop;
        break;
      }
      if (step?.kind === 'explain' && this.pauseFrame) {
        stop = this.pauseFrame;
        break;
      }
      // 說明（不在停點裡）、要求出牌、腳本走完：放開扣著的影格
      sent.push(...this.held.splice(0));
      this.pauseFrame = null;
      break;
    }
    // 走到結束畫面才算完成；中途離開不寫
    if (!this.chapter.steps[this.step] && !this.completed) {
      this.completed = true;
      setTutorialDone();
    }
    this.publish(sent, stop);
  }

  /** stop 是畫面要停住的那一格（null 表示回到引擎目前的桌面） */
  private publish(sent: Frame[], stop: Frame | null) {
    const frameChanged = stop !== null && sent.length > 0;
    if (!frameChanged && (stop !== null || this.shownLive)) {
      // 畫面上的桌面沒有變：維持停住的那一格，或本來就是目前的桌面
      this.set({ tutorial: this.progress(this.s.view!, stop), message: '' });
      return;
    }
    const view = stop ? this.pausedView(stop) : this.live.view;
    this.shownLive = stop === null;
    this.show({ ...this.live, view, frames: sent }, stop === null && this.match.over, { tutorial: this.progress(view, stop) }, stop !== null);
  }

  /** 停在某一格時的桌面：那一格的桌面，紀錄只到當時，沒有提示 */
  private pausedView(frame: Frame): GameView {
    return { ...frame.view, log: this.live.view.log.slice(0, frame.logLen), prompt: null, waitingFor: null };
  }

  private opponentPlay(card: string) {
    const pending = this.match.pending;
    const opt = pending?.player === 1 ? pending.options.find((o) => o.cardId === card) : undefined;
    if (!opt) throw new Error(`教學腳本的第 ${this.step + 1} 步：對手現在不能打出【${card}】`);
    const r = this.match.submit(1, [opt.key]);
    if (r.error) throw new Error(`教學腳本的第 ${this.step + 1} 步：${r.error}`);
    this.take(r.update);
  }

  private progress(view: GameView, frame: Frame | null): TutorialProgress {
    const step = this.chapter.steps[this.step];
    if (!step) return { text: '', highlight: [], awaiting: null, finished: true };
    const ctx = { view, frame: frame ?? undefined };
    if (step.kind === 'explain' || step.kind === 'at-frame') {
      return { text: resolveText(step.text, ctx), highlight: step.highlight ?? [], awaiting: 'click', finished: false };
    }
    if (step.kind === 'play') {
      return { text: resolveText(step.text, ctx), highlight: [{ kind: 'hand-card', cardId: step.card }], awaiting: { play: step.card }, finished: false };
    }
    throw new Error('教學腳本：對手的步驟應該已經執行完');
  }

  advance() {
    const kind = this.chapter.steps[this.step]?.kind;
    if (this.closed || (kind !== 'explain' && kind !== 'at-frame')) return;
    this.step++;
    this.proceed();
  }

  submit(keys: string[]) {
    if (this.closed) return;
    const step = this.chapter.steps[this.step];
    if (step?.kind !== 'play') {
      this.set({ message: step ? '現在請先點擊畫面進入下一步' : '教學的這一段到這裡結束了' });
      return;
    }
    const pending = this.match.pending;
    const chosen = keys.length === 1 && pending?.player === 0 ? pending.options.find((o) => o.key === keys[0]) : undefined;
    if (chosen?.cardId !== step.card) {
      this.set({ message: `請照說明，打出被框起來的【${getCard(step.card).name}】` });
      return;
    }
    const r = this.match.submit(0, keys);
    if (r.error) throw new Error(`教學腳本的第 ${this.step + 1} 步：${r.error}`);
    this.take(r.update);
    this.step++;
    this.proceed();
  }

  leave() {
    this.closed = true;
  }
}

// ───────────────────────── 房主（持有引擎） ─────────────────────────

export class HostSession extends Base {
  readonly me: PlayerId = 0;
  protected readonly opponent = 'player' as const;
  private room: Room | undefined;
  private link: HostLink | undefined;
  private match: Match | undefined;
  private guestSeen = 0;
  private offlineTimer: ReturnType<typeof setInterval> | undefined;
  private watchTimer: ReturnType<typeof setInterval> | undefined;
  private forfeitLeft: number | null = null;
  private left = false;
  private attempts = 0;

  readonly cheat: CheatApi = makeCheatApi({
    setOn: (on) => {
      if (this.match) this.push(this.match.cheatSwitch(0, on));
    },
    snapshot: () => this.match?.cheatSnapshot(0) ?? null,
    run: async (op) => {
      if (!this.match) return '遊戲還沒開始';
      const r = this.match.cheat(0, op);
      if (!r.error) this.push(r.update);
      return r.error;
    },
    closed: () => this.left,
  });

  constructor(
    private deck: DeckPayload,
    private transport: HostTransport = peerHostTransport,
    reporter: RecordReporter = defaultRecordReporter(),
  ) {
    super(reporter);
    this.open();
  }

  private open() {
    const code = randomRoomCode();
    this.room = this.transport.host(code, {
      opened: () => this.set({ status: 'waiting', roomCode: code, message: '等待朋友加入…' }),
      connection: (link) => this.onConnection(link),
      failed: (error) => {
        if (error.kind === 'taken' && this.attempts++ < 5) {
          this.room?.close();
          this.open();
          return;
        }
        this.set({ status: 'error', message: `連線服務發生錯誤（${error.detail}）` });
      },
    });
    this.watchTimer ??= setInterval(() => this.watch(), 1000);
  }

  private onConnection(link: HostLink) {
    if (this.link?.open || this.match) {
      link.onOpen(() => {
        link.send({ t: 'reject', reason: '房間已滿或遊戲已開始' });
        setTimeout(() => link.close(), 300);
      });
      return;
    }
    this.link = link;
    link.onMessage((msg) => this.onData(link, msg));
    link.onClose(() => {
      if (this.link !== link) return;
      if (this.match) this.markOffline();
      else this.link = undefined; // 還沒開局就離開：房間重新開放
    });
  }

  private onData(link: HostLink, msg: ClientMsg) {
    this.guestSeen = Date.now();
    if (msg.t === 'ping') {
      link.send({ t: 'pong' });
      if (this.forfeitLeft !== null) this.markOnline();
      return;
    }
    if (msg.t === 'hello' && !this.match) {
      const check = validateDeck(msg.deck.charId, msg.deck.cards);
      if (!check.ok) {
        link.send({ t: 'reject', reason: `牌組不合法：${check.errors[0]}` });
        return;
      }
      this.match = new Match([this.deck, msg.deck]);
      this.push(this.match.flush());
      return;
    }
    const match = this.match;
    if (!match) return;
    // 操作者以連線身分為準：訪客一律是玩家 B，訊息裡自稱別人也沒用
    if (msg.t === 'cheat') {
      this.push(match.cheatSwitch(1, !!msg.on));
    } else if (msg.t === 'cheatOp') {
      const r = match.cheat(1, msg.op);
      if (r.error) link.send(viewMsg(r.update[1]));
      else this.push(r.update);
      link.send({ t: 'cheatResult', id: msg.id, error: r.error });
    } else if (msg.t === 'submit') {
      const r = match.submit(1, msg.keys);
      if (r.error) {
        // 多半是訪客的畫面過期：告知原因，並直接補送最新狀態
        link.send({ t: 'reject', reason: r.error });
        link.send(viewMsg(r.update[1]));
        return;
      }
      this.push(r.update);
    }
  }

  /** 房主的畫面更新，並把訪客那份送出去 */
  private push([mine, theirs]: MatchUpdate) {
    this.show(mine, !!this.match?.over);
    if (this.link?.open) this.link.send(viewMsg(theirs));
  }

  /** 每秒檢查訪客是否仍有回應；離線後倒數判負 */
  private watch() {
    if (!this.match || this.match.over || !this.link) return;
    if (this.forfeitLeft === null && Date.now() - this.guestSeen > OFFLINE_AFTER_MS) this.markOffline();
  }

  private markOffline() {
    const match = this.match;
    if (!match || match.over || this.forfeitLeft !== null) return;
    this.forfeitLeft = FORFEIT_AFTER_S;
    this.set({ opponentOnline: false, forfeitIn: this.forfeitLeft });
    this.offlineTimer = setInterval(() => {
      this.forfeitLeft = (this.forfeitLeft ?? 0) - 1;
      if (this.forfeitLeft <= 0) {
        clearInterval(this.offlineTimer);
        const update = match.forfeit(1, `對手離線超過 ${FORFEIT_AFTER_S} 秒`);
        this.set({ opponentOnline: false, forfeitIn: null });
        this.push(update);
      } else {
        this.set({ forfeitIn: this.forfeitLeft });
      }
    }, 1000);
  }

  private markOnline() {
    clearInterval(this.offlineTimer);
    this.forfeitLeft = null;
    this.set({ opponentOnline: true, forfeitIn: null });
  }

  submit(keys: string[]) {
    if (!this.match) return;
    const r = this.match.submit(0, keys);
    if (r.error) {
      this.set({ message: r.error });
      return;
    }
    this.push(r.update);
  }

  leave() {
    this.left = true;
    clearInterval(this.offlineTimer);
    clearInterval(this.watchTimer);
    this.link?.close();
    this.room?.close();
  }

  get isLeft() {
    return this.left;
  }
}

/** 送給訪客的視角訊息：每一條路徑都走這裡，作弊的開關與檢視才不會漏。檢視只附給開啟作弊的訪客 */
function viewMsg(seat: SeatUpdate): HostMsg {
  return { t: 'view', view: seat.view, frames: seat.frames, cheatOn: seat.cheatOn, cheatSnap: seat.cheatSnap };
}

// ───────────────────────── 訪客 ─────────────────────────

export class GuestSession extends Base {
  readonly me: PlayerId = 1;
  protected readonly opponent = 'player' as const;
  protected readonly uploadsRecord = false;
  private link: GuestLink | undefined;
  private conn: GuestConnection | undefined;
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  private hostSeen = Date.now();
  private connectTimer: ReturnType<typeof setTimeout> | undefined;
  private watchTimer: ReturnType<typeof setInterval> | undefined;
  private cheatSeq = 0;
  private cheatWaiters = new Map<number, (error: string | null) => void>();

  private left = false;

  readonly cheat: CheatApi = makeCheatApi({
    setOn: (on) => this.send({ t: 'cheat', on }),
    snapshot: () => this.s.cheatSnap,
    run: (op) => this.cheatOp(op),
    closed: () => this.left,
  });

  /** 還在等房主回覆的作弊操作：連線中斷或離開時一併結束 */
  private failCheatWaiters(reason: string) {
    for (const done of this.cheatWaiters.values()) done(reason);
    this.cheatWaiters.clear();
  }

  /** 傳給房主執行，等房主回報結果；連線中斷或太久沒回應就當成失敗 */
  private cheatOp(op: CheatOp): Promise<string | null> {
    if (!this.link?.open) return Promise.resolve('與房主的連線中斷');
    return new Promise((resolve) => {
      const id = ++this.cheatSeq;
      const timer = setTimeout(() => {
        this.cheatWaiters.delete(id);
        resolve('房主沒有回應');
      }, 10_000);
      this.cheatWaiters.set(id, (error) => {
        clearTimeout(timer);
        resolve(error);
      });
      this.send({ t: 'cheatOp', id, op });
    });
  }

  constructor(
    code: string,
    private deck: DeckPayload,
    private transport: GuestTransport = peerGuestTransport,
  ) {
    super();
    const cleanCode = code.trim().toUpperCase();
    this.set({ message: '連線中…', roomCode: cleanCode });
    this.conn = this.transport.connect(cleanCode, {
      connected: (link) => this.onConnected(link),
      failed: (err) => {
        const msg = err.kind === 'not-found' ? '找不到這個房間，請確認房號' : `連線發生錯誤（${err.detail}）`;
        this.fail(msg);
      },
    });
    this.connectTimer = setTimeout(() => {
      if (this.s.status === 'connecting') this.fail('連線逾時，請確認房號或網路');
    }, 20_000);
  }

  private fail(message: string) {
    if (this.s.status === 'over') return;
    this.set({ status: 'error', message });
  }

  private onConnected(link: GuestLink) {
    clearTimeout(this.connectTimer);
    this.link = link;
    this.hostSeen = Date.now();
    this.send({ t: 'hello', deck: this.deck });
    this.set({ message: '已連上房主，等待開局…' });
    this.pingTimer = setInterval(() => this.send({ t: 'ping' }), PING_EVERY_MS);
    this.watchTimer = setInterval(() => {
      const offline = Date.now() - this.hostSeen > OFFLINE_AFTER_MS;
      if (offline === this.s.opponentOnline) this.set({ opponentOnline: !offline });
    }, 1000);

    link.onMessage((msg) => {
      this.hostSeen = Date.now();
      if (msg.t === 'view') {
        this.set({
          status: msg.view.winner !== null ? 'over' : 'playing', view: msg.view, message: '', opponentOnline: true,
          batch: this.nextBatch(msg.frames ?? []), cheatOn: msg.cheatOn ?? [false, false], cheatSnap: msg.cheatSnap ?? null,
        });
      } else if (msg.t === 'cheatResult') {
        this.cheatWaiters.get(msg.id)?.(msg.error);
        this.cheatWaiters.delete(msg.id);
      } else if (msg.t === 'reject') {
        this.set({ message: msg.reason, ...(this.s.view ? {} : { status: 'error' as const }) });
      }
    });

    link.onClose(() => {
      this.failCheatWaiters('與房主的連線中斷');
      if (this.s.status !== 'over') this.fail('與房主的連線中斷');
    });
  }

  private send(msg: ClientMsg) {
    if (this.link?.open) this.link.send(msg);
  }

  submit(keys: string[]) {
    this.send({ t: 'submit', keys });
  }

  leave() {
    this.left = true;
    this.failCheatWaiters('已離開遊戲');
    clearInterval(this.pingTimer);
    clearInterval(this.watchTimer);
    clearTimeout(this.connectTimer);
    this.link?.close();
    this.conn?.close();
  }
}
