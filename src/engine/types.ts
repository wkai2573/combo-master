import type { EquipSlot } from '../data/types';

export type PlayerId = 0 | 1;
export const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);

/**
 * 區域與順序約定：
 * - deck / rage：index 0 為最上方
 * - exp：index 0 為最前方（蓋X 從最前面的正面卡開始蓋）
 * - combat：index 0 為最底，最後一張為最上方（[頂] 所指的卡）
 */
export type ZoneName =
  | 'deck' | 'hand' | 'discard' | 'rage' | 'exp'
  | 'combat' | 'pursuit' | 'gear' | 'buff';

export interface CardInst {
  uid: number;
  id: string;
  owner: PlayerId;
  zone: ZoneName;
  /** 經驗區：覆蓋中 */
  covered: boolean;
  /** 增益：持續時間指示物 */
  counters: number;
}

export interface PlayerState {
  id: PlayerId;
  charId: string;
  zones: Record<ZoneName, CardInst[]>;
}

export interface TurnFlags {
  /** 本回合出招張數 */
  played: [number, number];
  opened: boolean;
  pursuitPlus: [number, number];
  pursuitMinus: [number, number];
  pursuitSuccess: [number, number];
  rabbitUsed: [boolean, boolean];
  burstDraw3: [boolean, boolean];
  alchemy: [boolean, boolean];
  sniper: [boolean, boolean];
  damageTaken: [number, number];
  noSwap: boolean;
}

export type Phase =
  | '設置' | '重置' | '起手' | '反擊' | '追擊' | '傷害' | '歸還'
  | '抽牌' | '爆發' | '增益' | '回合結束' | '結束';

export interface GameState {
  players: [PlayerState, PlayerState];
  first: PlayerId;
  turn: number;
  phase: Phase;
  flags: TurnFlags;
  /** 本回合是否已收招 */
  passed: [boolean, boolean];
  log: string[];
  winner: PlayerId | 'draw' | null;
  winReason: string;
}

export interface Opt {
  key: string;
  label: string;
  uid?: number;
  cardId?: string;
}

export interface Request {
  player: PlayerId;
  title: string;
  options: Opt[];
  min: number;
  max: number;
}

export interface DeckSpec {
  charId: string;
  cards: string[];
}

export interface GameSetup {
  decks: [DeckSpec, DeckSpec];
  seed?: number;
  /** 指定先攻（預設隨機） */
  first?: PlayerId;
  /** 測試用：不洗牌 */
  noShuffle?: boolean;
  /** 測試用：設置完成（抽完起始手牌）後、第一個提示前，可改寫各區域 */
  afterSetup?: (g: import('./ops').GameCtx) => void;
}

export type { EquipSlot };
