import { describe, expect, it } from 'vitest';
import { pass, pick, scenario, title } from './helpers';

const hands = { p0: { hand: ['黑桃1', '黑桃2'] }, p1: { hand: ['黑桃3', '黑桃4'] } };

describe('階段表：完整對局從任一起點開始，之前的階段不會執行', () => {
  it('回合開始與抽牌：指定的起點照常執行，先抽牌再進爆發', () => {
    for (const phase of ['回合開始', '抽牌'] as const) {
      const g = scenario({ ...hands, phase });
      expect(title(g), phase).toContain('爆發階段');
      // 抽牌階段每人抽 1 張：2 → 3
      expect(g.state.players[0].zones.hand, phase).toHaveLength(3);
    }
  });

  it('爆發：跳過回合開始與抽牌，直接進爆發', () => {
    const g = scenario({ ...hands, phase: '爆發' });
    expect(title(g)).toContain('爆發階段');
    expect(g.state.players[0].zones.hand).toHaveLength(2);
    expect(g.state.log.some((l) => l.includes('抽牌階段'))).toBe(false);
  });

  it('增益：沒有可打的牌就直接進同一回合的戰鬥', () => {
    const g = scenario({ ...hands, phase: '增益' });
    expect(g.state.turn).toBe(1);
    expect(title(g)).toContain('先手步驟');
  });

  it('先手：只剩戰鬥階段，不抽牌也不爆發', () => {
    const g = scenario({ ...hands, phase: '先手' });
    expect(title(g)).toContain('先手步驟');
    expect(g.state.players[0].zones.hand).toHaveLength(2);
  });

  it('先攻每回合交換，但開局先攻方一直記著', () => {
    const g = scenario({ ...hands, first: 1, phase: '先手' });
    pick(g, '黑桃3');
    pick(g, '收招'); // 後攻首手收招，直接傷害計算
    expect(g.state.turn).toBe(2);
    expect(g.state.first).toBe(0);
    expect(g.state.openingFirst).toBe(1);
  });
});

describe('階段表：第 1 回合略過抽牌與爆發', () => {
  it('沒有指定起始階段：第 1 回合直接進戰鬥，不抽牌、沒有爆發提示', () => {
    const g = scenario({ ...hands, fullGame: true });
    expect(g.state.turn).toBe(1);
    expect(title(g)).toContain('先手步驟');
    expect(g.state.players[0].zones.hand).toHaveLength(2);
    expect(g.state.players[1].zones.hand).toHaveLength(2);
    expect(g.state.log.some((l) => l.includes('抽牌階段') || l.includes('爆發'))).toBe(false);
  });

  it('第 2 回合起走完整順序：回合開始、抽牌、爆發，然後才是戰鬥', () => {
    const g = scenario({ ...hands, fullGame: true });
    pick(g, '黑桃1'); // 先攻先手出招
    pick(g, '收招'); // 後攻首手收招，直接傷害計算
    expect(g.state.turn).toBe(2);
    expect(title(g)).toContain('爆發階段');
    // 第 1 回合出的招式歸還到經驗區，第 2 回合各抽 1 張
    expect(g.state.players[0].zones.hand).toHaveLength(2);
    expect(g.state.players[1].zones.hand).toHaveLength(3);
    expect(g.state.log.some((l) => l.includes('第 2 回合') && l.includes('先攻'))).toBe(true);
    pass(g);
    pass(g);
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

  it('單階段的回合開始只執行回合開始的效果', () => {
    const g = scenario({ ...hands, phase: '回合開始', singlePhase: true });
    expect(g.pending).toBeNull();
    expect(g.state.phase).toBe('結束');
  });
});

describe('階段表：不認得的起點', () => {
  it('直接報錯，不悄悄跑錯階段', () => {
    expect(() => scenario({ phase: '追擊' as never })).toThrow('不能從「追擊」階段開始');
    expect(() => scenario({ phase: '反擊' as never, singlePhase: true })).toThrow('不能從「反擊」階段開始');
    expect(() => scenario({ phase: '重置' as never })).toThrow('不能從「重置」階段開始');
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
