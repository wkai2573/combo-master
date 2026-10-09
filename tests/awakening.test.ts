import { describe, expect, it } from 'vitest';
import { windowEffects } from '../src/engine/effects';
import { Z } from '../src/engine/ops';
import { pick, scenario, setZones } from './helpers';

const labels = (g: ReturnType<typeof scenario>) => g.pending!.options.map((o) => o.label);
const exp = (n: number) => Array(n).fill('黑桃1') as string[];

describe('覺醒時的效果（遊俠：可以抽 2）', () => {
  it('爆發讓經驗區達到覺醒經驗時，遊俠可以選擇抽 2', () => {
    const g = scenario({
      chars: ['遊俠', '勇者'],
      phase: '爆發',
      singlePhase: true,
      p0: { hand: ['黑桃3'], exp: exp(7) },
      p1: { hand: [] },
    });
    pick(g, '黑桃3'); // 經驗區 8 張＝覺醒；爆發本身抽 2
    expect(g.pending!.title).toContain('覺醒');
    expect(labels(g)).toEqual(['發動', '不發動']);
    expect(Z(g, 0, 'hand')).toHaveLength(2);
    pick(g, '發動');
    expect(Z(g, 0, 'hand')).toHaveLength(4);
  });

  it('覺醒時的抽牌是選發：選擇不發動就不抽', () => {
    const g = scenario({ chars: ['遊俠', '勇者'], phase: '爆發', singlePhase: true, p0: { hand: ['黑桃3'], exp: exp(7) }, p1: { hand: [] } });
    pick(g, '黑桃3');
    pick(g, '不發動');
    expect(Z(g, 0, 'hand')).toHaveLength(2);
  });

  it('開局就已經覺醒的狀態不算進入覺醒；覺醒狀態沒有改變就不會重複觸發', () => {
    const g = scenario({ chars: ['遊俠', '勇者'], phase: '爆發', singlePhase: true, p0: { hand: ['黑桃3'], exp: exp(9) }, p1: { hand: [] } });
    pick(g, '黑桃3');
    expect(g.pending).toBeNull();
  });

  it('不是遊俠就沒有覺醒時的效果', () => {
    const g = scenario({ chars: ['勇者', '遊俠'], phase: '爆發', singlePhase: true, p0: { hand: ['黑桃3'], exp: exp(7) }, p1: { hand: [] } });
    pick(g, '黑桃3');
    expect(g.pending).toBeNull();
  });

  it('與同一步驟的爆發效果在同一個窗口，自己決定順序', () => {
    const g = scenario({
      chars: ['遊俠', '勇者'],
      phase: '爆發',
      singlePhase: true,
      p0: { hand: ['黑桃3'], gear: ['招財貓'], exp: exp(7) },
      p1: { hand: [] },
    });
    pick(g, '黑桃3');
    expect(g.pending!.title).toContain('爆發後');
    expect(labels(g)).toEqual(['【招財貓】爆發時，抽 1（蓋2）', '【遊俠】覺醒：抽 2', '結束（不再發動）']);
    pick(g, '【遊俠】覺醒：抽 2');
    expect(Z(g, 0, 'hand')).toHaveLength(4);
    pick(g, '發動'); // 只剩招財貓：原本的確認
  });

  it('歸還讓經驗區達到覺醒經驗時也會觸發', () => {
    const g = scenario({
      chars: ['遊俠', '勇者'],
      phase: '先手',
      singlePhase: true,
      p0: { hand: ['黑桃1'], exp: exp(7) },
      p1: { hand: [] },
    });
    // 先手出招、對方沒有招式直接進入傷害，歸還後經驗區 8 張＝覺醒
    expect(g.pending!.title).toContain('覺醒');
    pick(g, '發動');
    expect(Z(g, 0, 'hand')).toHaveLength(2);
  });
});

describe('覺醒時的效果（法師：可以抽 1）', () => {
  it('爆發讓經驗區達到覺醒經驗時，法師可以選擇抽 1；不再有抽牌階段額外抽牌', () => {
    const g = scenario({ chars: ['法師', '勇者'], phase: '爆發', singlePhase: true, p0: { hand: ['黑桃3'], exp: exp(7) }, p1: { hand: [] } });
    pick(g, '黑桃3'); // 經驗區 8 張＝覺醒；爆發本身抽 2
    expect(g.pending!.title).toContain('覺醒');
    expect(labels(g)).toEqual(['發動', '不發動']);
    expect(Z(g, 0, 'hand')).toHaveLength(2);
    pick(g, '發動');
    expect(Z(g, 0, 'hand')).toHaveLength(3);
  });

  it('選擇不發動就不抽；已經覺醒的狀態下抽牌階段不會多抽', () => {
    const g = scenario({ chars: ['法師', '勇者'], phase: '爆發', singlePhase: true, p0: { hand: ['黑桃3'], exp: exp(7) }, p1: { hand: [] } });
    pick(g, '黑桃3');
    pick(g, '不發動');
    expect(Z(g, 0, 'hand')).toHaveLength(2);

    const awake = scenario({ chars: ['法師', '勇者'], p0: { hand: ['黑桃5'], exp: exp(8), rage: ['黑桃2'] }, p1: { hand: [] } });
    expect(Z(awake, 0, 'hand')).toHaveLength(1); // 抽牌階段只抽 1，沒有額外抽牌
  });
});

describe('進入覺醒的偵測', () => {
  it('每次由未覺醒變成覺醒都算一次；退出覺醒後再次達標會再觸發', () => {
    const g = scenario({ chars: ['遊俠', '勇者'], p0: { exp: exp(0) } });
    expect(windowEffects(g, 0, 'onAwaken')).toHaveLength(0);
    setZones(g, 0, { exp: exp(8) });
    expect(windowEffects(g, 0, 'onAwaken')).toHaveLength(1); // 第一次進入覺醒
    expect(windowEffects(g, 0, 'onAwaken')).toHaveLength(0); // 狀態沒變，不重複
    setZones(g, 0, { exp: exp(7) });
    expect(windowEffects(g, 0, 'onAwaken')).toHaveLength(0); // 退出覺醒
    setZones(g, 0, { exp: exp(8) });
    expect(windowEffects(g, 0, 'onAwaken')).toHaveLength(1); // 再次覺醒：再次觸發
  });

  it('雙方各自偵測', () => {
    const g = scenario({ chars: ['遊俠', '遊俠'], p0: { exp: exp(0) }, p1: { exp: exp(0) } });
    setZones(g, 1, { exp: exp(8) });
    expect(windowEffects(g, 0, 'onAwaken')).toHaveLength(0);
    expect(windowEffects(g, 1, 'onAwaken')).toHaveLength(1);
  });
});
