import type { HostLink, HostTransport, RoomError, RoomEvents } from '../src/net/hostTransport';
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

/** 記憶體內的傳輸：開房與連線都由測試手動觸發，順序完全可預期 */
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
