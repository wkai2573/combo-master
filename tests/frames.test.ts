import { describe, expect, it } from 'vitest';
import { frameFor } from '../src/engine/view';
import { pick, scenario } from './helpers';

const types = (g: ReturnType<typeof scenario>, viewer: 0 | 1 = 0) => g.drainFrames().map((f) => frameFor(f, viewer));

/** types 是否依序包含 want（可夾雜其他影格） */
const hasInOrder = (types: string[], want: string[]) => {
  let i = 0;
  for (const t of types) if (t === want[i]) i++;
  return i === want.length;
};

describe('動畫影格', () => {
  it('沒開 animate 時不錄影格', () => {
    const g = scenario({ p0: { hand: ['黑桃5'] }, p1: { hand: ['黑桃9'] } });
    pick(g, '黑桃9');
    expect(g.drainFrames()).toHaveLength(0);
  });

  it('一次完整的拼招依序錄下：出招 → 收招 → 翻牌與結果 → 傷害算式 → 扣血 → 歸還', () => {
    const g = scenario({ animate: true, p0: { hand: ['黑桃5'] }, p1: { hand: ['黑桃9'] } });
    g.drainFrames(); // 丟掉開局的影格
    pick(g, '黑桃9');
    const frames = types(g);
    const t = frames.map((f) => f.fx.type);
    expect(
      hasInOrder(t, ['play', 'pass', 'pass', 'phase', 'flip', 'flipResult', 'flip', 'flipResult', 'calc', 'damage', 'return']),
    ).toBe(true);

    // 傷害算式的數字與實際扣血一致（與 rules.test 的情境相同：玩家0 受 9、玩家1 受 7）
    const calc = frames.find((f) => f.fx.type === 'calc')!.fx;
    expect(calc.type === 'calc' && calc.dmg).toEqual([9, 7]);
    const dmg = frames.find((f) => f.fx.type === 'damage')!.view;
    expect(dmg.players[0].rage).toHaveLength(9);
    // 對手的怒氣區內容對我方是隱藏的，但張數看得到
    expect(dmg.players[1].rage).toHaveLength(7);
    expect(dmg.players[1].rage.every((c) => c.id === null)).toBe(true);
  });

  it('翻牌影格的牌還在牌組、結果影格的牌已到追擊區或手中', () => {
    const g = scenario({
      animate: true,
      p0: { hand: ['黑桃5'], deck: ['黑桃1', ...Array(20).fill('黑桃2')] },
      p1: { hand: ['黑桃9'] },
    });
    g.drainFrames();
    pick(g, '黑桃9');
    const frames = types(g);
    const i = frames.findIndex((f) => f.fx.type === 'flip' && f.fx.player === 0);
    const flip = frames[i];
    const result = frames[i + 1];
    expect(flip.fx.type === 'flip' && flip.fx.cardId).toBe('黑桃1');
    expect(flip.view.players[0].pursuit).toHaveLength(0);
    expect(result.fx.type === 'flipResult' && result.fx.ok).toBe(true); // 黑桃1 不在 5~9 範圍內
    expect(result.view.players[0].pursuit.map((c) => c.id)).toEqual(['黑桃1']);
  });

  it('影格不洩漏對手手牌，且紀錄長度不會倒退', () => {
    const g = scenario({ animate: true, p0: { hand: ['黑桃5'] }, p1: { hand: ['黑桃9', '黑桃2'] } });
    pick(g, '黑桃9');
    const frames = types(g, 0);
    expect(frames.length).toBeGreaterThan(3);
    for (const f of frames) {
      expect(f.view.players[1].hand.every((c) => c.id === null)).toBe(true);
      expect(f.view.log).toEqual([]); // 影格不攜帶完整紀錄，改以 logLen 截取
    }
    const lens = frames.map((f) => f.logLen);
    expect([...lens].sort((a, b) => a - b)).toEqual(lens);
  });
});
