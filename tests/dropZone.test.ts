import { describe, expect, it } from 'vitest';
import { getCard } from '../src/data/cards';
import { viewFor } from '../src/engine/view';
import { pick, scenario } from './helpers';

// 放置區：要求選手牌的提示標明被選的牌放開後該去的區域，介面據此讓手牌拖曳使用
describe('提示的放置區', () => {
  it('爆發階段：放入經驗區', () => {
    const g = scenario({ phase: '爆發', singlePhase: true, p0: { hand: ['黑桃3'] }, p1: { hand: [] } });
    expect(g.pending!.title).toContain('爆發階段');
    expect(g.pending!.dropZone).toBe('exp');
  });

  it('增益階段：打出裝備或增益放進裝備增益區', () => {
    expect(getCard('木棍').kind).toBe('equip');
    const g = scenario({ phase: '增益', singlePhase: true, p0: { hand: ['木棍'], exp: Array(getCard('木棍').expReq).fill('黑桃1') }, p1: { hand: [] } });
    expect(g.pending!.title).toContain('增益階段');
    expect(g.pending!.dropZone).toBe('gear');
  });

  it('先手步驟：出招放進戰鬥區', () => {
    const g = scenario({ phase: '先手', singlePhase: true, p0: { hand: ['黑桃1', '黑桃2'] }, p1: { hand: ['黑桃9'] } });
    expect(g.pending!.title).toContain('先手步驟');
    expect(g.pending!.dropZone).toBe('moves');
  });

  it('反擊步驟：出招放進戰鬥區', () => {
    const g = scenario({ phase: '先手', singlePhase: true, p0: { hand: ['黑桃1'] }, p1: { hand: ['黑桃9', '黑桃8'] } });
    // 先攻方只有 1 張招式，先手步驟自動出招，直接輪到後攻方反擊
    expect(g.pending!.title).toContain('反擊步驟');
    expect(g.pending!.dropZone).toBe('moves');
  });

  it('整場對局裡只有出招、爆發、增益這幾種選手牌的提示帶放置區', () => {
    const g = scenario({ fullGame: true });
    const seen = new Set<string>();
    for (let i = 0; i < 600 && g.pending; i++) {
      const req = g.pending;
      const hasZone = req.dropZone !== undefined;
      const isHandStep = /爆發階段|增益階段|先手步驟|反擊步驟/.test(req.title);
      expect(hasZone).toBe(isHandStep);
      if (hasZone) seen.add(req.dropZone!);
      g.submit(req.player, req.options.slice(0, Math.max(req.min, 1)).map((o) => o.key));
    }
    expect([...seen]).toEqual(expect.arrayContaining(['moves', 'exp']));
  });

  it('放置區隨視角一起交給回應者', () => {
    const g = scenario({ phase: '爆發', singlePhase: true, p0: { hand: ['黑桃3'] }, p1: { hand: [] } });
    expect(viewFor(g, 0).prompt?.dropZone).toBe('exp');
    expect(viewFor(g, 1).prompt).toBeNull();
  });
});
