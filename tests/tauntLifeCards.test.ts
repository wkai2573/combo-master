import { describe, expect, it } from 'vitest';
import { totalDef } from '../src/engine/combat';
import { becomePursuitCard } from '../src/engine/judge';
import { newCard, Z } from '../src/engine/ops';
import { defOf, drive, names, pick, scenario, setZones } from './helpers';

const covered = (g: ReturnType<typeof scenario>, p: 0 | 1 = 0) => Z(g, p, 'exp').filter((c) => c.covered).length;
const labels = (g: ReturnType<typeof scenario>) => g.pending!.options.map((o) => o.label);

describe('嘲諷（劍士）：只能在先手步驟出招，出招時必須支付 [蓋2]', () => {
  const taunt = (p0: Parameters<typeof scenario>[0] extends infer S ? NonNullable<S> extends { p0?: infer P } ? P : never : never, extra = {}) =>
    scenario({ p0, p1: { hand: [] }, singlePhase: true, ...extra });

  it('先手步驟可以出；出招後蓋 2 生效，表側經驗少 2 張', () => {
    const g = taunt({ hand: ['嘲諷', '黑桃2'], exp: ['黑桃1', '黑桃3', '黑桃4'] });
    expect(labels(g)).toContain('嘲諷');
    pick(g, '嘲諷');
    expect(covered(g)).toBe(2);
    expect(Z(g, 0, 'exp').map((c) => c.covered)).toEqual([true, true, false]);
  });

  it('表側經驗不足 2 張就不能出，連一張都不能蓋時也一樣', () => {
    const g = taunt({ hand: ['嘲諷', '黑桃2'], exp: ['黑桃1', '~黑桃3'] });
    // 只剩黑桃2 可出，單一選項自動出招
    expect(g.pending).toBeNull();
    expect(names(g, 0, 'hand')).toEqual(['嘲諷']);
    expect(Z(g, 0, 'exp').slice(0, 2).map((c) => c.covered)).toEqual([false, true]); // 沒有被蓋2 動到
  });

  it('反擊步驟不能出：就算表側經驗夠，後攻方的選項也沒有嘲諷', () => {
    const g = scenario({
      first: 0, singlePhase: true,
      p0: { hand: ['黑桃9'] },
      p1: { hand: ['嘲諷', '黑桃8'], exp: ['黑桃1', '黑桃3'] },
    });
    expect(g.pending!.player).toBe(1);
    expect(labels(g)).toEqual(['黑桃8', '收招']);
  });

  it('後攻方第一個動作就收招（沒有招式）：先攻方打了嘲諷可以繼續出招，之後仍不追擊', () => {
    const g = taunt({ hand: ['嘲諷', '黑桃2'], exp: ['黑桃1', '黑桃3'] });
    pick(g, '嘲諷');
    expect(g.pending!.player).toBe(0);
    expect(g.pending!.title).toContain('反擊步驟');
    expect(labels(g)).toEqual(['黑桃2', '收招']);
    pick(g, '黑桃2');
    expect(g.pending).toBeNull();
    expect(Z(g, 0, 'exp').map((c) => c.id).slice(-2)).toEqual(['嘲諷', '黑桃2']); // 兩張招式歸還
    expect(g.state.flags.pursuitSuccess).toEqual([0, 0]);
    expect(Z(g, 0, 'deck')).toHaveLength(20); // 沒有追擊翻牌，也沒有受傷
  });

  it('沒有嘲諷時照舊：後攻方第一個動作就收招，先攻方不能繼續出招', () => {
    const g = taunt({ hand: ['黑桃9', '黑桃2'] });
    pick(g, '黑桃9');
    expect(g.pending).toBeNull();
    expect(names(g, 0, 'hand')).toEqual(['黑桃2']);
  });

  it('傷害計算時總防禦 −4X，X＝我方招式卡疊的卡數，含自己；總防禦最低為 0', () => {
    const solo = scenario({ p0: { moves: ['嘲諷'] } });
    expect(totalDef(solo, 0)).toBe(defOf('嘲諷') - 4);

    const two = scenario({ p0: { moves: ['嘲諷', '黑桃2'] } });
    expect(totalDef(two, 0)).toBe(defOf('嘲諷') + defOf('黑桃2') - 8);

    const floor = scenario({ p0: { moves: ['嘲諷', ...Array(5).fill('Explosion!')] } });
    expect(totalDef(floor, 0)).toBe(0);
  });

  it('追擊卡疊的卡不算在 X 裡', () => {
    const g = scenario({ p0: { moves: ['嘲諷'], pursuit: ['黑桃2'] } });
    expect(totalDef(g, 0)).toBe(defOf('嘲諷') - 4);
  });
});

describe('生命偷取（弓箭手）：[頂] 當我方追擊判定成功時，回復 2', () => {
  const success = (g: ReturnType<typeof scenario>, p: 0 | 1 = 0) => drive(becomePursuitCard(g, p, newCard(g, '黑桃3', p, 'hand')));

  it('在招式卡疊最上方時，每次追擊成功回復 2', () => {
    const g = scenario({ chars: ['遊俠', '勇者'], p0: { moves: ['生命偷取'], rage: Array(5).fill('黑桃1') } });
    success(g);
    expect(Z(g, 0, 'rage')).toHaveLength(3);
    success(g);
    expect(Z(g, 0, 'rage')).toHaveLength(1);
  });

  it('不在最上方不回復；對方追擊成功也不回復', () => {
    const g = scenario({ chars: ['遊俠', '勇者'], p0: { moves: ['生命偷取', '黑桃2'], rage: Array(5).fill('黑桃1') } });
    success(g);
    expect(Z(g, 0, 'rage')).toHaveLength(5);
    setZones(g, 0, { moves: ['黑桃2', '生命偷取'], rage: Array(5).fill('黑桃1') });
    success(g, 1);
    expect(Z(g, 0, 'rage')).toHaveLength(5);
  });
});

describe('生命藥水（共用）：[發_蓋3] 回復 3', () => {
  const potion = (exp: string[]) =>
    scenario({ singlePhase: true, p0: { hand: ['生命藥水', '黑桃2'], exp, rage: Array(5).fill('黑桃1') }, p1: { hand: [] } });

  it('付得起蓋 3 就詢問，發動後蓋 3、回復 3', () => {
    const g = potion(['黑桃1', '黑桃3', '黑桃4', '黑桃5']);
    pick(g, '生命藥水');
    pick(g, '發動');
    expect(covered(g)).toBe(3);
    expect(Z(g, 0, 'rage')).toHaveLength(2);
  });

  it('選擇不發動就沒有任何效果', () => {
    const g = potion(['黑桃1', '黑桃3', '黑桃4']);
    pick(g, '生命藥水');
    pick(g, '不發動');
    expect(covered(g)).toBe(0);
    expect(Z(g, 0, 'rage')).toHaveLength(5);
  });

  it('表側經驗不足 3 張不詢問', () => {
    const g = potion(['黑桃1', '黑桃3']);
    pick(g, '生命藥水');
    expect(g.pending?.title ?? '').not.toContain('生命藥水');
    expect(covered(g)).toBe(0);
  });
});
