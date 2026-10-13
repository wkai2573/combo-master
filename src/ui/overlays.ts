import type { PlayerId } from '../engine/types';
import type { ZoneKey } from './components/Board';
import type { SheetTarget } from './components/PhoneBoard';

/** 牌區彈窗定位錨點（支援 DOMRect 與純數值物件） */
export interface ZoneAnchor {
  readonly left: number;
  readonly top: number;
  readonly right?: number;
  readonly bottom?: number;
  readonly width?: number;
  readonly height?: number;
}

/** 畫面上唯一的互斥浮層 */
export type ActiveOverlay =
  | { type: 'zone'; p: PlayerId; z: ZoneKey; anchor: ZoneAnchor }
  | { type: 'sheet'; target: SheetTarget }
  | { type: 'cardSheet'; id: string; exp: boolean }
  | { type: 'menu' }
  | { type: 'log' }
  | { type: 'flow' }
  | { type: 'cheat' };

/** 浮層協調狀態：單一使用中浮層 + 寬螢幕常駐卡片釘選 */
export interface OverlayState {
  readonly active: ActiveOverlay | null;
  readonly pinned: { id: string; exp: boolean } | null;
}

export const INITIAL_OVERLAY_STATE: OverlayState = {
  active: null,
  pinned: null,
};

/** 開啟牌區檢視（替換其他浮層，保留 pinned） */
export function openZone(state: OverlayState, p: PlayerId, z: ZoneKey, anchor: ZoneAnchor): OverlayState {
  return { ...state, active: { type: 'zone', p, z, anchor } };
}

/** 關閉牌區檢視 */
export function closeZone(state: OverlayState): OverlayState {
  return state.active?.type === 'zone' ? { ...state, active: null } : state;
}

/** 手機版面：開啟全螢幕分頁面板（角色／經驗／裝備增益／棄牌／戰鬥） */
export function openSheet(state: OverlayState, target: SheetTarget): OverlayState {
  return { ...state, active: { type: 'sheet', target } };
}

/** 關閉全螢幕分頁面板 */
export function closeSheet(state: OverlayState): OverlayState {
  return state.active?.type === 'sheet' ? { ...state, active: null } : state;
}

/** 手機版面：開啟頂部選單 */
export function openMenu(state: OverlayState): OverlayState {
  return { ...state, active: { type: 'menu' } };
}

/** 手機版面：切換頂部選單開關 */
export function toggleMenu(state: OverlayState): OverlayState {
  return state.active?.type === 'menu' ? { ...state, active: null } : { ...state, active: { type: 'menu' } };
}

/** 關閉頂部選單 */
export function closeMenu(state: OverlayState): OverlayState {
  return state.active?.type === 'menu' ? { ...state, active: null } : state;
}

/** 手機版面：開啟遊戲紀錄抽屜 */
export function openLog(state: OverlayState): OverlayState {
  return { ...state, active: { type: 'log' } };
}

/** 關閉遊戲紀錄抽屜 */
export function closeLog(state: OverlayState): OverlayState {
  return state.active?.type === 'log' ? { ...state, active: null } : state;
}

/** 開啟戰鬥流程圖彈窗 */
export function openFlow(state: OverlayState): OverlayState {
  return { ...state, active: { type: 'flow' } };
}

/** 關閉戰鬥流程圖彈窗 */
export function closeFlow(state: OverlayState): OverlayState {
  return state.active?.type === 'flow' ? { ...state, active: null } : state;
}

/** 切換作弊面板開合 */
export function toggleCheat(state: OverlayState): OverlayState {
  return state.active?.type === 'cheat' ? { ...state, active: null } : { ...state, active: { type: 'cheat' } };
}

/** 關閉作弊面板 */
export function closeCheat(state: OverlayState): OverlayState {
  return state.active?.type === 'cheat' ? { ...state, active: null } : state;
}

/** 關閉手機底部卡片說明面板 */
export function closeCardSheet(state: OverlayState): OverlayState {
  return state.active?.type === 'cardSheet' ? { ...state, active: null } : state;
}

/** 取消釘選寬螢幕卡片說明 */
export function unpin(state: OverlayState): OverlayState {
  return state.pinned !== null ? { ...state, pinned: null } : state;
}

/**
 * 依版面自動分流卡片釘選：
 * - 手機版面：由底部滑出卡片說明（cardSheet），佔用 active
 * - 寬螢幕版面：固定／取消固定在側邊欄（pinned），不佔用 active
 */
export function togglePin(state: OverlayState, id: string, exp: boolean, isPhone: boolean): OverlayState {
  if (isPhone) {
    return { ...state, active: { type: 'cardSheet', id, exp } };
  }
  const isSame = state.pinned?.id === id && state.pinned.exp === exp;
  return { ...state, pinned: isSame ? null : { id, exp } };
}

/**
 * Esc 按鍵關閉邏輯：
 * 1. 若有使用中的浮層，先關閉浮層（保留 pinned）
 * 2. 若無使用中的浮層但有 pinned 卡片，取消 pinned
 * 3. 若皆無，保持原狀態
 */
export function dismiss(state: OverlayState): OverlayState {
  if (state.active !== null) {
    return { ...state, active: null };
  }
  if (state.pinned !== null) {
    return { ...state, pinned: null };
  }
  return state;
}

/** 版面在寬螢幕與手機之間切換時，收起所有浮層與釘選狀態 */
export function switchLayout(_state: OverlayState): OverlayState {
  return INITIAL_OVERLAY_STATE;
}

/** 戰鬥區清空業務信號：若目前正在檢視戰鬥區列表則自動收起 */
export function syncCombatEmpty(state: OverlayState, combatEmpty: boolean): OverlayState {
  if (combatEmpty && state.active?.type === 'zone' && state.active.z === 'combat') {
    return { ...state, active: null };
  }
  return state;
}

/** 新提示到達業務信號：手機版面若正開著全螢幕面板則自動收起，避免遮蔽操作 */
export function syncPrompt(state: OverlayState, promptChanged: boolean, isPhone: boolean): OverlayState {
  if (isPhone && promptChanged && state.active?.type === 'sheet') {
    return { ...state, active: null };
  }
  return state;
}

/** 連線作弊開關業務信號：確認開啟時彈出面板，確認關閉時收合面板 */
export function syncCheatOn(state: OverlayState, cheatOn: boolean, prevCheatOn: boolean): OverlayState {
  if (cheatOn && !prevCheatOn) {
    return { ...state, active: { type: 'cheat' } };
  }
  if (!cheatOn && state.active?.type === 'cheat') {
    return { ...state, active: null };
  }
  return state;
}
