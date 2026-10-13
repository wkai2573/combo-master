import Peer, { type DataConnection } from 'peerjs';
import { peerIdOf, type ClientMsg, type HostMsg } from './protocol';

// ───────────────────────── 房主端（Host） ─────────────────────────

/** 房主與一位訪客之間的一條連線 */
export interface HostLink {
  readonly open: boolean;
  send(msg: HostMsg): void;
  /** 連線建立時呼叫；已經建立就立刻呼叫 */
  onOpen(cb: () => void): void;
  onMessage(cb: (msg: ClientMsg) => void): void;
  onClose(cb: () => void): void;
  close(): void;
}

/** 開房失敗的原因：房號已被占用可以換房號重試，其餘的只能回報 */
export type RoomError = { kind: 'taken' | 'other'; detail: string };

export interface RoomEvents {
  /** 房間開好了，朋友可以用房號加入 */
  opened(): void;
  /** 有人連進來 */
  connection(link: HostLink): void;
  failed(error: RoomError): void;
}

export interface Room {
  close(): void;
}

/**
 * 房主對外的網路介面：以房號開房，並接收訪客的連線。測試用記憶體內的假實作取代。
 * 事件一律在 host 回傳之後才觸發；房間關閉後，該房間不能再觸發任何事件。
 */
export interface HostTransport {
  host(code: string, events: RoomEvents): Room;
}

function hostLinkOf(conn: DataConnection): HostLink {
  return {
    get open() {
      return conn.open;
    },
    send: (msg) => void conn.send(msg),
    onOpen: (cb) => (conn.open ? cb() : void conn.on('open', cb)),
    onMessage: (cb) => void conn.on('data', (raw) => cb(raw as ClientMsg)),
    onClose: (cb) => void conn.on('close', cb),
    close: () => conn.close(),
  };
}

/** 正式環境的房主傳輸：PeerJS */
export const peerHostTransport: HostTransport = {
  host(code, events) {
    const peer = new Peer(peerIdOf(code));
    // 房間關掉之後，舊 Peer 殘留的事件不能作用到換房號後的新房間
    let closed = false;
    peer.on('open', () => closed || events.opened());
    peer.on('connection', (conn) => closed || events.connection(hostLinkOf(conn)));
    peer.on('error', (err: Error & { type?: string }) => {
      if (closed) return;
      events.failed({ kind: err.type === 'unavailable-id' ? 'taken' : 'other', detail: err.type ?? err.message });
    });
    return {
      close: () => {
        closed = true;
        peer.destroy();
      },
    };
  },
};

/** 相容別名 */
export const peerTransport: HostTransport = peerHostTransport;

// ───────────────────────── 訪客端（Guest） ─────────────────────────

/** 訪客與房主之間的一條連線 */
export interface GuestLink {
  readonly open: boolean;
  send(msg: ClientMsg): void;
  /** 連線建立時呼叫；已經建立就立刻呼叫 */
  onOpen(cb: () => void): void;
  onMessage(cb: (msg: HostMsg) => void): void;
  onClose(cb: () => void): void;
  close(): void;
}

/** 訪客連線失敗的原因：找不到房間或連線錯誤 */
export type GuestError = { kind: 'not-found' | 'other'; detail: string };

export interface GuestEvents {
  /** 與房主連線已開啟 */
  connected(link: GuestLink): void;
  /** 連線失敗（如房間不存在或網路錯誤） */
  failed(error: GuestError): void;
}

export interface GuestConnection {
  close(): void;
}

/**
 * 訪客對外的網路介面：以房號連線房主。測試用記憶體內的假實作取代。
 */
export interface GuestTransport {
  connect(code: string, events: GuestEvents): GuestConnection;
}

function guestLinkOf(conn: DataConnection): GuestLink {
  return {
    get open() {
      return conn.open;
    },
    send: (msg) => void conn.send(msg),
    onOpen: (cb) => (conn.open ? cb() : void conn.on('open', cb)),
    onMessage: (cb) => void conn.on('data', (raw) => cb(raw as HostMsg)),
    onClose: (cb) => void conn.on('close', cb),
    close: () => conn.close(),
  };
}

/** 正式環境的訪客傳輸：PeerJS */
export const peerGuestTransport: GuestTransport = {
  connect(code, events) {
    const peer = new Peer();
    let closed = false;
    let conn: DataConnection | undefined;

    peer.on('open', () => {
      if (closed) return;
      // 使用預設的二進位序列化：PeerJS 會自動把大訊息（動畫影格可能超過 16KB）分塊傳送
      conn = peer.connect(peerIdOf(code), { reliable: true });
      const link = guestLinkOf(conn);
      conn.on('open', () => {
        if (closed) return;
        events.connected(link);
      });
    });

    peer.on('error', (err: Error & { type?: string }) => {
      if (closed) return;
      events.failed({
        kind: err.type === 'peer-unavailable' ? 'not-found' : 'other',
        detail: err.type ?? err.message,
      });
    });

    return {
      close: () => {
        closed = true;
        conn?.close();
        peer.destroy();
      },
    };
  },
};
