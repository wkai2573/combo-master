import type {
  GuestError, GuestEvents, GuestLink, GuestTransport,
  HostLink, HostTransport, RoomError, RoomEvents,
} from '../src/net/transport';
import type { ClientMsg, HostMsg } from '../src/net/protocol';

/** 以訪客的身分操作的假連線：記下房主送出的訊息，並讓測試送訊息給房主 */
export class FakeGuest {
  readonly sent: HostMsg[] = [];
  open = true;
  /** 房主主動關閉過連線 */
  closedByHost = false;
  private onMsg: (msg: ClientMsg) => void = () => {};
  private onClosed: () => void = () => {};

  readonly link: HostLink;

  constructor() {
    const self = this;
    this.link = {
      get open() {
        return self.open;
      },
      send: (msg) => void self.sent.push(msg),
      onOpen: (cb) => cb(),
      onMessage: (cb) => void (self.onMsg = cb),
      onClose: (cb) => void (self.onClosed = cb),
      close: () => {
        self.closedByHost = true;
        self.open = false;
      },
    };
  }

  say(msg: ClientMsg): void {
    this.onMsg(msg);
  }

  /** 訪客那邊斷線 */
  drop(): void {
    this.open = false;
    this.onClosed();
  }
}

/** 記憶體內的房主傳輸：開房與連線都由測試手動觸發，順序完全可預期 */
export class FakeTransport implements HostTransport {
  readonly rooms: { code: string; events: RoomEvents; closed: boolean }[] = [];

  host(code: string, events: RoomEvents) {
    const room = { code, events, closed: false };
    this.rooms.push(room);
    return { close: () => void (room.closed = true) };
  }

  get latest() {
    return this.rooms[this.rooms.length - 1];
  }

  /** 連線服務回報房間開好了 */
  ready(): void {
    this.latest.events.opened();
  }

  fail(error: RoomError): void {
    this.latest.events.failed(error);
  }

  /** 一位訪客連進最新的房間 */
  connect(): FakeGuest {
    const g = new FakeGuest();
    this.latest.events.connection(g.link);
    return g;
  }
}

/** 以房主的身分操作的假連線：記下訪客送出的訊息，並讓測試送訊息給訪客 */
export class FakeHost {
  readonly sent: ClientMsg[] = [];
  open = true;
  /** 訪客主動關閉過連線 */
  closedByGuest = false;
  private onMsg: (msg: HostMsg) => void = () => {};
  private onClosed: () => void = () => {};

  readonly link: GuestLink;

  constructor() {
    const self = this;
    this.link = {
      get open() {
        return self.open;
      },
      send: (msg) => void self.sent.push(msg),
      onOpen: (cb) => cb(),
      onMessage: (cb) => void (self.onMsg = cb),
      onClose: (cb) => void (self.onClosed = cb),
      close: () => {
        self.closedByGuest = true;
        self.open = false;
      },
    };
  }

  say(msg: HostMsg): void {
    this.onMsg(msg);
  }

  /** 房主那邊斷線 */
  drop(): void {
    this.open = false;
    this.onClosed();
  }
}

/** 訪客端假傳輸：連線觸發與回覆由測試手動控制 */
export class FakeGuestTransport implements GuestTransport {
  readonly attempts: { code: string; events: GuestEvents; closed: boolean }[] = [];
  currentHost: FakeHost | undefined;

  connect(code: string, events: GuestEvents) {
    const attempt = { code, events, closed: false };
    this.attempts.push(attempt);
    return { close: () => void (attempt.closed = true) };
  }

  get latest() {
    return this.attempts[this.attempts.length - 1];
  }

  /** 連線成功，提供一個假房主端讓測試互動 */
  ready(): FakeHost {
    const h = new FakeHost();
    this.currentHost = h;
    this.latest.events.connected(h.link);
    return h;
  }

  fail(error: GuestError): void {
    this.latest.events.failed(error);
  }
}

/**
 * 記憶體內的雙端直連 P2P 通道：
 * Host 開房後，Guest 連線同一房號，雙方 Link 在記憶體中直接交錯綁定。
 */
export function createInMemoryNetwork(): { host: HostTransport; guest: GuestTransport } {
  const rooms = new Map<string, { events: RoomEvents; closed: () => boolean }>();

  const hostTransport: HostTransport = {
    host(code, events) {
      let closed = false;
      rooms.set(code, { events, closed: () => closed });
      // 微任務非同步觸發 opened
      queueMicrotask(() => {
        if (!closed) events.opened();
      });
      return {
        close: () => {
          closed = true;
          rooms.delete(code);
        },
      };
    },
  };

  const guestTransport: GuestTransport = {
    connect(code, events) {
      let closed = false;
      queueMicrotask(() => {
        if (closed) return;
        const room = rooms.get(code);
        if (!room || room.closed()) {
          events.failed({ kind: 'not-found', detail: '找不到這個房間' });
          return;
        }

        let hostOpen = true;
        let guestOpen = true;
        let hostMsgCb: (msg: ClientMsg) => void = () => {};
        let guestMsgCb: (msg: HostMsg) => void = () => {};
        let hostCloseCb: () => void = () => {};
        let guestCloseCb: () => void = () => {};

        const hostLink: HostLink = {
          get open() {
            return hostOpen && guestOpen;
          },
          send: (msg) => {
            if (guestOpen) queueMicrotask(() => guestMsgCb(msg));
          },
          onOpen: (cb) => cb(),
          onMessage: (cb) => {
            hostMsgCb = cb;
          },
          onClose: (cb) => {
            hostCloseCb = cb;
          },
          close: () => {
            hostOpen = false;
            queueMicrotask(() => guestCloseCb());
          },
        };

        const guestLink: GuestLink = {
          get open() {
            return hostOpen && guestOpen;
          },
          send: (msg) => {
            if (hostOpen) queueMicrotask(() => hostMsgCb(msg));
          },
          onOpen: (cb) => cb(),
          onMessage: (cb) => {
            guestMsgCb = cb;
          },
          onClose: (cb) => {
            guestCloseCb = cb;
          },
          close: () => {
            guestOpen = false;
            queueMicrotask(() => hostCloseCb());
          },
        };

        events.connected(guestLink);
        room.events.connection(hostLink);
      });

      return {
        close: () => {
          closed = true;
        },
      };
    },
  };

  return { host: hostTransport, guest: guestTransport };
}
