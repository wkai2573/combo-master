import { describe, expect, it } from 'vitest';
import { STEP_GROUPS, STEP_ORDER } from '../src/data/turnSteps';
import type { Phase } from '../src/engine/types';

// 用 Record 讓 Phase 多出新值時，這裡會在型別檢查就報錯
const ALL_PHASES: Record<Phase, true> = {
  設置: true, 重置: true, 先手: true, 反擊: true, 追擊: true, 傷害: true, 歸還: true,
  抽牌: true, 爆發: true, 增益: true, 回合結束: true, 結束: true,
};
const NOT_IN_TURN: Phase[] = ['設置', '結束'];

describe('回合步驟表', () => {
  it('涵蓋 Phase 除了設置與結束之外的所有值', () => {
    const expected = (Object.keys(ALL_PHASES) as Phase[]).filter((p) => !NOT_IN_TURN.includes(p));
    expect([...STEP_ORDER].sort()).toEqual([...expected].sort());
  });

  it('沒有重複的階段', () => {
    expect(new Set(STEP_ORDER).size).toBe(STEP_ORDER.length);
  });

  it('順序與規則書的回合流程一致', () => {
    expect(STEP_ORDER).toEqual(['重置', '先手', '反擊', '追擊', '傷害', '歸還', '抽牌', '爆發', '增益', '回合結束']);
  });

  it('每個分組有名稱，每個階段有提示', () => {
    for (const g of STEP_GROUPS) {
      expect(g.label.trim()).not.toBe('');
      for (const s of g.steps) expect(s.hint.trim(), s.phase).not.toBe('');
    }
  });
});
