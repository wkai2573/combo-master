import type { Phase } from '../engine/types';

export interface TurnStep {
  phase: Phase;
  hint: string;
}

export interface StepGroup {
  label: string;
  steps: TurnStep[];
}

// 一個回合的步驟流動：回合開始 → 抽牌 → 爆發 → 增益 → 戰鬥（先手→反擊→追擊→傷害→歸還）→ 回合結束（第 1 回合略過抽牌與爆發）
// 戰鬥畫面上方的步驟列與戰鬥流程圖的主幹都讀這份，順序只在這裡寫一次
export const STEP_GROUPS: StepGroup[] = [
  { label: '回合開始', steps: [{ phase: '回合開始', hint: '處理回合開始時的效果' }] },
  { label: '抽牌', steps: [{ phase: '抽牌', hint: '各抽 1 張（第 1 回合略過）' }] },
  { label: '爆發', steps: [{ phase: '爆發', hint: '可把手牌放進經驗區，再抽 2 張（第 1 回合略過）' }] },
  { label: '增益', steps: [{ phase: '增益', hint: '可打出 1 張裝備或增益' }] },
  {
    label: '戰鬥',
    steps: [
      { phase: '先手', hint: '先攻出 1 張招式' },
      { phase: '反擊', hint: '後攻先，輪流出招或收招' },
      { phase: '追擊', hint: '雙方都有招式才翻牌組頂，不在範圍內才成功' },
      { phase: '傷害', hint: '對方攻擊 − 我方防禦＝放進怒氣區的張數' },
      { phase: '歸還', hint: '招式與追擊卡依序放進經驗區' },
    ],
  },
  { label: '回合結束', steps: [{ phase: '回合結束', hint: '橫置的卡改回重置狀態，交換先後攻，進入下一回合' }] },
];

export const STEP_ORDER: Phase[] = STEP_GROUPS.flatMap((g) => g.steps.map((s) => s.phase));
