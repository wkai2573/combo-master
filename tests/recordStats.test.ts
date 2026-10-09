import { describe, expect, it } from 'vitest';
import type { BattleRecord } from '../src/stats/records';
import { compareVersion, filterByOpponent, legacyCount, matchup, matchupTable, MIN_WIN_RATE_VERSION } from '../src/stats/summary';

const V = MIN_WIN_RATE_VERSION;
const rec = (mine: string, theirs: string, outcome: BattleRecord['outcome'], over: Partial<BattleRecord> = {}): BattleRecord => ({
  version: V, opponent: 'cpu', mine, theirs, outcome, turns: 5, ...over,
});

describe('版本比較', () => {
  it('用數值大小比較，不是字串：0.9 比 0.10 舊', () => {
    expect(compareVersion('0.9.0', '0.10.0')).toBeLessThan(0);
    expect(compareVersion('0.27.3', '0.27.3')).toBe(0);
    expect(compareVersion('1.0.0', '0.99.99')).toBeGreaterThan(0);
  });
});

describe('對手類型篩選', () => {
  it('全部、電腦、玩家', () => {
    const list = [rec('勇者', '刺客', 'win'), rec('勇者', '刺客', 'win', { opponent: 'player' })];
    expect(filterByOpponent(list, 'all')).toHaveLength(2);
    expect(filterByOpponent(list, 'cpu').map((r) => r.opponent)).toEqual(['cpu']);
    expect(filterByOpponent(list, 'player').map((r) => r.opponent)).toEqual(['player']);
  });
});

describe('兩個角色的對戰統計', () => {
  it('勝率是勝 ÷ (勝 + 負)，平手不進分母，但場數含平手', () => {
    const c = matchup([rec('勇者', '刺客', 'win'), rec('勇者', '刺客', 'win'), rec('勇者', '刺客', 'lose'), rec('勇者', '刺客', 'draw')], '勇者', '刺客');
    expect(c).toEqual({ win: 2, lose: 1, draw: 1, games: 4, rate: 2 / 3 });
  });

  it('兩個方向合併：對手用 a 而我輸掉，也算 a 的勝場；兩邊的格子互補', () => {
    const list = [rec('勇者', '刺客', 'win'), rec('刺客', '勇者', 'lose'), rec('刺客', '勇者', 'win'), rec('勇者', '刺客', 'draw')];
    expect(matchup(list, '勇者', '刺客')).toEqual({ win: 2, lose: 1, draw: 1, games: 4, rate: 2 / 3 });
    expect(matchup(list, '刺客', '勇者')).toEqual({ win: 1, lose: 2, draw: 1, games: 4, rate: 1 / 3 });
  });

  it('沒有場次或只有平手時勝率是 null', () => {
    expect(matchup([], '勇者', '刺客')).toEqual({ win: 0, lose: 0, draw: 0, games: 0, rate: null });
    expect(matchup([rec('勇者', '刺客', 'draw')], '勇者', '刺客')).toMatchObject({ games: 1, rate: null });
  });

  it('同角色對打只有場數，沒有勝率', () => {
    const c = matchup([rec('勇者', '勇者', 'win'), rec('勇者', '勇者', 'lose'), rec('勇者', '勇者', 'win')], '勇者', '勇者');
    expect(c.games).toBe(3);
    expect(c.rate).toBeNull();
  });

  it('其他角色的場次不算進來', () => {
    expect(matchup([rec('勇者', '法師', 'win')], '勇者', '刺客').games).toBe(0);
  });

  it('舊版本的戰績不進勝率，並可算出被排除幾場', () => {
    const list = [rec('勇者', '刺客', 'win'), rec('勇者', '刺客', 'win', { version: '0.1.0' }), rec('勇者', '刺客', 'lose', { version: '0.27.2' })];
    expect(matchup(list, '勇者', '刺客')).toMatchObject({ win: 1, lose: 0, games: 1 });
    expect(legacyCount(list)).toBe(2);
  });

  it('剛好是最低版本與更新的版本都進勝率', () => {
    const list = [rec('勇者', '刺客', 'win', { version: V }), rec('勇者', '刺客', 'win', { version: '0.100.0' })];
    expect(matchup(list, '勇者', '刺客').games).toBe(2);
    expect(legacyCount(list)).toBe(0);
  });
});

describe('角色對戰表', () => {
  it('列與欄依角色清單順序，對角線是同角色對打', () => {
    const chars = ['勇者', '刺客'];
    const t = matchupTable([rec('勇者', '刺客', 'win'), rec('勇者', '勇者', 'lose')], chars);
    expect(t).toHaveLength(2);
    expect(t[0][1]).toMatchObject({ win: 1, rate: 1 });
    expect(t[1][0]).toMatchObject({ lose: 1, rate: 0 });
    expect(t[0][0]).toMatchObject({ games: 1, rate: null });
    expect(t[1][1].games).toBe(0);
  });
});
