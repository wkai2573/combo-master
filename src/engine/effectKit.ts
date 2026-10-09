import type { Cost } from './cost';
import type { GameCtx, Gen } from './ops';
import type { CardInst, PlayerId, ZoneName } from './types';
import type { WindowEffect } from './window';

/**
 * 效果來源（見 GLOSSARY）的型別與條目輔助函式。
 * 這個檔案只放條目要用到的型別與常數，不含登記表與查詢實作（那些在 effects.ts）。
 * 它沒有任何執行期匯入，所以各職業的條目檔不論誰先被載入，都能安全地匯入它。
 */

// ───────────────────────── 常駐位置 ─────────────────────────

/**
 * 效果來源「存在」的位置，決定它的處理器何時被問到：
 * - 牌區：該區有這張卡才問，每個實例各問一次；經驗區只算表側
 * - char：玩家的角色就是這個條目
 * - lasting：不論卡在哪裡，每位玩家問一次（效果自己看狀態槽）
 * 必填，沒寫就是編譯錯誤；漏寫常駐位置會讓效果悄悄消失，不能有預設。
 */
export type Place = ZoneName | 'char' | 'lasting';

// ───────────────────────── 時機 ─────────────────────────

/** 事件型時機，處理器除了共通的 Ctx 之外收到的欄位 */
export interface Events {
  turnStart: Record<never, never>;
  onPass: Record<never, never>;
  afterBurst: Record<never, never>;
  onAwaken: Record<never, never>;
  /** 傷害算出之後、放進怒氣區之前。雙方將要承受的傷害讀 flags.damagePending，結算中會變，條件要用 when 即時判斷 */
  onDamage: Record<never, never>;
  afterReturn: Record<never, never>;
  /** flipExtra：額外翻 1 張牌做追擊判定，以回呼傳入，條目不必匯入戰鬥模組 */
  afterPursuitFail: { flipExtra: () => Gen<boolean> };
  /** 主體型：只問主體那張卡自己的條目，不看它所在的區域 */
  onOpen: { card: CardInst };
  onPlay: { card: CardInst };
  onPursuitCard: { card: CardInst };
  onCovered: { card: CardInst };
}
export type EventKey = keyof Events;

/** 呼叫 fire 時傳入的參數。主體型時機傳主體；被蓋成裏側一次可能有多張 */
export type FireArgs = { [K in EventKey]: K extends 'onCovered' ? { cards: CardInst[] } : Events[K] };
export type FireArgList<K extends EventKey> = Record<never, never> extends FireArgs[K] ? [arg?: FireArgs[K]] : [arg: FireArgs[K]];

/** 觸發窗口的標題；只有同一窗口有兩個以上可發動的效果時，玩家才看得到 */
export const EVENT_TITLES: Record<EventKey, string> = {
  turnStart: '回合開始',
  onPass: '收招時',
  afterBurst: '爆發後',
  onAwaken: '覺醒時',
  onDamage: '傷害計算時',
  afterReturn: '歸還時',
  afterPursuitFail: '追擊失敗後',
  onOpen: '先手出招時',
  onPlay: '打出時',
  onPursuitCard: '成為追擊卡時',
  onCovered: '被蓋成裏側',
};

/** 主體型時機取主體的方式；沒有列出的時機照位置問 */
export const SUBJECTS: { [K in EventKey]?: (arg: FireArgs[K]) => CardInst[] } = {
  onOpen: (a) => [a.card],
  onPlay: (a) => [a.card],
  onPursuitCard: (a) => [a.card],
  onCovered: (a) => a.cards,
};

// ───────────────────────── 查詢 ─────────────────────────

/** 查詢型的結果。各條目的貢獻依下面的規則合併 */
export interface Queries {
  /** 開局起始手牌多抽幾張（加總） */
  openingDraw: number;
  /** 抽牌階段多抽幾張（加總） */
  drawPhaseExtra: number;
  /** 是否跳過抽牌階段（任一為真） */
  skipDrawPhase: boolean;
  /** 瞄準上限（加總） */
  aimLimit: number;
  /** 瞄準升級的次數（加總） */
  aimLevel: number;
  /** 追擊次數加成（加總） */
  pursuitBonus: number;
  /** 總攻擊、總防禦的平面加減（加總） */
  flatAtk: number;
  flatDef: number;
  /** 凡骨的意志生效的次數（加總） */
  vanillaBoost: number;
  /** 角色專屬的戰鬥結算加成（欄位各自加總） */
  combatBonus: { atk: number; def: number; pursuitDef: number };
}
export type QueryKey = keyof Queries;

export interface QueryArgs {
  openingDraw: [];
  drawPhaseExtra: [];
  skipDrawPhase: [];
  aimLimit: [];
  aimLevel: [];
  pursuitBonus: [];
  flatAtk: [];
  flatDef: [];
  vanillaBoost: [];
  combatBonus: [arg: { baseAtk: number }];
}

/** 條目對查詢的貢獻：數值與布林同結果型別，物件型可只填部分欄位 */
export type QueryContribution = { [K in QueryKey]: Queries[K] extends object ? Partial<Queries[K]> : Queries[K] };

/** 招式在招式卡疊與追擊卡疊的靜態修正，沒有條目時全為預設 */
export interface MoveRules {
  /** 作為招式卡疊最上方招式時的攻擊力、防禦力修正 */
  topAtk: number;
  topDef: number;
  /** 作為最上方招式時，戰鬥區每張招式的攻擊力至少是它的原始防禦力 */
  liftAtkToDef: boolean;
  /** 成為追擊卡時，我方總攻擊、總防禦的加成 */
  pursuitAtk: number;
  pursuitDef: number;
  /** 追擊判定一律失敗 */
  pursuitFails: boolean;
}
export const NO_MOVE_RULES: Readonly<MoveRules> = Object.freeze({
  topAtk: 0, topDef: 0, liftAtkToDef: false, pursuitAtk: 0, pursuitDef: 0, pursuitFails: false,
});

// ───────────────────────── 處理器與條目 ─────────────────────────

export interface EffectOpts {
  /** 窗口選單上的文字 */
  label: string;
  /** 付得起才可發動；選到之後（或只剩這個時）走費用發動的詢問與扣費。需要對應的卡 */
  cost?: Cost;
  /** 沒有費用但要先問一句才發動；已在窗口選定時不再問 */
  confirm?: string;
  /** 強制效果只能排序、不能跳過 */
  mandatory?: boolean;
  /** 設為 false 表示效果自己會錄影格，結算完不再補錄 */
  mark?: boolean;
  /** 額外的可發動條件，每次結算後重新檢查 */
  when?: () => boolean;
}

/** 處理器收到的共通欄位 */
export interface Ctx {
  g: GameCtx;
  p: PlayerId;
  /** 常駐型：在位的那張；主體型：主體那張；角色與 lasting 處理器為 null */
  self: CardInst | null;
  /** 這張卡此刻是否仍在位（經驗區須表側）；角色、lasting 恆為 true */
  here(): boolean;
  /** 造出窗口效果：available ＝ 在位 ∧ 條件 ∧ 付得起；run 依 confirmed 決定要不要再問 */
  effect(o: EffectOpts, body: () => Gen | void): WindowEffect;
}

export type Offer = WindowEffect | readonly WindowEffect[] | null | undefined;

export type EventHandler<K extends EventKey> = (c: Ctx & Events[K]) => Offer;
export type QueryHandler<K extends QueryKey> = (c: Ctx, ...args: QueryArgs[K]) => QueryContribution[K];

/** 離場後仍要被問的處理器要明寫 lasting，用 lasting(fn) 包起來 */
export type HandlerSpec<F> = F | { lasting: true; run: F };
export const lasting = <F>(run: F): { lasting: true; run: F } => ({ lasting: true, run });

export interface EffectSource {
  /** 卡名或角色名 */
  id: string;
  at: Place;
  on?: { [K in EventKey]?: HandlerSpec<EventHandler<K>> };
  ask?: { [K in QueryKey]?: HandlerSpec<QueryHandler<K>> };
  /** 招式靜態修正，不吃 Ctx */
  asMove?: Partial<MoveRules>;
}
export const defineSource = (s: EffectSource): EffectSource => s;

// ───────────────────────── 回合狀態槽 ─────────────────────────

/**
 * 卡片擁有的回合狀態。存在這一局的 GameState 上（每位玩家一份），回合開始由引擎統一清空，
 * 所以不能把值放在模組層級變數。read 不會建立槽，所以查詢型也能安全使用。
 */
export interface Slot<S> {
  readonly key: string;
  read(g: GameCtx, p: PlayerId): Readonly<S>;
  of(g: GameCtx, p: PlayerId): S;
}

export function slot<S>(key: string, init: () => S): Slot<S> {
  return {
    key,
    read: (g, p) => (g.state.slots[p][key] as S | undefined) ?? init(),
    of: (g, p) => (g.state.slots[p][key] ??= init()) as S,
  };
}
