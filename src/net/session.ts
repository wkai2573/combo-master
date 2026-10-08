import Peer, { type DataConnection } from 'peerjs';
import { validateDeck } from '../deck/validate';
import { botChoice } from '../engine/bot';
import type { CheatSnapshot, CheatZone } from '../engine/cheat';
import { Game } from '../engine/game';
import { Rng } from '../engine/rng';
import { frameFor, viewFor, type Frame, type GameView } from '../engine/view';
import type { PlayerId } from '../engine/types';
import {
  FORFEIT_AFTER_S, OFFLINE_AFTER_MS, PING_EVERY_MS, peerIdOf, randomRoomCode,
  type ClientMsg, type DeckPayload, type HostMsg,
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
  batch: { id: number; frames: Frame[] };
}

/**
 * 作弊操作：回傳 null 表示成功，否則是被拒絕的原因。
 * target 是被操作的玩家（可以是自己或對方）。沒有這組操作的連線方式，作弊面板不會出現。
 */
export interface CheatApi {
  snapshot(): CheatSnapshot;
  add(target: PlayerId, cardId: string): string | null;
  remove(target: PlayerId, uid: number): string | null;
  reorder(target: PlayerId, zone: CheatZone, uids: number[]): string | null;
}

export interface Session {
  readonly me: PlayerId;
  readonly cheat?: CheatApi;
  getState(): SessionState;
  subscribe(cb: () => void): () => void;
  submit(keys: string[]): void;
  leave(): void;
}

abstract class Base implements Session {
  abstract readonly me: PlayerId;
  protected s: SessionState = {
    status: 'connecting', view: null, message: '', opponentOnline: true, forfeitIn: null,
    batch: { id: 0, frames: [] },
  };
  private batchId = 0;
  protected nextBatch(frames: Frame[]) {
    return { id: ++this.batchId, frames };
  }
  private subs = new Set<() => void>();
  getState = () => this.s;
  subscribe = (cb: () => void) => {
    this.subs.add(cb);
    return () => this.subs.delete(cb);
  };
  protected set(patch: Partial<SessionState>) {
    this.s = { ...this.s, ...patch };
    this.subs.forEach((f) => f());
  }
  abstract submit(keys: string[]): void;
  abstract leave(): void;
}

// ───────────────────────── 單機練習 ─────────────────────────

export class LocalSession extends Base {
  readonly me: PlayerId = 0;
  private game: Game;
  private rng = new Rng();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private closed = false;

  readonly cheat: CheatApi = {
    snapshot: () => this.game.cheatSnapshot(),
    add: (target, cardId) => this.cheatOp(() => this.game.cheatAdd(0, target, cardId)),
    remove: (target, uid) => this.cheatOp(() => this.game.cheatRemove(0, target, uid)),
    reorder: (target, zone, uids) => this.cheatOp(() => this.game.cheatReorder(0, target, zone, uids)),
  };

  constructor(mine: DeckPayload, theirs: DeckPayload) {
    super();
    this.game = new Game({ decks: [mine, theirs], animate: true });
    this.sync();
  }

  submit(keys: string[]) {
    if (this.closed) return;
    try {
      this.game.submit(0, keys);
    } catch (e) {
      this.set({ message: (e as Error).message });
      return;
    }
    this.sync();
  }

  private cheatOp(op: () => void): string | null {
    if (this.closed) return '已離開遊戲';
    try {
      op();
    } catch (e) {
      return (e as Error).message;
    }
    // 只更新畫面：不重設機器人的出招計時，連續作弊也不會讓它一直等
    const g = this.game;
    this.set({ status: g.over ? 'over' : 'playing', view: viewFor(g, 0), message: '', batch: this.nextBatch(g.drainFrames().map((f) => frameFor(f, 0))) });
    return null;
  }

  private sync() {
    const g = this.game;
    const frames = g.drainFrames().map((f) => frameFor(f, 0));
    this.set({
      status: g.over ? 'over' : 'playing', view: viewFor(g, 0), message: '', batch: this.nextBatch(frames),
    });
    clearTimeout(this.timer);
    if (!g.over && g.pending?.player === 1) {
      this.timer = setTimeout(() => {
        if (this.closed || !g.pending || g.pending.player !== 1) return;
        g.submit(1, botChoice(g.pending, this.rng));
        this.sync();
      }, 900);
    }
  }

  leave() {
    this.closed = true;
    clearTimeout(this.timer);
  }
}

// ───────────────────────── 房主（持有引擎） ─────────────────────────

export class HostSession extends Base {
  readonly me: PlayerId = 0;
  private peer: Peer | undefined;
  private conn: DataConnection | undefined;
  private game: Game | undefined;
  private guestSeen = 0;
  private offlineTimer: ReturnType<typeof setInterval> | undefined;
  private watchTimer: ReturnType<typeof setInterval> | undefined;
  private forfeitLeft: number | null = null;
  private left = false;
  private attempts = 0;

  constructor(private deck: DeckPayload) {
    super();
    this.open();
  }

  private open() {
    const code = randomRoomCode();
    const peer = new Peer(peerIdOf(code));
    this.peer = peer;
    peer.on('open', () => this.set({ status: 'waiting', roomCode: code, message: '等待朋友加入…' }));
    peer.on('connection', (conn) => this.onConnection(conn));
    peer.on('error', (err: Error & { type?: string }) => {
      if (err.type === 'unavailable-id' && this.attempts++ < 5) {
        peer.destroy();
        this.open();
        return;
      }
      this.set({ status: 'error', message: `連線服務發生錯誤（${err.type ?? err.message}）` });
    });
    this.watchTimer ??= setInterval(() => this.watch(), 1000);
  }

  private onConnection(conn: DataConnection) {
    if (this.conn?.open || this.game) {
      conn.on('open', () => {
        conn.send({ t: 'reject', reason: '房間已滿或遊戲已開始' } satisfies HostMsg);
        setTimeout(() => conn.close(), 300);
      });
      return;
    }
    this.conn = conn;
    conn.on('data', (raw) => this.onData(conn, raw as ClientMsg));
    conn.on('close', () => {
      if (this.conn !== conn) return;
      if (this.game) this.markOffline();
      else this.conn = undefined; // 還沒開局就離開：房間重新開放
    });
  }

  private onData(conn: DataConnection, msg: ClientMsg) {
    this.guestSeen = Date.now();
    if (msg.t === 'ping') {
      conn.send({ t: 'pong' } satisfies HostMsg);
      if (this.forfeitLeft !== null) this.markOnline();
      return;
    }
    if (msg.t === 'hello' && !this.game) {
      const check = validateDeck(msg.deck.charId, msg.deck.cards);
      if (!check.ok) {
        conn.send({ t: 'reject', reason: `牌組不合法：${check.errors[0]}` } satisfies HostMsg);
        return;
      }
      this.game = new Game({ decks: [this.deck, msg.deck], animate: true });
      this.pushViews();
      return;
    }
    if (msg.t === 'submit' && this.game) {
      try {
        this.game.submit(1, msg.keys);
      } catch (e) {
        // 多半是訪客的畫面過期：告知原因，並直接補送最新狀態
        conn.send({ t: 'reject', reason: (e as Error).message } satisfies HostMsg);
        conn.send({ t: 'view', view: viewFor(this.game, 1), frames: [] } satisfies HostMsg);
        return;
      }
      this.pushViews();
    }
  }

  private pushViews() {
    const g = this.game;
    if (!g) return;
    const raw = g.drainFrames();
    this.set({
      status: g.over ? 'over' : 'playing', view: viewFor(g, 0), message: '',
      batch: this.nextBatch(raw.map((f) => frameFor(f, 0))),
    });
    if (this.conn?.open) {
      this.conn.send({ t: 'view', view: viewFor(g, 1), frames: raw.map((f) => frameFor(f, 1)) } satisfies HostMsg);
    }
  }

  /** 每秒檢查訪客是否仍有回應；離線後倒數判負 */
  private watch() {
    if (!this.game || this.game.over || !this.conn) return;
    if (this.forfeitLeft === null && Date.now() - this.guestSeen > OFFLINE_AFTER_MS) this.markOffline();
  }

  private markOffline() {
    const g = this.game;
    if (!g || g.over || this.forfeitLeft !== null) return;
    this.forfeitLeft = FORFEIT_AFTER_S;
    this.set({ opponentOnline: false, forfeitIn: this.forfeitLeft });
    this.offlineTimer = setInterval(() => {
      this.forfeitLeft = (this.forfeitLeft ?? 0) - 1;
      if (this.forfeitLeft <= 0) {
        clearInterval(this.offlineTimer);
        g.forfeit(1, `對手離線超過 ${FORFEIT_AFTER_S} 秒`);
        this.set({ opponentOnline: false, forfeitIn: null });
        this.pushViews();
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
    const g = this.game;
    if (!g) return;
    try {
      g.submit(0, keys);
    } catch (e) {
      this.set({ message: (e as Error).message });
      return;
    }
    this.pushViews();
  }

  leave() {
    this.left = true;
    clearInterval(this.offlineTimer);
    clearInterval(this.watchTimer);
    this.conn?.close();
    this.peer?.destroy();
  }

  get isLeft() {
    return this.left;
  }
}

// ───────────────────────── 訪客 ─────────────────────────

export class GuestSession extends Base {
  readonly me: PlayerId = 1;
  private peer: Peer;
  private conn: DataConnection | undefined;
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  private hostSeen = Date.now();
  private connectTimer: ReturnType<typeof setTimeout> | undefined;
  private watchTimer: ReturnType<typeof setInterval> | undefined;

  constructor(code: string, private deck: DeckPayload) {
    super();
    this.set({ message: '連線中…', roomCode: code.trim().toUpperCase() });
    this.peer = new Peer();
    this.peer.on('open', () => this.connect(code));
    this.peer.on('error', (err: Error & { type?: string }) => {
      const msg = err.type === 'peer-unavailable' ? '找不到這個房間，請確認房號' : `連線發生錯誤（${err.type ?? err.message}）`;
      this.fail(msg);
    });
    this.connectTimer = setTimeout(() => {
      if (this.s.status === 'connecting') this.fail('連線逾時，請確認房號或網路');
    }, 20_000);
  }

  private fail(message: string) {
    if (this.s.status === 'over') return;
    this.set({ status: 'error', message });
  }

  private connect(code: string) {
    // 使用預設的二進位序列化：PeerJS 會自動把大訊息（動畫影格可能超過 16KB）分塊傳送
    const conn = this.peer.connect(peerIdOf(code), { reliable: true });
    this.conn = conn;
    conn.on('open', () => {
      clearTimeout(this.connectTimer);
      this.hostSeen = Date.now();
      this.send({ t: 'hello', deck: this.deck });
      this.set({ message: '已連上房主，等待開局…' });
      this.pingTimer = setInterval(() => this.send({ t: 'ping' }), PING_EVERY_MS);
      this.watchTimer = setInterval(() => {
        const offline = Date.now() - this.hostSeen > OFFLINE_AFTER_MS;
        if (offline === this.s.opponentOnline) this.set({ opponentOnline: !offline });
      }, 1000);
    });
    conn.on('data', (raw) => {
      this.hostSeen = Date.now();
      const msg = raw as HostMsg;
      if (msg.t === 'view') {
        this.set({
          status: msg.view.winner !== null ? 'over' : 'playing', view: msg.view, message: '', opponentOnline: true,
          batch: this.nextBatch(msg.frames ?? []),
        });
      } else if (msg.t === 'reject') {
        this.set({ message: msg.reason, ...(this.s.view ? {} : { status: 'error' as const }) });
      }
    });
    conn.on('close', () => {
      if (this.s.status !== 'over') this.fail('與房主的連線中斷');
    });
  }

  private send(msg: ClientMsg) {
    if (this.conn?.open) this.conn.send(msg);
  }

  submit(keys: string[]) {
    this.send({ t: 'submit', keys });
  }

  leave() {
    clearInterval(this.pingTimer);
    clearInterval(this.watchTimer);
    clearTimeout(this.connectTimer);
    this.conn?.close();
    this.peer.destroy();
  }
}
