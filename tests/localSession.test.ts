import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { presetDeck } from '../src/data/presetDecks';
import { LocalSession } from '../src/net/session';
import type { BattleRecord } from '../src/stats/records';
import { setRecordSink } from '../src/stats/sink';

// 時間固定在 1：亂數種子是現在時間，這樣玩家先攻，而且第一次出招後輪到機器人
// 戰績不再寫本機，而是交給上傳；測試換成自己的接收函式，直接看交出去了什麼
let captured: BattleRecord[] = [];
let restoreSink = () => {};
beforeEach(() => {
  captured = [];
  restoreSink = setRecordSink((r) => captured.push(r));
  vi.useFakeTimers();
  vi.setSystemTime(1);
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  });
});
const sessions: LocalSession[] = [];
afterEach(() => {
  restoreSink();
  sessions.splice(0).forEach((s) => s.leave());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function start() {
  const s = new LocalSession(
    { charId: '勇者', cards: presetDeck('勇者') }, { charId: '刺客', cards: presetDeck('刺客') },
  );
  sessions.push(s);
  return s;
}

/** 玩家用第一個選項回應目前的提示 */
const playFirst = (s: LocalSession) => s.submit([s.getState().view!.prompt!.options[0].key]);

describe('單機練習', () => {
  it('開局就有視角、首批影格，狀態是進行中', () => {
    const st = start().getState();
    expect(st.status).toBe('playing');
    expect(st.view!.me).toBe(0);
    expect(st.batch.frames.length).toBeGreaterThan(0);
  });

  it('提交不合法的選項：顯示訊息，畫面其餘不變', () => {
    const s = start();
    const before = s.getState().batch.id;
    s.submit(['不存在的選項']);
    expect(s.getState().message).toContain('選項不合法');
    expect(s.getState().batch.id).toBe(before);
  });

  it('輪到機器人時延遲 900ms 才回應', () => {
    const s = start();
    playFirst(s);
    expect(s.getState().view!.waitingFor).toBe(1);
    const id = s.getState().batch.id;
    vi.advanceTimersByTime(899);
    expect(s.getState().batch.id).toBe(id);
    vi.advanceTimersByTime(1);
    expect(s.getState().batch.id).toBeGreaterThan(id);
  });

  it('連續作弊不會讓機器人一直等', () => {
    const s = start();
    playFirst(s);
    expect(s.getState().view!.waitingFor).toBe(1);
    const id = s.getState().batch.id;
    // 機器人在 900ms 時出招；期間每 300ms 開關一次作弊，不應該重設它的計時
    vi.advanceTimersByTime(300);
    s.cheat!.setOn(true);
    vi.advanceTimersByTime(300);
    s.cheat!.setOn(false);
    const afterCheat = s.getState().batch.id;
    expect(afterCheat).toBeGreaterThan(id); // 作弊的發佈
    vi.advanceTimersByTime(300);
    expect(s.getState().batch.id).toBeGreaterThan(afterCheat); // 機器人照時間出招
  });

  it('作弊介面：開關、檢視、加入與移除手牌', async () => {
    const s = start();
    expect(s.cheat!.snapshot()).toBeNull();
    s.cheat!.setOn(true);
    expect(s.getState().cheatOn).toEqual([true, false]);
    expect(s.cheat!.snapshot()).not.toBeNull();
    const before = s.getState().view!.players[0].hand.length;
    expect(await s.cheat!.add(0, '黑桃9')).toBeNull();
    expect(s.getState().view!.players[0].hand).toHaveLength(before + 1);
    expect(await s.cheat!.remove(0, 99999)).toContain('手牌');
    s.cheat!.setOn(false);
    expect(s.getState().cheatOn).toEqual([false, false]);
  });

  it('離開後不再回應，機器人也不再出招', async () => {
    const s = start();
    playFirst(s);
    s.leave();
    const id = s.getState().batch.id;
    vi.advanceTimersByTime(5000);
    s.submit(['x']);
    s.cheat!.setOn(true);
    expect(await s.cheat!.add(0, '黑桃9')).toBe('已離開遊戲');
    expect(s.getState().batch.id).toBe(id);
    expect(s.getState().cheatOn).toEqual([false, false]);
  });
});

/** 玩家一律選第一個選項，機器人照時間出招，直到對局結束 */
function playToEnd(s: LocalSession) {
  for (let i = 0; i < 5000 && s.getState().status !== 'over'; i++) {
    if (s.getState().view!.prompt) playFirst(s);
    else vi.advanceTimersByTime(900);
  }
  expect(s.getState().status).toBe('over');
}

describe('單機練習：戰績', () => {
  it('對局正常打完留下一筆戰績：對手是電腦，欄位對得上最終畫面', () => {
    const s = start();
    expect(captured).toEqual([]);
    playToEnd(s);
    const v = s.getState().view!;
    const expected = v.winner === 'draw' ? 'draw' : v.winner === 0 ? 'win' : 'lose';
    expect(captured).toEqual([
      { version: expect.any(String), opponent: 'cpu', mine: '勇者', theirs: '刺客', outcome: expected, turns: v.turn, first: v.openingFirst === 0 },
    ]);
  });

  it('結束後再有更新也不會重複記錄', () => {
    const s = start();
    playToEnd(s);
    s.submit(['x']);
    vi.advanceTimersByTime(5000);
    expect(captured).toHaveLength(1);
  });

  it('對局期間開過作弊（即使後來關掉）就不記錄', () => {
    const s = start();
    s.cheat!.setOn(true);
    s.cheat!.setOn(false);
    playToEnd(s);
    expect(s.getState().view!.cheated).toBe(true);
    expect(captured).toEqual([]);
  });

  it('中途離開不記錄', () => {
    const s = start();
    playFirst(s);
    s.leave();
    vi.advanceTimersByTime(5000);
    expect(captured).toEqual([]);
  });
});
