import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { presetDeck } from '../src/data/presetDecks';
import { FORFEIT_AFTER_S, OFFLINE_AFTER_MS } from '../src/net/protocol';
import { HostSession, LocalSession, TutorialSession } from '../src/net/session';
import { setPlayTracker } from '../src/stats/analytics';
import type { PlayType } from '../src/stats/analytics';
import { FakeTransport } from './fakeTransport';

// 流量統計：對局開始與打完各通知一次；中途離開、離線判負不算打完
let plays: Array<[string, PlayType]> = [];
const restores: Array<() => void> = [];
beforeEach(() => {
  plays = [];
  restores.push(setPlayTracker((kind, opponent) => plays.push([kind, opponent])));
  vi.useFakeTimers();
  vi.setSystemTime(1);
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  });
});
const sessions: Array<{ leave(): void }> = [];
afterEach(() => {
  restores.splice(0).forEach((r) => r());
  sessions.splice(0).forEach((s) => s.leave());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const localSession = () => {
  const s = new LocalSession({ charId: '勇者', cards: presetDeck('勇者') }, { charId: '刺客', cards: presetDeck('刺客') });
  sessions.push(s);
  return s;
};
const playFirst = (s: LocalSession) => s.submit([s.getState().view!.prompt!.options[0].key]);
function playToEnd(s: LocalSession) {
  for (let i = 0; i < 5000 && s.getState().status !== 'over'; i++) {
    if (s.getState().view!.prompt) playFirst(s);
    else vi.advanceTimersByTime(900);
  }
  expect(s.getState().status).toBe('over');
}

describe('流量統計：單機對電腦', () => {
  it('開局就記一次開始，打完再記一次打完，對手類型是電腦', () => {
    const s = localSession();
    expect(plays).toEqual([['start', 'cpu']]);
    playToEnd(s);
    expect(plays).toEqual([['start', 'cpu'], ['finish', 'cpu']]);
  });

  it('結束後再有更新也不會重複記', () => {
    const s = localSession();
    playToEnd(s);
    s.submit(['x']);
    vi.advanceTimersByTime(5000);
    expect(plays).toEqual([['start', 'cpu'], ['finish', 'cpu']]);
  });

  it('開過作弊的對局也算有玩過、有打完（作弊只影響戰績統計）', () => {
    const s = localSession();
    s.cheat!.setOn(true);
    playToEnd(s);
    expect(plays).toEqual([['start', 'cpu'], ['finish', 'cpu']]);
  });

  it('中途離開只有開始，沒有打完', () => {
    const s = localSession();
    playFirst(s);
    s.leave();
    vi.advanceTimersByTime(5000);
    expect(plays).toEqual([['start', 'cpu']]);
  });
});

describe('流量統計：新手教學', () => {
  const tutorial = () => {
    const s = new TutorialSession();
    sessions.push(s);
    return s;
  };
  const playCard = (s: TutorialSession, cardId: string) =>
    s.submit([s.getState().view!.prompt!.options.find((o) => o.cardId === cardId)!.key]);
  /** 一路點擊與出牌；stopAt 指定時，說明出現這段文字就停下 */
  function drive(s: TutorialSession, stopAt?: string) {
    for (let i = 0; i < 200; i++) {
      const t = s.getState().tutorial!;
      if (t.awaiting === null || (stopAt && t.text.includes(stopAt))) return;
      if (t.awaiting === 'click') s.advance();
      else playCard(s, t.awaiting.play);
    }
  }

  it('開局記一次開始，對戰類型是教學，不是單機', () => {
    tutorial();
    expect(plays).toEqual([['start', 'tutorial']]);
  });

  it('走到結束畫面才記完成', () => {
    const s = tutorial();
    drive(s, '牌組就是生命');
    expect(plays).toEqual([['start', 'tutorial']]);
    drive(s);
    expect(s.getState().status).toBe('over');
    expect(plays).toEqual([['start', 'tutorial'], ['finish', 'tutorial']]);
  });

  it('結束後再有更新也不會重複記', () => {
    const s = tutorial();
    drive(s);
    s.advance();
    s.submit(['x']);
    expect(plays).toEqual([['start', 'tutorial'], ['finish', 'tutorial']]);
  });

  it('中途離開只有開始，沒有完成', () => {
    const s = tutorial();
    drive(s, '牌組就是生命');
    s.leave();
    s.advance();
    expect(plays).toEqual([['start', 'tutorial']]);
  });
});

describe('流量統計：連線對戰的房主', () => {
  function startHosted() {
    const transport = new FakeTransport();
    const host = new HostSession({ charId: '勇者', cards: presetDeck('勇者') }, transport);
    sessions.push(host);
    transport.ready();
    const guest = transport.connect();
    guest.say({ t: 'hello', deck: { charId: '刺客', cards: presetDeck('刺客') } });
    return { host, guest };
  }

  it('等朋友加入的時候不算，朋友加入、對局開始才記一次開始，對手類型是玩家', () => {
    const transport = new FakeTransport();
    const host = new HostSession({ charId: '勇者', cards: presetDeck('勇者') }, transport);
    sessions.push(host);
    transport.ready();
    expect(plays).toEqual([]);
    transport.connect().say({ t: 'hello', deck: { charId: '刺客', cards: presetDeck('刺客') } });
    expect(plays).toEqual([['start', 'player']]);
  });

  it('訪客離線被判負不算打完', () => {
    const { host } = startHosted();
    vi.advanceTimersByTime(OFFLINE_AFTER_MS + 1000 + FORFEIT_AFTER_S * 1000);
    expect(host.getState().status).toBe('over');
    expect(plays).toEqual([['start', 'player']]);
  });
});
