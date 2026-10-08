import { describe, expect, it } from 'vitest';
import type { StartPhase } from '../src/engine/types';
import { pass, scenario, title } from './helpers';

const hands = { p0: { hand: ['黑桃1', '黑桃2'] }, p1: { hand: ['黑桃3', '黑桃4'] } };

describe('階段表：完整對局從任一起點開始，之前的階段不會執行', () => {
  it('重置與先手：第一個提示是先手步驟', () => {
    for (const phase of ['重置', '先手'] as StartPhase[]) {
      expect(title(scenario({ ...hands, phase }))).toContain('先手步驟');
    }
  });

  it('抽牌：跳過戰鬥，先抽牌再進爆發', () => {
    const g = scenario({ ...hands, phase: '抽牌' });
    expect(title(g)).toContain('爆發階段');
    expect(g.state.log.some((l) => l.includes('先手步驟'))).toBe(false);
    // 抽牌階段每人抽 1 張：2 → 3
    expect(g.state.players[0].zones.hand).toHaveLength(3);
  });

  it('爆發：跳過戰鬥與抽牌，直接進爆發', () => {
    const g = scenario({ ...hands, phase: '爆發' });
    expect(title(g)).toContain('爆發階段');
    expect(g.state.players[0].zones.hand).toHaveLength(2);
  });

  it('增益：只剩增益階段，沒有可打的牌就直接進下一回合的先手', () => {
    const g = scenario({ ...hands, phase: '增益' });
    expect(g.state.turn).toBe(2);
    expect(title(g)).toContain('先手步驟');
  });

  it('起始階段只適用於第 1 回合，第 2 回合從頭開始', () => {
    const g = scenario({ ...hands, phase: '爆發' });
    pass(g); // 先攻方不爆發
    pass(g); // 後攻方不爆發
    expect(g.state.turn).toBe(2);
    expect(title(g)).toContain('先手步驟');
  });
});

describe('階段表：只跑單一階段', () => {
  it('只執行指定的階段就結束，不進入下一個階段', () => {
    const g = scenario({ ...hands, phase: '爆發', singlePhase: true });
    expect(title(g)).toContain('爆發階段');
    pass(g);
    pass(g);
    expect(g.pending).toBeNull();
    expect(g.state.phase).toBe('結束');
    expect(g.state.turn).toBe(1);
  });

  it('單階段的抽牌與增益也只跑那一項', () => {
    const draw = scenario({ ...hands, phase: '抽牌', singlePhase: true });
    expect(draw.pending).toBeNull();
    expect(draw.state.players[0].zones.hand).toHaveLength(3);
    const buff = scenario({ ...hands, phase: '增益', singlePhase: true });
    expect(buff.pending).toBeNull();
    expect(buff.state.players[0].zones.hand).toHaveLength(2);
  });

  it('單階段的重置只執行回合開始的效果', () => {
    const g = scenario({ ...hands, phase: '重置', singlePhase: true });
    expect(g.pending).toBeNull();
    expect(g.state.phase).toBe('結束');
  });
});

describe('階段表：不認得的起點', () => {
  it('直接報錯，不悄悄跑錯階段', () => {
    expect(() => scenario({ phase: '追擊' as never })).toThrow('不能從「追擊」階段開始');
    expect(() => scenario({ phase: '反擊' as never, singlePhase: true })).toThrow('不能從「反擊」階段開始');
  });
});

describe('階段表：戰鬥階段開頭的橫幅', () => {
  const banners = (g: ReturnType<typeof scenario>) => g.drainFrames().filter((f) => f.fx.type === 'banner');

  it('完整對局有橫幅', () => {
    expect(banners(scenario({ ...hands, animate: true, phase: '先手' }))).toHaveLength(1);
  });

  it('單階段沒有橫幅', () => {
    expect(banners(scenario({ ...hands, animate: true, phase: '先手', singlePhase: true }))).toHaveLength(0);
  });
});
