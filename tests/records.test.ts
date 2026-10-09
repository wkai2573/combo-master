import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameView } from '../src/engine/view';
import { addRecord, clearRecords, listRecords, recordFromView, type BattleRecord } from '../src/stats/records';

/** 只填戰績會讀的欄位的視角 */
function viewOf(over: Partial<Pick<GameView, 'me' | 'turn' | 'winner' | 'cheated' | 'forfeited' | 'openingFirst'>> & { mine?: string; theirs?: string } = {}): GameView {
  const { mine = '勇者', theirs = '刺客', ...rest } = over;
  const me = rest.me ?? 0;
  const players = me === 0 ? [mine, theirs] : [theirs, mine];
  return {
    me: 0, turn: 5, winner: 0, cheated: false, forfeited: false, openingFirst: 0, ...rest,
    players: players.map((charId) => ({ charId })),
  } as unknown as GameView;
}

describe('戰績：從結束的視角產生', () => {
  it('勝、負、平各產生一筆，欄位是版本、對手類型、雙方角色、結果、回合數與我是否開局先攻', () => {
    expect(recordFromView(viewOf({ winner: 0 }), 'cpu', '1.2.3')).toEqual({
      version: '1.2.3', opponent: 'cpu', mine: '勇者', theirs: '刺客', outcome: 'win', turns: 5, first: true,
    });
    expect(recordFromView(viewOf({ winner: 1 }), 'player', '1.2.3')?.outcome).toBe('lose');
    expect(recordFromView(viewOf({ winner: 'draw' }), 'player', '1.2.3')?.outcome).toBe('draw');
  });

  it('以自己的視角記：訪客是玩家 B，自己的角色放在 mine', () => {
    const r = recordFromView(viewOf({ me: 1, winner: 1, mine: '法師', theirs: '遊俠' }), 'player', '1.0.0')!;
    expect(r).toMatchObject({ mine: '法師', theirs: '遊俠', outcome: 'win' });
  });

  it('開局先攻是對手時記成後攻；訪客用自己的編號判斷', () => {
    expect(recordFromView(viewOf({ openingFirst: 1 }), 'cpu', '1.0.0')?.first).toBe(false);
    expect(recordFromView(viewOf({ me: 1, openingFirst: 1 }), 'player', '1.0.0')?.first).toBe(true);
    expect(recordFromView(viewOf({ me: 1, openingFirst: 0 }), 'player', '1.0.0')?.first).toBe(false);
  });

  it('舊版房主的視角沒有開局先攻：照樣記，只是沒有先後攻欄位', () => {
    const old = viewOf() as unknown as Record<string, unknown>;
    delete old.openingFirst;
    const r = recordFromView(old as unknown as GameView, 'player', '1.0.0')!;
    expect(r.outcome).toBe('win');
    expect('first' in r).toBe(false);
  });

  it('還沒結束、離線或認輸結束、有人開過作弊都不產生', () => {
    expect(recordFromView(viewOf({ winner: null }), 'cpu', '1.0.0')).toBeNull();
    expect(recordFromView(viewOf({ forfeited: true }), 'player', '1.0.0')).toBeNull();
    expect(recordFromView(viewOf({ cheated: true }), 'cpu', '1.0.0')).toBeNull();
  });

  it('舊版房主送來的視角沒有離線與作弊旗標，無法確定就不記', () => {
    const old = viewOf() as unknown as Record<string, unknown>;
    delete old.cheated;
    delete old.forfeited;
    expect(recordFromView(old as unknown as GameView, 'player', '1.0.0')).toBeNull();
  });
});

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

const rec = (over: Partial<BattleRecord> = {}): BattleRecord => ({
  version: '1.0.0', opponent: 'cpu', mine: '勇者', theirs: '刺客', outcome: 'win', turns: 4, ...over,
});

describe('戰績：儲存', () => {
  let store: ReturnType<typeof fakeStorage>;
  beforeEach(() => void vi.stubGlobal('localStorage', (store = fakeStorage())));
  afterEach(() => void vi.unstubAllGlobals());

  it('沒有紀錄時是空的；新增的依序列出；清除後回到空的', () => {
    expect(listRecords()).toEqual([]);
    addRecord(rec({ turns: 3 }));
    addRecord(rec({ turns: 6, outcome: 'lose' }));
    expect(listRecords().map((r) => r.turns)).toEqual([3, 6]);
    clearRecords();
    expect(listRecords()).toEqual([]);
  });

  it('資料損毀時當成沒有紀錄，格式不符的筆數被略過', () => {
    store.data.set('lianji.records.v1', '不是 JSON');
    expect(listRecords()).toEqual([]);
    store.data.set('lianji.records.v1', JSON.stringify([rec(), { version: 1 }, null, rec({ turns: 9 })]));
    expect(listRecords().map((r) => r.turns)).toEqual([4, 9]);
    store.data.set('lianji.records.v1', JSON.stringify({ a: 1 }));
    expect(listRecords()).toEqual([]);
  });

  it('先後攻欄位可有可無，但有的話必須是布林值', () => {
    store.data.set('lianji.records.v1', JSON.stringify([rec({ turns: 1 }), rec({ turns: 2, first: false }), { ...rec({ turns: 3 }), first: 'yes' }]));
    expect(listRecords().map((r) => [r.turns, r.first])).toEqual([[1, undefined], [2, false]]);
  });

  it('儲存空間不能用（讀寫都丟錯）時不丟錯，視同沒有紀錄', () => {
    const boom = () => {
      throw new Error('私密模式');
    };
    vi.stubGlobal('localStorage', { getItem: boom, setItem: boom, removeItem: boom });
    expect(() => addRecord(rec())).not.toThrow();
    expect(listRecords()).toEqual([]);
    expect(() => clearRecords()).not.toThrow();
  });
});
