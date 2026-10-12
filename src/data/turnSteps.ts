import type { Phase, PlayerId } from '../engine/types';

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

export interface StepHint {
  phase: Phase;
  hint: string;
  /** 先手與反擊步驟輪到誰：「輪到你」「輪到對手」，其他情況是空字串 */
  who: string;
}

/** 目前步驟的規則提示（戰鬥畫面的步驟列與手機版面戰鬥區中央都顯示它）；不在回合步驟裡的階段沒有提示 */
export function stepHint(phase: Phase, waitingFor: PlayerId | null, me: PlayerId): StepHint | null {
  const cur = STEP_GROUPS.flatMap((g) => g.steps).find((s) => s.phase === phase);
  if (!cur) return null;
  const who = waitingFor === null || (phase !== '先手' && phase !== '反擊') ? '' : waitingFor === me ? '輪到你' : '輪到對手';
  return { phase: cur.phase, hint: cur.hint, who };
}
