import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { presetDeck } from '../src/data/presetDecks';
import { FORFEIT_AFTER_S, OFFLINE_AFTER_MS, type HostMsg } from '../src/net/protocol';
import { HostSession } from '../src/net/session';
import { FakeTransport } from './fakeTransport';

// 房主有定時器（心跳偵測、離線倒數），一律用假計時器
beforeEach(() => void vi.useFakeTimers());
const hosts: HostSession[] = [];
afterEach(() => {
  hosts.splice(0).forEach((h) => h.leave());
  vi.useRealTimers();
});

function open() {
  const transport = new FakeTransport();
  const host = new HostSession({ charId: '勇者', cards: presetDeck('勇者') }, transport);
  hosts.push(host);
  return { host, transport };
}

const HELLO = { t: 'hello', deck: { charId: '刺客', cards: presetDeck('刺客') } } as const;

function start() {
  const { host, transport } = open();
  transport.ready();
  const guest = transport.connect();
  guest.say(HELLO);
  return { host, transport, guest };
}

const lastView = (sent: HostMsg[]) => [...sent].reverse().find((m) => m.t === 'view') as Extract<HostMsg, { t: 'view' }>;

describe('房主：開房', () => {
  it('房間開好後顯示房號並等待朋友', () => {
    const { host, transport } = open();
    expect(host.getState().status).toBe('connecting');
    transport.ready();
    expect(host.getState().status).toBe('waiting');
    expect(host.getState().roomCode).toBe(transport.latest.code);
  });

  it('房號被占用時換房號重試，舊的房間關掉', () => {
    const { host, transport } = open();
    transport.fail({ kind: 'taken' });
    expect(transport.rooms).toHaveLength(2);
    expect(transport.rooms[0].closed).toBe(true);
    expect(host.getState().status).toBe('connecting');
    transport.ready();
    expect(host.getState().status).toBe('waiting');
    expect(host.getState().roomCode).toBe(transport.latest.code);
  });

  it('重試超過次數就回報錯誤', () => {
    const { host, transport } = open();
    for (let i = 0; i < 5; i++) transport.fail({ kind: 'taken' });
    expect(transport.rooms).toHaveLength(6);
    expect(host.getState().status).toBe('connecting');
    transport.fail({ kind: 'taken' });
    expect(host.getState().status).toBe('error');
    expect(host.getState().message).toContain('unavailable-id');
  });

  it('其他錯誤直接回報，不重試', () => {
    const { host, transport } = open();
    transport.fail({ kind: 'other', detail: 'network' });
    expect(transport.rooms).toHaveLength(1);
    expect(host.getState().status).toBe('error');
    expect(host.getState().message).toContain('network');
  });

  it('離開時關掉連線與房間', () => {
    const { host, transport } = open();
    transport.ready();
    const guest = transport.connect();
    host.leave();
    expect(guest.closedByHost).toBe(true);
    expect(transport.latest.closed).toBe(true);
  });
});

describe('房主：訪客的連線', () => {
  it('訪客的牌組不合法就拒絕並說明第一個錯誤，遊戲不開始', () => {
    const { host, transport } = open();
    transport.ready();
    const guest = transport.connect();
    guest.say({ t: 'hello', deck: { charId: '刺客', cards: [] } });
    expect(guest.sent).toHaveLength(1);
    expect(guest.sent[0]).toMatchObject({ t: 'reject' });
    expect((guest.sent[0] as { reason: string }).reason).toMatch(/^牌組不合法：/);
    expect(host.getState().view).toBeNull();
    // 改好牌組可以再送一次
    guest.say(HELLO);
    expect(host.getState().view).not.toBeNull();
  });

  it('開局後收到合法牌組：雙方都拿到開局的視角與影格', () => {
    const { host, guest } = start();
    expect(host.getState().status).toBe('playing');
    expect(host.getState().batch.frames.length).toBeGreaterThan(0);
    const v = lastView(guest.sent);
    expect(v.view.me).toBe(1);
    expect(v.frames.length).toBe(host.getState().batch.frames.length);
  });

  it('房間已滿或遊戲已開始時，第二個連線被拒絕並關閉', () => {
    const { transport } = start();
    const second = transport.connect();
    expect(second.sent).toEqual([{ t: 'reject', reason: '房間已滿或遊戲已開始' }]);
    expect(second.closedByHost).toBe(false);
    vi.advanceTimersByTime(300);
    expect(second.closedByHost).toBe(true);
  });

  it('還沒開局但已有人連著時，第二個連線同樣被拒絕', () => {
    const { transport } = open();
    transport.ready();
    transport.connect();
    const second = transport.connect();
    expect(second.sent).toEqual([{ t: 'reject', reason: '房間已滿或遊戲已開始' }]);
  });

  it('還沒開局訪客就離開：房間重新開放', () => {
    const { transport } = open();
    transport.ready();
    transport.connect().drop();
    const next = transport.connect();
    expect(next.sent).toEqual([]);
    next.say(HELLO);
    expect(lastView(next.sent)).toBeDefined();
  });

  it('收到 ping 回 pong', () => {
    const { transport } = open();
    transport.ready();
    const guest = transport.connect();
    guest.say({ t: 'ping' });
    expect(guest.sent).toEqual([{ t: 'pong' }]);
  });

  it('訪客提交失敗時回 reject 並補送現況，不影響房主的畫面', () => {
    const { host, guest } = start();
    const before = host.getState().batch.id;
    guest.say({ t: 'submit', keys: ['不存在的選項'] });
    const tail = guest.sent.slice(-2).map((m) => m.t);
    expect(tail).toEqual(['reject', 'view']);
    expect(host.getState().batch.id).toBe(before);
  });
});

describe('房主：訪客離線', () => {
  it('超過離線門檻沒有回應，標記對手離線並開始倒數', () => {
    const { host } = start();
    vi.advanceTimersByTime(OFFLINE_AFTER_MS);
    expect(host.getState().opponentOnline).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(host.getState().opponentOnline).toBe(false);
    expect(host.getState().forfeitIn).toBe(FORFEIT_AFTER_S);
    vi.advanceTimersByTime(1000);
    expect(host.getState().forfeitIn).toBe(FORFEIT_AFTER_S - 1);
  });

  it('倒數結束判房主獲勝，雙方都收到更新', () => {
    const { host, guest } = start();
    vi.advanceTimersByTime(OFFLINE_AFTER_MS + 1000 + FORFEIT_AFTER_S * 1000);
    expect(host.getState().status).toBe('over');
    expect(host.getState().view!.winner).toBe(0);
    expect(host.getState().forfeitIn).toBeNull();
    const v = lastView(guest.sent);
    expect(v.view.winner).toBe(0);
    expect(v.view.winReason).toContain('離線');
  });

  it('倒數期間訪客再次出聲，倒數取消並恢復在線，遊戲不會判負', () => {
    const { host, guest } = start();
    vi.advanceTimersByTime(OFFLINE_AFTER_MS + 1000 + 5000);
    expect(host.getState().opponentOnline).toBe(false);
    guest.say({ t: 'ping' });
    expect(host.getState().opponentOnline).toBe(true);
    expect(host.getState().forfeitIn).toBeNull();
    vi.advanceTimersByTime(OFFLINE_AFTER_MS - 1000); // 還沒到下一次離線門檻
    expect(host.getState().status).toBe('playing');
    expect(host.getState().view!.winner).toBeNull();
  });

  it('連線中斷時立刻開始倒數', () => {
    const { host, guest } = start();
    guest.drop();
    expect(host.getState().opponentOnline).toBe(false);
    expect(host.getState().forfeitIn).toBe(FORFEIT_AFTER_S);
  });
});
