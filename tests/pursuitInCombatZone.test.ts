import { describe, expect, it } from 'vitest';
import { totalAtk, totalDef } from '../src/engine/combat';
import { inRange } from '../src/engine/judge';
import { Z } from '../src/engine/ops';
import { atkOf, defOf, pick, scenario, setZones } from './helpers';

const filler = Array(20).fill('黑桃2') as string[];

describe('卡效果的「戰鬥區」包含追擊卡疊', () => {
  it('盾擊：追擊成功的招式卡也補到原始防禦力，結算算進去', () => {
    const g = scenario({ chars: ['刺客', '勇者'] });
    expect(atkOf('梅花1')).toBeLessThan(defOf('梅花1'));
    setZones(g, 0, { moves: ['梅花1', '盾擊'], pursuit: ['梅花1'] });
    // 招式卡疊的梅花1 與追擊卡疊的梅花1 都補到防禦力
    expect(totalAtk(g, 0)).toBe(defOf('梅花1') + atkOf('盾擊') + defOf('梅花1'));
  });

  it('盾擊：沒在招式卡疊最上方就沒有效果，追擊卡也不補', () => {
    const g = scenario({ chars: ['刺客', '勇者'] });
    setZones(g, 0, { moves: ['盾擊', '梅花1'], pursuit: ['梅花1'] });
    expect(totalAtk(g, 0)).toBe(atkOf('盾擊') + atkOf('梅花1') + atkOf('梅花1'));
  });

  it('盾擊：追擊卡本來攻擊力就比較大時不變', () => {
    const g = scenario({ chars: ['刺客', '勇者'] });
    expect(atkOf('黑桃9')).toBeGreaterThan(defOf('黑桃9'));
    setZones(g, 0, { moves: ['盾擊'], pursuit: ['黑桃9'] });
    expect(totalAtk(g, 0)).toBe(atkOf('盾擊') + atkOf('黑桃9'));
  });

  it('凡骨的意志：白板卡數量包含追擊卡疊', () => {
    const ids = ['黑桃1', '黑桃2', '伏擊'];
    const g = scenario({
      chars: ['商人', '刺客'],
      p0: { exp: ['黑桃3', '黑桃4', '凡骨的意志'], moves: ids, pursuit: ['黑桃5'] },
    });
    // 開局已跑過第一回合的回合開始效果：白板卡是招式卡疊 2 張加追擊卡疊 1 張
    expect(totalAtk(g, 0)).toBe(ids.reduce((n, id) => n + atkOf(id), 0) + atkOf('黑桃5') + 3);
    expect(totalDef(g, 0)).toBe(ids.reduce((n, id) => n + defOf(id), 0) + 3);
  });

  it('冰與雷之曲：兩個特徵分散在招式卡疊與追擊卡疊也算', () => {
    const g = scenario({
      phase: '先手',
      singlePhase: true,
      p0: { hand: ['黑桃1', '黑桃2'], gear: ['冰與雷之曲'], exp: ['黑桃1', '黑桃2', '黑桃3'], moves: ['冰霜護甲'], pursuit: ['電弧'], rage: ['黑桃4'] },
      p1: { hand: ['黑桃9'] },
    });
    pick(g, '黑桃1');
    pick(g, '黑桃9');
    pick(g, '收招');
    expect(g.pending!.title).toContain('冰與雷之曲');
  });

  it('電弧：X 是對方戰鬥區的招式數量，包含追擊卡疊', () => {
    const g = scenario({
      phase: '先手',
      singlePhase: true,
      p0: { hand: ['電弧', '黑桃1'], deck: ['黑桃3', '黑桃4', '黑桃5', ...filler] },
      p1: { hand: ['黑桃9'], moves: ['黑桃6'], pursuit: ['黑桃7', '黑桃8'] },
    });
    pick(g, '電弧');
    // 對方招式卡疊 1 張加追擊卡疊 2 張：X = 3
    expect(g.pending!.title).toContain('選擇 3 張手牌');
  });
});

describe('規則本身只看招式卡疊，追擊卡疊不影響', () => {
  it('範圍內判定只看雙方招式卡疊最後一張', () => {
    const g = scenario();
    setZones(g, 0, { moves: ['黑桃5'], pursuit: ['黑桃9'] });
    setZones(g, 1, { moves: ['黑桃8'], pursuit: ['黑桃1'] });
    const c = (id: string) => Z(g, 0, 'deck').find((x) => x.id === id) ?? { ...Z(g, 0, 'moves')[0], id };
    expect(inRange(g, 0, c('黑桃6') as never)).toBe(true);
    expect(inRange(g, 0, c('黑桃9') as never)).toBe(false);
    expect(inRange(g, 0, c('黑桃1') as never)).toBe(false);
  });
});
