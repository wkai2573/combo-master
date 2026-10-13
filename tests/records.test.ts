import { describe, expect, it } from 'vitest';
import type { GameView } from '../src/engine/view';
import { recordFromView } from '../src/stats/records';

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
