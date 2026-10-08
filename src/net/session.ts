import Peer, { type DataConnection } from 'peerjs';
import { validateDeck } from '../deck/validate';
import { botChoice } from '../engine/bot';
import type { CheatSnapshot, CheatZone } from '../engine/cheat';
import { Rng } from '../engine/rng';
import type { Frame, GameView } from '../engine/view';
import type { PlayerId } from '../engine/types';
import { peerTransport, type HostLink, type HostTransport, type Room } from './hostTransport';
import { Match, type MatchUpdate, type SeatUpdate } from './match';
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
  /** 持有引擎的一方（單機與房主）把自己那份對局更新呈現到畫面 */
  protected show(mine: SeatUpdate, over: boolean) {
    this.set({
      status: over ? 'over' : 'playing', view: mine.view, message: '', cheatOn: mine.cheatOn,
      batch: this.nextBatch(mine.frames),
    });
  }
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

  constructor(mine: DeckPayload, theirs: DeckPayload) {
    super();
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

  /** 只更新畫面：不重設機器人的出招計時，連續作弊也不會讓它一直等 */
  private publish([mine]: MatchUpdate) {
    this.show(mine, this.match.over);
  }

  private sync(update: MatchUpdate) {
    this.publish(update);
    clearTimeout(this.timer);
    const m = this.match;
    if (!m.over && m.pending?.player === 1) {
      this.timer = setTimeout(() => {
        if (this.closed || m.pending?.player !== 1) return;
        const r = m.submit(1, botChoice(m.pending, this.rng));
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

// ───────────────────────── 房主（持有引擎） ─────────────────────────

export class HostSession extends Base {
  readonly me: PlayerId = 0;
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

  constructor(private deck: DeckPayload, private transport: HostTransport = peerTransport) {
    super();
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
