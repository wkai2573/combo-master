import Peer, { type DataConnection } from 'peerjs';
import { validateDeck } from '../deck/validate';
import { botChoice } from '../engine/bot';
import type { CheatSnapshot, CheatZone } from '../engine/cheat';
import { Game } from '../engine/game';
import { Rng } from '../engine/rng';
import { frameFor, viewFor, type Frame, type GameView } from '../engine/view';
import type { PlayerId } from '../engine/types';
import { CheatHub } from './cheatHub';
import {
  FORFEIT_AFTER_S, OFFLINE_AFTER_MS, PING_EVERY_MS, peerIdOf, randomRoomCode,
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
  batch: { id: number; frames: Frame[] };
  /** 各玩家是否開啟作弊模式（索引為玩家編號）；對方開啟時畫面頂端會提示 */
  cheatOn: [boolean, boolean];
  /** 訪客收到的作弊檢視（只有自己開啟作弊時房主才會附上）；單機與房主直接讀引擎，用不到 */
  cheatSnap: CheatSnapshot | null;
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
}

export interface Session {
  readonly me: PlayerId;
  readonly cheat?: CheatApi;
  getState(): SessionState;
  subscribe(cb: () => void): () => void;
  submit(keys: string[]): void;
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
  };
}

abstract class Base implements Session {
  abstract readonly me: PlayerId;
  protected s: SessionState = {
    status: 'connecting', view: null, message: '', opponentOnline: true, forfeitIn: null,
    batch: { id: 0, frames: [] }, cheatOn: [false, false], cheatSnap: null,
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

  private hub: CheatHub;

  readonly cheat: CheatApi = makeCheatApi({
    setOn: (on) => {
      this.hub.setOn(0, on);
      this.publish();
    },
    snapshot: () => this.hub.snapshotFor(0),
    run: async (op) => {
      const err = this.hub.apply(0, op);
      if (!err) this.publish();
      return err;
    },
    closed: () => this.closed,
  });

  constructor(mine: DeckPayload, theirs: DeckPayload) {
    super();
    this.game = new Game({ decks: [mine, theirs], animate: true });
    this.hub = new CheatHub(this.game);
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

  /** 只更新畫面：不重設機器人的出招計時，連續作弊也不會讓它一直等 */
  private publish() {
    const g = this.game;
    this.set({
      status: g.over ? 'over' : 'playing', view: viewFor(g, 0), message: '', cheatOn: [...this.hub.on],
      batch: this.nextBatch(g.drainFrames().map((f) => frameFor(f, 0))),
    });
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
  private hub: CheatHub | undefined;
  private guestSeen = 0;
  private offlineTimer: ReturnType<typeof setInterval> | undefined;
  private watchTimer: ReturnType<typeof setInterval> | undefined;
  private forfeitLeft: number | null = null;
  private left = false;
  private attempts = 0;

  readonly cheat: CheatApi = makeCheatApi({
    setOn: (on) => {
      this.hub?.setOn(0, on);
      this.pushViews();
    },
    snapshot: () => this.hub?.snapshotFor(0) ?? null,
    run: async (op) => {
      const err = this.hub ? this.hub.apply(0, op) : '遊戲還沒開始';
      if (!err) this.pushViews();
      return err;
    },
    closed: () => this.left,
  });

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
      this.hub = new CheatHub(this.game);
      this.pushViews();
      return;
    }
    if (msg.t === 'cheat' && this.hub) {
      // 操作者以連線身分為準：訪客只能開關自己的作弊模式
      this.hub.setOn(1, !!msg.on);
      this.pushViews();
      return;
    }
    if (msg.t === 'cheatOp' && this.hub) {
      const error = this.hub.apply(1, msg.op);
      if (error) conn.send(this.viewMsg(this.game!, []));
      else this.pushViews();
      conn.send({ t: 'cheatResult', id: msg.id, error } satisfies HostMsg);
      return;
    }
    if (msg.t === 'submit' && this.game) {
      try {
        this.game.submit(1, msg.keys);
      } catch (e) {
        // 多半是訪客的畫面過期：告知原因，並直接補送最新狀態
        conn.send({ t: 'reject', reason: (e as Error).message } satisfies HostMsg);
        conn.send(this.viewMsg(this.game, []));
        return;
      }
      this.pushViews();
    }
  }

  private pushViews() {
    const g = this.game;
    if (!g) return;
    const raw = g.drainFrames();
    const cheatOn: [boolean, boolean] = this.hub ? [...this.hub.on] : [false, false];
    this.set({
      status: g.over ? 'over' : 'playing', view: viewFor(g, 0), message: '', cheatOn,
      batch: this.nextBatch(raw.map((f) => frameFor(f, 0))),
    });
    if (this.conn?.open) this.conn.send(this.viewMsg(g, raw.map((f) => frameFor(f, 1))));
  }

  /** 送給訪客的視角訊息：每一條路徑都走這裡，作弊的開關與檢視才不會漏。檢視只附給開啟作弊的訪客 */
  private viewMsg(g: Game, frames: Frame[]): HostMsg {
    return {
      t: 'view', view: viewFor(g, 1), frames,
      cheatOn: this.hub ? [...this.hub.on] : [false, false], cheatSnap: this.hub?.snapshotFor(1) ?? null,
    };
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
    if (!this.conn?.open) return Promise.resolve('與房主的連線中斷');
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
          batch: this.nextBatch(msg.frames ?? []), cheatOn: msg.cheatOn ?? [false, false], cheatSnap: msg.cheatSnap ?? null,
        });
      } else if (msg.t === 'cheatResult') {
        this.cheatWaiters.get(msg.id)?.(msg.error);
        this.cheatWaiters.delete(msg.id);
      } else if (msg.t === 'reject') {
        this.set({ message: msg.reason, ...(this.s.view ? {} : { status: 'error' as const }) });
      }
    });
    conn.on('close', () => {
      this.failCheatWaiters('與房主的連線中斷');
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
    this.left = true;
    this.failCheatWaiters('已離開遊戲');
    clearInterval(this.pingTimer);
    clearInterval(this.watchTimer);
    clearTimeout(this.connectTimer);
    this.conn?.close();
    this.peer.destroy();
  }
}
