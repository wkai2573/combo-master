import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayerId } from '../engine/types';
import type { ZoneKey } from './components/Board';
import type { SheetTarget } from './components/PhoneBoard';
import {
  INITIAL_OVERLAY_STATE,
  closeCardSheet as closeCardSheetState,
  closeCheat as closeCheatState,
  closeFlow as closeFlowState,
  closeLog as closeLogState,
  closeMenu as closeMenuState,
  closeSheet as closeSheetState,
  closeZone as closeZoneState,
  dismiss as dismissState,
  openFlow as openFlowState,
  openLog as openLogState,
  openSheet as openSheetState,
  openZone as openZoneState,
  switchLayout as switchLayoutState,
  syncCheatOn as syncCheatOnState,
  syncCombatEmpty as syncCombatEmptyState,
  syncPrompt as syncPromptState,
  toggleCheat as toggleCheatState,
  toggleMenu as toggleMenuState,
  togglePin as togglePinState,
  unpin as unpinState,
  type ActiveOverlay,
  type OverlayState,
  type ZoneAnchor,
} from './overlays';

export interface UseOverlaysOptions {
  isPhone: boolean;
  combatEmpty?: boolean;
  isCombatEmpty?: (p: PlayerId) => boolean;
  promptSig?: string;
  cheatOn?: boolean;
  onLayoutChange?: () => void;
}

export interface OverlaysController {
  readonly active: ActiveOverlay | null;
  readonly zone: { p: PlayerId; z: ZoneKey; anchor: ZoneAnchor } | null;
  readonly sheet: SheetTarget | null;
  readonly cardSheet: { id: string; exp: boolean } | null;
  readonly pinned: { id: string; exp: boolean } | null;
  readonly menuOpen: boolean;
  readonly logOpen: boolean;
  readonly flowOpen: boolean;
  readonly cheatOpen: boolean;

  readonly openZone: (p: PlayerId, z: ZoneKey, anchor: ZoneAnchor) => void;
  readonly closeZone: () => void;
  readonly openSheet: (target: SheetTarget) => void;
  readonly closeSheet: () => void;
  readonly toggleMenu: () => void;
  readonly closeMenu: () => void;
  readonly openLog: () => void;
  readonly closeLog: () => void;
  readonly openFlow: () => void;
  readonly closeFlow: () => void;
  readonly toggleCheat: () => void;
  readonly closeCheat: () => void;
  readonly togglePin: (id: string, exp?: boolean) => void;
  readonly unpin: () => void;
  readonly closeCardSheet: () => void;
  readonly dismiss: () => void;
}

/**
 * 對戰畫面浮層協調器（Battle Overlays Coordinator）
 *
 * 統籌管理 8 種浮層與按鍵狀態：
 * 1. 牌區檢視（zone）
 * 2. 手機全螢幕分頁面板（sheet）
 * 3. 手機底部卡片說明（cardSheet）
 * 4. 寬螢幕常駐卡片釘選（pinned）
 * 5. 手機頂部選單（menu）
 * 6. 手機遊戲紀錄抽屜（log）
 * 7. 戰鬥流程圖彈窗（flow）
 * 8. 作弊控制面板（cheat）
 *
 * 封裝 Esc 鍵盤監聽（過濾輸入框）、版面切換重置、以及業務信號自動收合規則。
 */
export function useOverlays({
  isPhone,
  combatEmpty = false,
  isCombatEmpty,
  promptSig = '',
  cheatOn = false,
  onLayoutChange,
}: UseOverlaysOptions): OverlaysController {
  const [state, setState] = useState<OverlayState>(INITIAL_OVERLAY_STATE);

  const isPhoneRef = useRef(isPhone);
  isPhoneRef.current = isPhone;

  const dismiss = useCallback(() => {
    setState(dismissState);
  }, []);

  // Esc 按鍵監聽：在輸入框裡按 Esc 只離開輸入框，不連帶關掉面板；否則依序收合浮層或取消固定
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
        e.target.blur();
        return;
      }
      dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismiss]);

  // 戰鬥區清空業務信號：回合結算歸還後自動收起戰鬥區列表
  useEffect(() => {
    if (combatEmpty) {
      setState((s) => syncCombatEmptyState(s, true));
    }
  }, [combatEmpty]);

  useEffect(() => {
    if (isCombatEmpty && state.active?.type === 'zone' && state.active.z === 'combat') {
      if (isCombatEmpty(state.active.p)) {
        setState((s) => syncCombatEmptyState(s, true));
      }
    }
  }, [isCombatEmpty, state.active]);

  // 新提示到達業務信號：手機版面收到新提示自動收起全螢幕面板，避免遮蔽操作
  const prevPromptSigRef = useRef(promptSig);
  useEffect(() => {
    if (prevPromptSigRef.current !== promptSig) {
      prevPromptSigRef.current = promptSig;
      if (isPhone && promptSig) {
        setState((s) => syncPromptState(s, true, true));
      }
    }
  }, [promptSig, isPhone]);

  // 連線作弊開關業務信號：確認開啟時彈出面板，確認關閉時收合面板
  const prevCheatOnRef = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    const prev = prevCheatOnRef.current;
    if (prev !== cheatOn) {
      prevCheatOnRef.current = cheatOn;
      if (prev !== undefined) {
        setState((s) => syncCheatOnState(s, cheatOn, prev));
      } else if (cheatOn) {
        setState((s) => syncCheatOnState(s, true, false));
      }
    }
  }, [cheatOn]);

  // 版面切換重置：在寬螢幕版與手機版面之間切換時，收起專屬浮層
  const prevPhoneRef = useRef(isPhone);
  useEffect(() => {
    if (prevPhoneRef.current !== isPhone) {
      prevPhoneRef.current = isPhone;
      setState(switchLayoutState);
      onLayoutChange?.();
    }
  }, [isPhone, onLayoutChange]);

  const openZone = useCallback((p: PlayerId, z: ZoneKey, anchor: ZoneAnchor) => {
    setState((s) => openZoneState(s, p, z, anchor));
  }, []);

  const closeZone = useCallback(() => {
    setState(closeZoneState);
  }, []);

  const openSheet = useCallback((target: SheetTarget) => {
    setState((s) => openSheetState(s, target));
  }, []);

  const closeSheet = useCallback(() => {
    setState(closeSheetState);
  }, []);

  const toggleMenu = useCallback(() => {
    setState(toggleMenuState);
  }, []);

  const closeMenu = useCallback(() => {
    setState(closeMenuState);
  }, []);

  const openLog = useCallback(() => {
    setState(openLogState);
  }, []);

  const closeLog = useCallback(() => {
    setState(closeLogState);
  }, []);

  const openFlow = useCallback(() => {
    setState(openFlowState);
  }, []);

  const closeFlow = useCallback(() => {
    setState(closeFlowState);
  }, []);

  const toggleCheat = useCallback(() => {
    setState(toggleCheatState);
  }, []);

  const closeCheat = useCallback(() => {
    setState(closeCheatState);
  }, []);

  const togglePin = useCallback((id: string, exp?: boolean) => {
    setState((s) => togglePinState(s, id, !!exp, isPhoneRef.current));
  }, []);

  const unpin = useCallback(() => {
    setState(unpinState);
  }, []);

  const closeCardSheet = useCallback(() => {
    setState(closeCardSheetState);
  }, []);

  const zone = state.active?.type === 'zone' ? state.active : null;
  const sheet = state.active?.type === 'sheet' ? state.active.target : null;
  const cardSheet = state.active?.type === 'cardSheet' ? { id: state.active.id, exp: state.active.exp } : null;
  const menuOpen = state.active?.type === 'menu';
  const logOpen = state.active?.type === 'log';
  const flowOpen = state.active?.type === 'flow';
  const cheatOpen = state.active?.type === 'cheat';
  const pinned = state.pinned;

  return {
    active: state.active,
    zone,
    sheet,
    cardSheet,
    pinned,
    menuOpen,
    logOpen,
    flowOpen,
    cheatOpen,

    openZone,
    closeZone,
    openSheet,
    closeSheet,
    toggleMenu,
    closeMenu,
    openLog,
    closeLog,
    openFlow,
    closeFlow,
    toggleCheat,
    closeCheat,
    togglePin,
    unpin,
    closeCardSheet,
    dismiss,
  };
}
