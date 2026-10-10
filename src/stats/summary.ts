import type { BattleRecord, Opponent, Outcome } from './records';

/**
 * 勝率統計最低版本：遊戲版本低於它的戰績，規則和現在不同。它只決定戰績頁預設選取哪些版本
 * （見 defaultVersions）；使用者明確勾選更舊的版本時照樣計入。
 * 之後每次改動勝負相關的規則，就把它升到該版本。
 */
export const MIN_WIN_RATE_VERSION = '0.33.0';

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

/** 這筆戰績是不是規則和現在不同的舊版本（低於勝率統計最低版本） */
export const isLegacyVersion = (r: BattleRecord): boolean => compareVersion(r.version, MIN_WIN_RATE_VERSION) < 0;

/** 戰績裡出現過的版本與各版本的場數，由新到舊（用數值比較，0.10 比 0.9 新） */
export function versionCounts(records: BattleRecord[]): { version: string; games: number }[] {
  const counts = new Map<string, number>();
  for (const r of records) counts.set(r.version, (counts.get(r.version) ?? 0) + 1);
  return [...counts].map(([version, games]) => ({ version, games })).sort((a, b) => compareVersion(b.version, a.version));
}

/** 預設選取的版本：勝率統計最低版本以上的所有版本（由新到舊） */
export const defaultVersionList = (versions: { version: string }[]): string[] =>
  versions.map((v) => v.version).filter((v) => compareVersion(v, MIN_WIN_RATE_VERSION) >= 0).sort((a, b) => compareVersion(b, a));

/** 同上，從戰績本身看出現過哪些版本 */
export const defaultVersions = (records: BattleRecord[]): string[] => defaultVersionList(versionCounts(records));

/** 只留下版本在選取集合裡的戰績；沒有選任何版本就是空 */
export const filterByVersions = (records: BattleRecord[], versions: Iterable<string>): BattleRecord[] => {
  const set = new Set(versions);
  return records.filter((r) => set.has(r.version));
};

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

/** 先後攻統計的對象：非同角色對打 */
const seatEligible = (r: BattleRecord): boolean => r.mine !== r.theirs;

/** 先後攻統計用得上的戰績：符合對象，而且有開局先攻資料 */
const seated = (r: BattleRecord): r is BattleRecord & { first: boolean } => seatEligible(r) && r.first !== undefined;

export interface SeatStats {
  /** 開局先攻方的戰績；勝負平都是先攻方的視角 */
  first: Cell;
  /** 開局後攻方的戰績，與 first 互補 */
  second: Cell;
}

/**
 * 全體的先攻與後攻勝率：站在對局角度，不管記錄者是誰，統計開局先攻方與後攻方各贏幾場。
 * 同角色對打不算；沒有先後攻資料的舊紀錄不算（數量見 unseatedCount）。
 */
export function seatStats(records: BattleRecord[]): SeatStats {
  const first: Tally = { win: 0, lose: 0, draw: 0 };
  for (const r of records) {
    if (seated(r)) first[r.first ? r.outcome : flip(r.outcome)]++;
  }
  return { first: cellOf(first, false), second: cellOf({ win: first.lose, lose: first.win, draw: first.draw }, false) };
}

/** 單看角色的先攻與後攻勝率：該角色開局先攻時、後攻時的戰績。我用它或對手用它的場次兩個方向合併 */
export function characterSeats(records: BattleRecord[], char: string): SeatStats {
  const first: Tally = { win: 0, lose: 0, draw: 0 };
  const second: Tally = { win: 0, lose: 0, draw: 0 };
  for (const r of records) {
    if (!seated(r)) continue;
    if (r.mine === char) (r.first ? first : second)[r.outcome]++;
    else if (r.theirs === char) (r.first ? second : first)[flip(r.outcome)]++;
  }
  return { first: cellOf(first, false), second: cellOf(second, false) };
}

/** 符合先後攻統計的對象，卻因為沒有先後攻資料而被排除的場數；給角色時只算該角色出場的 */
export const unseatedCount = (records: BattleRecord[], char?: string): number =>
  records.filter((r) => seatEligible(r) && r.first === undefined && (char === undefined || r.mine === char || r.theirs === char)).length;

/** 範圍內規則和現在不同的舊版本場數（低於勝率統計最低版本），畫面用來提示 */
export const legacyCount = (records: BattleRecord[]): number => records.filter(isLegacyVersion).length;

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

/** 回合數分布與平均、最短、最長；傳入的戰績全部計入（版本由呼叫端先篩）。沒有場次時回傳 null */
export function turnStats(records: BattleRecord[], scope?: TurnScope): TurnStats | null {
  const turns = records.filter((r) => inScope(r, scope)).map((r) => r.turns);
  if (turns.length === 0) return null;
  let min = turns[0];
  let max = turns[0];
  const counts = new Map<number, number>();
  for (const t of turns) {
    if (t < min) min = t;
    if (t > max) max = t;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const histogram = [];
  for (let t = min; t <= max; t++) histogram.push({ turns: t, games: counts.get(t) ?? 0 });
  return { histogram, games: turns.length, avg: turns.reduce((n, t) => n + t, 0) / turns.length, min, max };
}
