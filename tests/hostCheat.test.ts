import { afterEach, describe, expect, it, vi } from 'vitest';
import { presetDeck } from '../src/data/presetDecks';
import type { HostMsg } from '../src/net/protocol';
import { HostSession } from '../src/net/session';

// 不連真正的連線服務
vi.mock('peerjs', () => ({
  default: class {
    on() {}
    destroy() {}
  },
}));

/** 假的連線：記下房主送出的訊息，並讓測試以訪客的身分送訊息給房主 */
function fakeGuest() {
  const sent: HostMsg[] = [];
  const handlers: Record<string, (d?: unknown) => void> = {};
  const conn = {
    open: true,
    send: (m: HostMsg) => void sent.push(m),
    on: (ev: string, cb: (d?: unknown) => void) => void (handlers[ev] = cb),
    close: () => {},
  };
  return { conn, sent, say: (msg: unknown) => handlers.data(msg) };
}

const hosts: HostSession[] = [];
afterEach(() => {
  hosts.splice(0).forEach((h) => h.leave());
});

/** 房主與訪客連上、開局 */
function start() {
  const host = new HostSession({ charId: '勇者', cards: presetDeck('勇者') });
  hosts.push(host);
  const guest = fakeGuest();
  (host as unknown as { onConnection(c: unknown): void }).onConnection(guest.conn);
  guest.say({ t: 'hello', deck: { charId: '刺客', cards: presetDeck('刺客') } });
  return { host, guest };
}

const lastView = (sent: HostMsg[]) => [...sent].reverse().find((m) => m.t === 'view') as Extract<HostMsg, { t: 'view' }>;
const results = (sent: HostMsg[]) => sent.filter((m) => m.t === 'cheatResult') as Extract<HostMsg, { t: 'cheatResult' }>[];

describe('房主處理訪客的作弊訊息', () => {
  it('沒開作弊時，訪客收到的視角沒有作弊檢視，作弊操作被拒絕並回報原因', () => {
    const { guest } = start();
    expect(lastView(guest.sent).cheatSnap ?? null).toBeNull();
    expect(lastView(guest.sent).cheatOn ?? [false, false]).toEqual([false, false]);
    guest.say({ t: 'cheatOp', id: 1, op: { k: 'add', target: 0, cardId: '黑桃9' } });
    expect(results(guest.sent)).toEqual([{ t: 'cheatResult', id: 1, error: '作弊模式沒有開啟' }]);
  });

  it('訪客開啟後：兩邊都知道誰開了，只有訪客拿到檢視，房主自己的視角照舊', () => {
    const { host, guest } = start();
    guest.say({ t: 'cheat', on: true });
    const v = lastView(guest.sent);
    expect(v.cheatOn).toEqual([false, true]);
    expect(v.cheatSnap).not.toBeNull();
    expect(v.cheatSnap![0].hand.length).toBeGreaterThan(0); // 訪客看得到房主的手牌
    expect(host.getState().cheatOn).toEqual([false, true]); // 房主畫面據此顯示對手開啟作弊
    expect(host.cheat.snapshot()).toBeNull(); // 房主沒開，沒有檢視
    expect(host.getState().view!.players[1].hand.every((c) => c.id === null)).toBe(true); // 房主仍看不到訪客的手牌
  });

  it('訪客的操作由房主執行：結果回報成功，新視角送回，雙方的紀錄寫明是玩家B', () => {
    const { host, guest } = start();
    guest.say({ t: 'cheat', on: true });
    const before = host.getState().view!.players[0].hand.length;
    guest.say({ t: 'cheatOp', id: 7, op: { k: 'add', target: 0, cardId: '黑桃9' } });
    expect(results(guest.sent)).toEqual([{ t: 'cheatResult', id: 7, error: null }]);
    expect(host.getState().view!.players[0].hand).toHaveLength(before + 1);
    for (const log of [host.getState().view!.log, lastView(guest.sent).view.log]) {
      const line = log.find((l) => l.includes('將【黑桃9】加入'));
      expect(line).toContain('玩家B');
    }
    // 成功的操作之後，視角與檢視是最新的
    expect(lastView(guest.sent).cheatSnap![0].hand.some((c) => c.id === '黑桃9')).toBe(true);
  });

  it('操作者以連線身分為準：訊息裡自稱別人也沒用', () => {
    const { host, guest } = start();
    guest.say({ t: 'cheat', on: true });
    guest.say({ t: 'cheatOp', id: 1, by: 0, op: { k: 'add', target: 1, cardId: '黑桃9' } });
    const line = host.getState().view!.log.find((l) => l.includes('將【黑桃9】加入'))!;
    expect(line).toContain('玩家B');
  });

  it('被拒絕時回報原因，並補送最新的視角，桌面不變', () => {
    const { host, guest } = start();
    guest.say({ t: 'cheat', on: true });
    const before = JSON.stringify(host.getState().view!.players);
    const n = guest.sent.length;
    guest.say({ t: 'cheatOp', id: 2, op: { k: 'remove', target: 0, uid: 99999 } });
    const out = guest.sent.slice(n);
    expect(out.map((m) => m.t)).toEqual(['view', 'cheatResult']);
    expect((out[1] as { error: string }).error).toContain('手牌');
    expect(JSON.stringify(host.getState().view!.players)).toBe(before);
  });

  it('房主自己的作弊：開啟後對手那邊顯示，操作寫進雙方可見的紀錄，關閉後提示消失', async () => {
    const { host, guest } = start();
    host.cheat.setOn(true);
    expect(lastView(guest.sent).cheatOn).toEqual([true, false]);
    expect(lastView(guest.sent).cheatSnap ?? null).toBeNull(); // 訪客沒開，拿不到檢視
    expect(host.cheat.snapshot()).not.toBeNull();
    expect(await host.cheat.add(1, '黑桃9')).toBeNull();
    expect(lastView(guest.sent).view.log.some((l) => l.includes('將【黑桃9】加入') && l.includes('玩家A'))).toBe(true);
    host.cheat.setOn(false);
    expect(lastView(guest.sent).cheatOn).toEqual([false, false]);
  });

  it('訪客的畫面過期而回應被拒絕時，補送的視角仍帶著作弊的開關與檢視', () => {
    const { guest } = start();
    guest.say({ t: 'cheat', on: true });
    guest.say({ t: 'submit', keys: ['不存在的選項'] });
    const v = lastView(guest.sent);
    expect(guest.sent.some((m) => m.t === 'reject')).toBe(true);
    expect(v.cheatOn).toEqual([false, true]);
    expect(v.cheatSnap).not.toBeNull();
  });

  it('不合法的牌區名稱被拒絕並說明', () => {
    const { guest } = start();
    guest.say({ t: 'cheat', on: true });
    guest.say({ t: 'cheatOp', id: 3, op: { k: 'reorder', target: 0, zone: '__proto__', uids: [] } });
    expect(results(guest.sent)).toEqual([{ t: 'cheatResult', id: 3, error: '牌區不合法' }]);
  });

  it('遊戲開始前的作弊訊息被忽略', () => {
    const host = new HostSession({ charId: '勇者', cards: presetDeck('勇者') });
    hosts.push(host);
    const guest = fakeGuest();
    (host as unknown as { onConnection(c: unknown): void }).onConnection(guest.conn);
    guest.say({ t: 'cheat', on: true });
    guest.say({ t: 'cheatOp', id: 1, op: { k: 'add', target: 0, cardId: '黑桃9' } });
    expect(guest.sent).toEqual([]);
  });
});
