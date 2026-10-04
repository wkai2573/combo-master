import { describe, expect, it } from 'vitest';
import { Z } from '../src/engine/ops';
import { names, pick, scenario } from './helpers';

const filler = Array(20).fill('黑桃2') as string[];
const SWAP = '放到牌組底，改看下一張';
const KEEP = '就用這張';

/** 遊俠（玩家0，先攻）出 7、對手出 9，之後進入追擊：範圍 7~9 */
const archerScenario = (deck: string[], exp: string[] = []) =>
  scenario({
    chars: ['遊俠', '勇者'],
    p0: { hand: ['黑桃7'], deck, exp },
    p1: { hand: ['黑桃9'] },
  });

describe('遊俠・瞄準', () => {
  it('追擊判定前先看牌頂；不想要就放到牌底，改判定下一張', () => {
    const g = archerScenario(['黑桃8', '黑桃1', ...filler]);
    pick(g, '黑桃9');
    expect(g.pending!.title).toContain('瞄準');
    expect(g.pending!.title).toContain('黑桃8');
    expect(g.pending!.title).toContain('失敗'); // 8 在範圍 7~9 內
    pick(g, SWAP);
    // 本回合的瞄準用完了：不會再詢問，直接判定新的牌頂（黑桃1，範圍外 → 成功）
    expect(g.pending?.title ?? '').not.toContain('瞄準');
    expect(g.state.flags.pursuitSuccess[0]).toBe(1);
    expect(Z(g, 0, 'deck').at(-1)!.id).toBe('黑桃8');
  });

  it('選「就用這張」就直接判定，且不消耗次數', () => {
    const g = archerScenario(['黑桃8', '黑桃1', ...filler]);
    pick(g, '黑桃9');
    pick(g, KEEP);
    expect(g.state.flags.aimUsed[0]).toBe(0);
    expect(g.state.flags.pursuitSuccess[0]).toBe(0); // 黑桃8 在範圍內，判定失敗
    expect(names(g, 0, 'hand')).toContain('黑桃8');
  });

  it('提示會說明以目前範圍判定成功或失敗', () => {
    const g = archerScenario(['黑桃1', ...filler]);
    pick(g, '黑桃9');
    expect(g.pending!.title).toContain('成功'); // 1 在範圍 7~9 外
  });

  it('覺醒後每回合可瞄準 2 次', () => {
    const g = archerScenario(['黑桃8', '黑桃9', '黑桃1', ...filler], Array(8).fill('黑桃3'));
    pick(g, '黑桃9');
    pick(g, SWAP);
    expect(g.pending!.title).toContain('瞄準'); // 第二次
    expect(g.pending!.title).toContain('黑桃9');
    pick(g, SWAP);
    expect(g.pending?.title ?? '').not.toContain('瞄準');
    expect(g.state.flags.pursuitSuccess[0]).toBe(1); // 最後翻到黑桃1
    expect(Z(g, 0, 'deck').slice(-2).map((c) => c.id)).toEqual(['黑桃8', '黑桃9']);
  });

  it('只有遊俠有瞄準', () => {
    const g = scenario({
      chars: ['勇者', '刺客'],
      p0: { hand: ['黑桃7'], deck: ['黑桃8', '黑桃1', ...filler] },
      p1: { hand: ['黑桃9'] },
    });
    pick(g, '黑桃9');
    expect(g.state.log.join('\n')).not.toContain('瞄準');
  });

  it('牌組只剩 1 張時換不到別張，不會詢問', () => {
    const g = archerScenario(['黑桃8']);
    pick(g, '黑桃9');
    expect(g.pending?.title ?? '').not.toContain('瞄準');
  });
});
