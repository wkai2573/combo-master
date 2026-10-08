import type { Phase } from '../engine/types';

export interface TurnStep {
  phase: Phase;
  hint: string;
}

export interface StepGroup {
  label: string;
  steps: TurnStep[];
}

// 一個回合的步驟流動：重置 → 戰鬥（先手→反擊→追擊→傷害→歸還）→ 抽牌 → 爆發 → 增益 → 回合結束
// 戰鬥畫面上方的步驟列與戰鬥流程圖的主幹都讀這份，順序只在這裡寫一次
export const STEP_GROUPS: StepGroup[] = [
  { label: '重置', steps: [{ phase: '重置', hint: '把橫置的卡改回重置狀態' }] },
  {
    label: '戰鬥',
    steps: [
      { phase: '先手', hint: '先攻出 1 張招式' },
      { phase: '反擊', hint: '後攻先，輪流出招或收招' },
      { phase: '追擊', hint: '雙方翻牌組頂，不在範圍內才成功' },
      { phase: '傷害', hint: '對方攻擊 − 我方防禦＝放進怒氣區的張數' },
      { phase: '歸還', hint: '招式與追擊卡依序放進經驗區' },
    ],
  },
  { label: '抽牌', steps: [{ phase: '抽牌', hint: '各抽 1 張' }] },
  { label: '爆發', steps: [{ phase: '爆發', hint: '可把手牌放進經驗區，再抽 2 張' }] },
  { label: '增益', steps: [{ phase: '增益', hint: '可打出 1 張裝備或增益' }] },
  { label: '回合結束', steps: [{ phase: '回合結束', hint: '交換先後攻，進入下一回合' }] },
];

export const STEP_ORDER: Phase[] = STEP_GROUPS.flatMap((g) => g.steps.map((s) => s.phase));
