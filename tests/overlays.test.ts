import { describe, expect, it } from 'vitest';
import {
  INITIAL_OVERLAY_STATE,
  closeCardSheet,
  closeCheat,
  closeFlow,
  closeLog,
  closeMenu,
  closeSheet,
  closeZone,
  dismiss,
  openFlow,
  openLog,
  openMenu,
  openSheet,
  openZone,
  switchLayout,
  syncCheatOn,
  syncCombatEmpty,
  syncPrompt,
  toggleCheat,
  toggleMenu,
  togglePin,
  unpin,
  type OverlayState,
} from '../src/ui/overlays';

describe('對戰畫面浮層協調模組（Overlays Coordinator）', () => {
  const dummyAnchor = { left: 100, top: 200, right: 150, bottom: 250, width: 50, height: 50 };

  it('初始狀態：沒有任何使用中的浮層與固定卡片', () => {
    expect(INITIAL_OVERLAY_STATE).toEqual({
      active: null,
      pinned: null,
    });
  });

  describe('單一互斥浮層開啟與替換', () => {
    it('開啟牌區檢視：active 設為 zone', () => {
      const s = openZone(INITIAL_OVERLAY_STATE, 0, 'combat', dummyAnchor);
      expect(s.active).toEqual({ type: 'zone', p: 0, z: 'combat', anchor: dummyAnchor });
    });

    it('開啟新浮層會替換舊浮層（互斥模型）', () => {
      let s = openZone(INITIAL_OVERLAY_STATE, 0, 'combat', dummyAnchor);
      expect(s.active?.type).toBe('zone');

      s = openMenu(s);
      expect(s.active).toEqual({ type: 'menu' });

      s = openSheet(s, { p: 1, tab: 'discard' });
      expect(s.active).toEqual({ type: 'sheet', target: { p: 1, tab: 'discard' } });

      s = openLog(s);
      expect(s.active).toEqual({ type: 'log' });

      s = openFlow(s);
      expect(s.active).toEqual({ type: 'flow' });

      s = toggleCheat(s);
      expect(s.active).toEqual({ type: 'cheat' });
    });

    it('獨立關閉方法只關閉對應類型的浮層', () => {
      const sZone = openZone(INITIAL_OVERLAY_STATE, 0, 'combat', dummyAnchor);
      expect(closeZone(sZone).active).toBeNull();
      expect(closeMenu(sZone).active).toEqual(sZone.active);

      const sMenu = openMenu(INITIAL_OVERLAY_STATE);
      expect(closeMenu(sMenu).active).toBeNull();

      const sSheet = openSheet(INITIAL_OVERLAY_STATE, { p: 0, tab: 'exp' });
      expect(closeSheet(sSheet).active).toBeNull();

      const sLog = openLog(INITIAL_OVERLAY_STATE);
      expect(closeLog(sLog).active).toBeNull();

      const sFlow = openFlow(INITIAL_OVERLAY_STATE);
      expect(closeFlow(sFlow).active).toBeNull();

      const sCheat = toggleCheat(INITIAL_OVERLAY_STATE);
      expect(closeCheat(sCheat).active).toBeNull();
    });

    it('toggleCheat 與 toggleMenu 支援重複點擊開關', () => {
      let s = toggleMenu(INITIAL_OVERLAY_STATE);
      expect(s.active).toEqual({ type: 'menu' });
      s = toggleMenu(s);
      expect(s.active).toBeNull();

      s = toggleCheat(INITIAL_OVERLAY_STATE);
      expect(s.active).toEqual({ type: 'cheat' });
      s = toggleCheat(s);
      expect(s.active).toBeNull();
    });
  });

  describe('卡片固定與版面自適應路由（togglePin）', () => {
    it('寬螢幕版面（isPhone = false）：固定卡片記錄在 pinned，不佔用 active 浮層', () => {
      const s1 = togglePin(INITIAL_OVERLAY_STATE, 'c1', false, false);
      expect(s1.pinned).toEqual({ id: 'c1', exp: false });
      expect(s1.active).toBeNull();

      // 點選不同卡片：替換固定卡片
      const s2 = togglePin(s1, 'c2', true, false);
      expect(s2.pinned).toEqual({ id: 'c2', exp: true });

      // 重複點選同一張卡片：取消固定
      const s3 = togglePin(s2, 'c2', true, false);
      expect(s3.pinned).toBeNull();

      // unpin 直接清除 pinned
      const s4 = unpin(s2);
      expect(s4.pinned).toBeNull();
    });

    it('手機版面（isPhone = true）：改為從底部滑出說明（cardSheet），記錄在 active', () => {
      const s1 = togglePin(INITIAL_OVERLAY_STATE, 'c1', true, true);
      expect(s1.active).toEqual({ type: 'cardSheet', id: 'c1', exp: true });
      expect(s1.pinned).toBeNull();

      const s2 = closeCardSheet(s1);
      expect(s2.active).toBeNull();
    });

    it('寬螢幕已有 pinned 時開啟浮層：pinned 保持不變', () => {
      let s = togglePin(INITIAL_OVERLAY_STATE, 'c1', false, false);
      s = openZone(s, 0, 'discard', dummyAnchor);
      expect(s.pinned).toEqual({ id: 'c1', exp: false });
      expect(s.active?.type).toBe('zone');
    });
  });

  describe('鍵盤 Esc 收合順序（dismiss）', () => {
    it('有使用中的浮層時：先關閉該浮層，保留 pinned', () => {
      let s: OverlayState = {
        pinned: { id: 'c1', exp: false },
        active: { type: 'zone', p: 0, z: 'combat', anchor: dummyAnchor },
      };
      s = dismiss(s);
      expect(s.active).toBeNull();
      expect(s.pinned).toEqual({ id: 'c1', exp: false });
    });

    it('沒有使用中的浮層時：才取消 pinned 固定', () => {
      let s: OverlayState = {
        pinned: { id: 'c1', exp: false },
        active: null,
      };
      s = dismiss(s);
      expect(s.pinned).toBeNull();
    });

    it('浮層與固定卡片皆為空時：dismiss 保持不變', () => {
      const s = dismiss(INITIAL_OVERLAY_STATE);
      expect(s).toEqual(INITIAL_OVERLAY_STATE);
    });
  });

  describe('版面切換重置（switchLayout）', () => {
    it('切換版面時清空所有浮層與 pinned 狀態', () => {
      const dirty: OverlayState = {
        pinned: { id: 'c1', exp: false },
        active: { type: 'sheet', target: { p: 0, tab: 'combat' } },
      };
      const cleaned = switchLayout(dirty);
      expect(cleaned).toEqual(INITIAL_OVERLAY_STATE);
    });
  });

  describe('業務信號自動收合規則', () => {
    it('戰鬥區清空（combatEmpty）：若目前開著戰鬥區檢視則自動收起', () => {
      const sCombat = openZone(INITIAL_OVERLAY_STATE, 0, 'combat', dummyAnchor);
      expect(syncCombatEmpty(sCombat, true).active).toBeNull();

      // 非戰鬥區（如棄牌區）不因戰鬥區清空而收起
      const sDiscard = openZone(INITIAL_OVERLAY_STATE, 0, 'discard', dummyAnchor);
      expect(syncCombatEmpty(sDiscard, true).active).toEqual(sDiscard.active);

      // combatEmpty 為 false 時不動作
      expect(syncCombatEmpty(sCombat, false).active).toEqual(sCombat.active);
    });

    it('新提示到達（promptChanged）：手機版面若正開著全螢幕面板則自動收起', () => {
      const sSheet = openSheet(INITIAL_OVERLAY_STATE, { p: 0, tab: 'char' });

      // 手機版面且提示改變：自動關閉全螢幕 sheet
      expect(syncPrompt(sSheet, true, true).active).toBeNull();

      // 電腦版面：不關閉
      expect(syncPrompt(sSheet, true, false).active).toEqual(sSheet.active);

      // 手機版面但開的是其他浮層（例如 zone）：不關閉
      const sZone = openZone(INITIAL_OVERLAY_STATE, 0, 'combat', dummyAnchor);
      expect(syncPrompt(sZone, true, true).active).toEqual(sZone.active);
    });

    it('作弊開關連線確認（syncCheatOn）：開啟時自動彈出，關閉時自動收合', () => {
      // 連線層確認開啟（false -> true）：彈出作弊面板
      const s1 = syncCheatOn(INITIAL_OVERLAY_STATE, true, false);
      expect(s1.active).toEqual({ type: 'cheat' });

      // 連線層關閉（true -> false）：若目前面板開著則收起
      const s2 = syncCheatOn(s1, false, true);
      expect(s2.active).toBeNull();

      // 連線層關閉時若開著其他浮層（例如 flow）：不受影響
      const sFlow = openFlow(INITIAL_OVERLAY_STATE);
      const s3 = syncCheatOn(sFlow, false, true);
      expect(s3.active).toEqual({ type: 'flow' });
    });
  });
});
