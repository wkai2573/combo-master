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
  /** 經驗區：裏側 */
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
  pursuitSuccess: [number, number];
  rabbitUsed: [boolean, boolean];
  /** 遊俠「瞄準」本回合已使用的次數 */
  aimUsed: [number, number];
  /** 本回合卡片給的總攻擊加成（伏擊） */
  atkBonus: [number, number];
  /** 本回合卡片給的總防禦加成（順手牽羊為負） */
  defBonus: [number, number];
  /** 本回合瞄準的升級次數（狙擊印記） */
  aimUp: [number, number];
  /** 凡骨的意志：本回合生效次數（總攻擊／總防禦各 + 戰鬥區白板卡數量 × 次數） */
  vanillaBoost: [number, number];
  /** 塗毒：歸還時要放出 [Ex卡-中毒] 的出招方 */
  poisonQ: PlayerId[];
  /** Explosion!：跳過我方這回合之後的抽牌階段 */
  skipDraw: [boolean, boolean];
  damageTaken: [number, number];
}

export type Phase =
  | '設置' | '重置' | '先手' | '反擊' | '追擊' | '傷害' | '歸還'
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
  /** 各玩家上次偵測時是否處於覺醒狀態；由未覺醒變成覺醒才算進入覺醒（見 awakeningEffects） */
  awakeSeen: [boolean, boolean];
}

export interface Opt {
  key: string;
  label: string;
  uid?: number;
  cardId?: string;
  /** 這個選項是一張回應者看不到牌面的裏側卡：只有 uid（對得上經驗區的位置），沒有 cardId 與卡名 */
  hidden?: boolean;
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

/** 動畫影格附帶的演出資訊，介面依此決定要播什麼特效 */
export type FrameFx =
  | { type: 'phase' }
  | { type: 'info' }
  /** 一個步驟（發動、付費、效果結果）做完，桌面有變化 */
  | { type: 'step' }
  /** 開局：雙方的牌組洗牌（手牌還是空的） */
  | { type: 'shuffle' }
  /** 開局：雙方抽起始手牌 */
  | { type: 'deal' }
  /** 勝負確定（這一格的桌面已經有勝負） */
  | { type: 'gameEnd'; winner: PlayerId | 'draw' }
  /** 橫幅：回合開頭，或戰鬥的主要階段（追擊、傷害計算）開始 */
  | { type: 'banner'; kind: 'turn'; turn: number; first: PlayerId }
  | { type: 'banner'; kind: 'phase'; name: string }
  /** 瞄準：牌組頂的牌放到牌組底（牌組只有張數，位置的變化看不出來，所以單獨錄一格） */
  | { type: 'aimSwap'; player: PlayerId }
  /** 卡片效果發動：介面把那張牌放大到中央（發動時還沒付費、效果還沒生效） */
  | { type: 'activate'; player: PlayerId; uid: number; cardId: string }
  | { type: 'draw' }
  | { type: 'play'; player: PlayerId; uid: number }
  | { type: 'pass'; player: PlayerId }
  /** 追擊判定翻開了一張牌（牌還在原處，尚未判定結果） */
  | { type: 'flip'; player: PlayerId; cardId: string }
  | { type: 'flipResult'; player: PlayerId; cardId: string; ok: boolean }
  /** 傷害計算：atk／def／dmg 皆以玩家編號為索引（dmg[p]＝玩家 p 要受到的傷害） */
  | { type: 'calc'; atk: [number, number]; def: [number, number]; dmg: [number, number] }
  | { type: 'damage'; dmg: [number, number] }
  | { type: 'return' };

/** 各種影格停留的毫秒數（標準速度） */
export const FRAME_MS: Record<FrameFx['type'], number> = {
  phase: 750, info: 800, step: 600, activate: 1100, aimSwap: 900, banner: 700, shuffle: 900, deal: 900, gameEnd: 1500, draw: 550, play: 1000, pass: 800,
  flip: 1250, flipResult: 1150, calc: 2000, damage: 1500, return: 1000,
};

export interface GameSetup {
  decks: [DeckSpec, DeckSpec];
  seed?: number;
  /** 指定先攻（預設隨機） */
  first?: PlayerId;
  /** 錄製動畫影格（介面用；壓測與測試不需要） */
  animate?: boolean;
  /** 測試用：不洗牌 */
  noShuffle?: boolean;
  /** 測試用：設置完成（抽完起始手牌）後、第一個提示前，可改寫各區域 */
  afterSetup?: (g: import('./ops').GameCtx) => void;
  /** 指定起始階段（測試用，若未提供則從第 1 回合重置階段開始） */
  startPhase?: Phase;
  /** 僅執行指定階段（測試用，階段完成後結束，不推進後續階段） */
  singlePhase?: boolean;
}

export type { EquipSlot };
