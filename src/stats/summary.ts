import type { BattleRecord, Opponent, Outcome } from './records';

/**
 * 勝率統計最低版本：遊戲版本低於它的戰績，勝負規則和現在不同，只計入回合數圖表，不進勝率。
 * 之後每次改動勝負相關的規則，就把它升到該版本。
 */
export const MIN_WIN_RATE_VERSION = '0.27.3';

export type OpponentFilter = 'all' | Opponent;

/** 語意化版本的數值比較；缺的段當 0，不能用字串比較（0.9 要小於 0.10） */
export function compareVersion(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

export const filterByOpponent = (records: BattleRecord[], filter: OpponentFilter): BattleRecord[] =>
  filter === 'all' ? records : records.filter((r) => r.opponent === filter);

/** 這筆戰績能不能進勝率統計 */
export const countsForWinRate = (r: BattleRecord): boolean => compareVersion(r.version, MIN_WIN_RATE_VERSION) >= 0;

export interface Tally {
  win: number;
  lose: number;
  draw: number;
}

export interface Cell extends Tally {
  /** 勝 + 負 + 平 */
  games: number;
  /** 勝 ÷ (勝 + 負)，平手不進分母；沒有分出勝負的場次、或同角色對打時為 null */
  rate: number | null;
}

const flip = (o: Outcome): Outcome => (o === 'win' ? 'lose' : o === 'lose' ? 'win' : 'draw');

function cellOf(tally: Tally, mirror: boolean): Cell {
  const decided = tally.win + tally.lose;
  return { ...tally, games: decided + tally.draw, rate: mirror || decided === 0 ? null : tally.win / decided };
}

/**
 * a 對 b 的戰績：我用 a、對手用 b 的場次，加上我用 b、對手用 a 而結果反過來的場次，兩個方向合併。
 * 同角色對打時勝率沒有意義（同一場又贏又輸），rate 一律為 null，勝負平照我的視角列出場數。
 * records 呼叫端已篩過對手類型；這裡只看勝率統計能不能用的版本。
 */
export function matchup(records: BattleRecord[], a: string, b: string): Cell {
  const t: Tally = { win: 0, lose: 0, draw: 0 };
  for (const r of records) {
    if (!countsForWinRate(r)) continue;
    if (r.mine === a && r.theirs === b) t[r.outcome]++;
    else if (a !== b && r.mine === b && r.theirs === a) t[flip(r.outcome)]++;
  }
  return cellOf(t, a === b);
}

export interface CharacterSummary {
  /** 對上所有其他角色的合計；同角色對打不算，勝率另外沒有意義的情況同 Cell */
  total: Cell;
  /** 對上每個角色（含自己）的對戰，與 chars 同順序 */
  versus: { opponent: string; cell: Cell }[];
}

/** 單看一個角色：對上每個角色的對戰（兩個方向合併），以及對上其他角色的總勝率 */
export function characterSummary(records: BattleRecord[], char: string, chars: string[]): CharacterSummary {
  const versus = chars.map((opponent) => ({ opponent, cell: matchup(records, char, opponent) }));
  const sum: Tally = { win: 0, lose: 0, draw: 0 };
  for (const { opponent, cell } of versus) {
    if (opponent === char) continue;
    sum.win += cell.win;
    sum.lose += cell.lose;
    sum.draw += cell.draw;
  }
  return { total: cellOf(sum, false), versus };
}

/** 角色對戰表：列是 a，欄是 b，與 chars 同順序 */
export function matchupTable(records: BattleRecord[], chars: string[]): Cell[][] {
  return chars.map((a) => chars.map((b) => matchup(records, a, b)));
}

/** 因為版本太舊而只計入回合數圖表的場數 */
export const legacyCount = (records: BattleRecord[]): number => records.filter((r) => !countsForWinRate(r)).length;

/** 回合數圖表的範圍：不給是全部；給一個角色是該角色出場（不分哪一邊）；給兩個角色是這組對戰（兩個方向合併） */
export type TurnScope = { a: string; b?: string };

export interface TurnStats {
  /** 從最短到最長的每個回合數各幾場，中間沒有場次的回合數補 0 */
  histogram: { turns: number; games: number }[];
  games: number;
  avg: number;
  min: number;
  max: number;
}

const inScope = (r: BattleRecord, scope: TurnScope | undefined): boolean => {
  if (!scope) return true;
  const { a, b } = scope;
  if (b === undefined) return r.mine === a || r.theirs === a;
  return (r.mine === a && r.theirs === b) || (r.mine === b && r.theirs === a);
};

/** 回合數分布與平均、最短、最長；舊版本的戰績也計入（回合數不受勝負規則影響）。沒有場次時回傳 null */
export function turnStats(records: BattleRecord[], scope?: TurnScope): TurnStats | null {
  const turns = records.filter((r) => inScope(r, scope)).map((r) => r.turns);
  if (turns.length === 0) return null;
  const min = Math.min(...turns);
  const max = Math.max(...turns);
  const counts = new Map<number, number>();
  for (const t of turns) counts.set(t, (counts.get(t) ?? 0) + 1);
  const histogram = [];
  for (let t = min; t <= max; t++) histogram.push({ turns: t, games: counts.get(t) ?? 0 });
  return { histogram, games: turns.length, avg: turns.reduce((n, t) => n + t, 0) / turns.length, min, max };
}
