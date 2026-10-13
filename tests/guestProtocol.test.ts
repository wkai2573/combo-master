import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { presetDeck } from '../src/data/presetDecks';
import type { GameView } from '../src/engine/view';
import { OFFLINE_AFTER_MS, PING_EVERY_MS, type ClientMsg, type HostMsg } from '../src/net/protocol';
import { GuestSession, HostSession } from '../src/net/session';
import type { BattleRecord } from '../src/stats/records';
import type { RecordReporter } from '../src/stats/reporter';
import { FakeGuestTransport, createInMemoryNetwork } from './fakeTransport';

const testReporter: RecordReporter = {
  submit: () => {},
  flush: async () => ({ sent: 0, left: 0 }),
};

const DECK_GUEST = { charId: '刺客', cards: presetDeck('刺客') };
const DECK_HOST = { charId: '勇者', cards: presetDeck('勇者') };

const dummyView: GameView = {
  turn: 1,
  phase: '先手',
  first: 0,
  waitingFor: 0,
  me: 1,
  winner: null,
  winReason: '',
  log: [],
  cheated: false,
  forfeited: false,
  players: [
    {
      charId: '勇者', deckCount: 30, hand: [], discard: [], rage: [], exp: [], moves: [], pursuit: [], gear: [], buff: [],
      passed: false, atk: 0, def: 0,
    },
    {
      charId: '刺客', deckCount: 30, hand: [], discard: [], rage: [], exp: [], moves: [], pursuit: [], gear: [], buff: [],
      passed: false, atk: 0, def: 0,
    },
  ],
  prompt: null,
};

describe('訪客端通訊協定（GuestProtocol）', () => {
  let transport: FakeGuestTransport;
  let guest: GuestSession;

  beforeEach(() => {
    vi.useFakeTimers();
    transport = new FakeGuestTransport();
    guest = new GuestSession('ROOM1', DECK_GUEST, transport);
  });

  afterEach(() => {
    guest.leave();
    vi.useRealTimers();
  });

  describe('連線防禦與逾時處理', () => {
    it('房間不存在時顯示「找不到這個房間，請確認房號」', () => {
      expect(guest.getState().status).toBe('connecting');
      transport.fail({ kind: 'not-found', detail: 'peer-unavailable' });
      expect(guest.getState().status).toBe('error');
      expect(guest.getState().message).toBe('找不到這個房間，請確認房號');
    });

    it('一般網路錯誤時顯示錯誤訊息', () => {
      transport.fail({ kind: 'other', detail: 'socket-closed' });
      expect(guest.getState().status).toBe('error');
      expect(guest.getState().message).toBe('連線發生錯誤（socket-closed）');
    });

    it('連線超過 20 秒未成功時觸發超時錯誤', () => {
      expect(guest.getState().status).toBe('connecting');
      vi.advanceTimersByTime(20_000);
      expect(guest.getState().status).toBe('error');
      expect(guest.getState().message).toBe('連線逾時，請確認房號或網路');
    });
  });

  describe('握手與心跳維護', () => {
    it('連線成功後自動發送 hello 帶牌組，並進入等待開局狀態', () => {
      const host = transport.ready();
      expect(guest.getState().message).toBe('已連上房主，等待開局…');
      expect(host.sent).toContainEqual({ t: 'hello', deck: DECK_GUEST });
    });

    it('連線成功後每隔 PING_EVERY_MS 自動發送 ping', () => {
      const host = transport.ready();
      expect(host.sent.filter((m) => m.t === 'ping')).toHaveLength(0);

      vi.advanceTimersByTime(PING_EVERY_MS);
      expect(host.sent.filter((m) => m.t === 'ping')).toHaveLength(1);

      vi.advanceTimersByTime(PING_EVERY_MS);
      expect(host.sent.filter((m) => m.t === 'ping')).toHaveLength(2);
    });
  });

  describe('對手離線感測與恢復在線', () => {
    it('超過 OFFLINE_AFTER_MS 未收到房主訊息判定對手離線，收到訊息後恢復在線', () => {
      const host = transport.ready();
      host.say({ t: 'view', view: dummyView, frames: [] });
      expect(guest.getState().opponentOnline).toBe(true);

      // 超過 OFFLINE_AFTER_MS (8000ms)
      vi.advanceTimersByTime(OFFLINE_AFTER_MS + 1000);
      expect(guest.getState().opponentOnline).toBe(false);

      // 收到房主任意訊息恢復在線
      host.say({ t: 'view', view: dummyView, frames: [] });
      expect(guest.getState().opponentOnline).toBe(true);
    });
  });

  describe('房主 reject 錯誤展示', () => {
    it('開局前收到 reject 轉為 error 狀態', () => {
      const host = transport.ready();
      host.say({ t: 'reject', reason: '牌組不合法：包含禁用卡片' });
      expect(guest.getState().status).toBe('error');
      expect(guest.getState().message).toBe('牌組不合法：包含禁用卡片');
    });

    it('遊戲中收到 reject 維持 playing 狀態並更新訊息', () => {
      const host = transport.ready();
      host.say({ t: 'view', view: dummyView, frames: [] });
      expect(guest.getState().status).toBe('playing');

      host.say({ t: 'reject', reason: '出招不符合規則' });
      expect(guest.getState().status).toBe('playing');
      expect(guest.getState().message).toBe('出招不符合規則');
    });
  });

  describe('作弊 RPC 機制', () => {
    it('成功發送 cheatOp 收到 cheatResult 正確 resolve', async () => {
      const host = transport.ready();
      host.say({ t: 'view', view: dummyView, frames: [] });

      const promise = guest.cheat!.add(0, '黑桃1');
      const opMsg = host.sent.find((m) => m.t === 'cheatOp') as Extract<ClientMsg, { t: 'cheatOp' }>;
      expect(opMsg).toBeDefined();
      expect(opMsg.op).toEqual({ k: 'add', target: 0, cardId: '黑桃1' });

      // 房主回覆成功
      host.say({ t: 'cheatResult', id: opMsg.id, error: null });
      await expect(promise).resolves.toBeNull();
    });

    it('房主回報作弊錯誤時正確傳回錯誤原因', async () => {
      const host = transport.ready();
      host.say({ t: 'view', view: dummyView, frames: [] });

      const promise = guest.cheat!.remove(0, 123);
      const opMsg = host.sent.find((m) => m.t === 'cheatOp') as Extract<ClientMsg, { t: 'cheatOp' }>;

      host.say({ t: 'cheatResult', id: opMsg.id, error: '卡片不存在' });
      await expect(promise).resolves.toBe('卡片不存在');
    });

    it('房主超過 10 秒未回應時回報「房主沒有回應」', async () => {
      const host = transport.ready();
      host.say({ t: 'view', view: dummyView, frames: [] });

      const promise = guest.cheat!.add(0, '黑桃2');
      vi.advanceTimersByTime(10_000);
      await expect(promise).resolves.toBe('房主沒有回應');
    });

    it('連線中斷或離開遊戲時未結算作弊操作自動失敗', async () => {
      const host = transport.ready();
      host.say({ t: 'view', view: dummyView, frames: [] });

      const promise1 = guest.cheat!.add(0, '黑桃3');
      host.drop();
      await expect(promise1).resolves.toBe('與房主的連線中斷');

      // 已經中斷後發起新操作
      await expect(guest.cheat!.add(0, '黑桃4')).resolves.toBe('與房主的連線中斷');
    });
  });
});

describe('雙端記憶體直連 P2P 端到端測試（Host + Guest）', () => {
  it('Host 開房、Guest 連入同一房號，成功完成握手、狀態同步與出招', async () => {
    const net = createInMemoryNetwork();
    const host = new HostSession(DECK_HOST, net.host, testReporter);

    const tick = () => new Promise<void>((r) => queueMicrotask(() => r()));

    // 等待 Host 房間開好
    await tick();
    const roomCode = host.getState().roomCode;
    expect(roomCode).toBeDefined();

    // Guest 連入
    const guest = new GuestSession(roomCode!, DECK_GUEST, net.guest);

    // 推進微任務完成握手
    await tick();
    await tick();

    // 雙方狀態皆為 playing
    expect(host.getState().status).toBe('playing');
    expect(guest.getState().status).toBe('playing');
    expect(host.getState().view).not.toBeNull();
    expect(guest.getState().view).not.toBeNull();
    expect(host.getState().opponentOnline).toBe(true);
    expect(guest.getState().opponentOnline).toBe(true);

    // 訪客開關作弊模式同步給房主
    guest.cheat!.setOn(true);
    await tick();
    expect(host.getState().cheatOn[1]).toBe(true);

    host.leave();
    guest.leave();
  });
});
