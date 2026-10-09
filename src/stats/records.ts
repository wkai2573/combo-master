import type { GameView } from '../engine/view';

/** 對手類型：電腦是單機練習的機器人，玩家是連線對戰的朋友 */
export type Opponent = 'cpu' | 'player';
export type Outcome = 'win' | 'lose' | 'draw';

/**
 * 戰績：每場正常結束的對局留下的一筆結果，都是玩家自己的視角。
 * 只記這六個欄位，不記時間、勝負原因與牌組。
 */
export interface BattleRecord {
  /** 對局當時的遊戲版本號，統計時用來排除規則已變動的舊紀錄 */
  version: string;
  opponent: Opponent;
  /** 我的角色 */
  mine: string;
  /** 對手角色 */
  theirs: string;
  outcome: Outcome;
  /** 最終回合數 */
  turns: number;
}

const KEY = 'lianji.records.v1';

/**
 * 對局結束時的視角轉成戰績。還沒結束、因離線或認輸結束、對局期間有人開過作弊的對局不留紀錄，回傳 null。
 * 訪客收到的視角若來自舊版房主，沒有這兩個旗標：當成不知道，一樣不記。
 */
export function recordFromView(view: GameView, opponent: Opponent, version: string): BattleRecord | null {
  if (view.winner === null || view.forfeited !== false || view.cheated !== false) return null;
  const outcome: Outcome = view.winner === 'draw' ? 'draw' : view.winner === view.me ? 'win' : 'lose';
  const them = view.me === 0 ? 1 : 0;
  return {
    version, opponent, mine: view.players[view.me].charId, theirs: view.players[them].charId, outcome, turns: view.turn,
  };
}

const isRecord = (r: unknown): r is BattleRecord => {
  if (typeof r !== 'object' || r === null) return false;
  const o = r as Record<string, unknown>;
  return typeof o.version === 'string'
    && (o.opponent === 'cpu' || o.opponent === 'player')
    && typeof o.mine === 'string' && typeof o.theirs === 'string'
    && (o.outcome === 'win' || o.outcome === 'lose' || o.outcome === 'draw')
    && typeof o.turns === 'number' && Number.isInteger(o.turns) && o.turns >= 0;
};

/** 讀不到、資料損毀、格式不符的筆數都當成沒有 */
export function listRecords(): BattleRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? arr.filter(isRecord) : [];
  } catch {
    return [];
  }
}

function write(list: BattleRecord[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // 儲存失敗（私密模式或容量滿）：忽略，不影響遊戲
  }
}

export function addRecord(record: BattleRecord): void {
  write([...listRecords(), record]);
}

export function clearRecords(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 無法清除：忽略
  }
}
