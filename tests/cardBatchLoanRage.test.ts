import { describe, expect, it } from 'vitest';
import { getCard } from '../src/data/cards';
import { totalAtk, totalDef } from '../src/engine/combat';
import { names, scenario, setZones } from './helpers';

// 卡表更新批次（貸款、狂怒、閃電新星與既有卡調整）：直接套用卡表的數值
describe('既有卡的數值調整', () => {
  const stats = (id: string) => { const c = getCard(id); return [c.atk, c.def, c.combo]; };

  it('魅影射擊守 0、盾擊 0／2、二連矢 3／4／2，連擊值不變（二連矢除外）；地雷陷阱數值不變', () => {
    expect(stats('魅影射擊')).toEqual([5, 0, 5]);
    expect(stats('盾擊')).toEqual([0, 2, 6]);
    expect(stats('二連矢')).toEqual([3, 4, 2]);
    expect(stats('地雷陷阱')).toEqual([3, 4, 3]);
  });

  it('盾擊在最上方：原始攻擊小於原始防禦，攻擊改用原始防禦 2', () => {
    const g = scenario({ chars: ['勇者', '刺客'] });
    setZones(g, 0, { moves: ['盾擊'] });
    expect(totalAtk(g, 0)).toBe(2);
    expect(totalDef(g, 0)).toBe(2);
  });

  it('魅影射擊成為追擊卡：+0+4，本身防禦 0', () => {
    const g = scenario({ chars: ['遊俠', '勇者'] });
    setZones(g, 0, { moves: ['黑桃1'], pursuit: ['魅影射擊'] });
    expect(totalDef(g, 0)).toBe(getCard('黑桃1').def + 0 + 4);
  });

  it('家族相片需要 4 張經驗才能在增益階段打出', () => {
    expect(getCard('家族相片').expReq).toBe(4);
    const few = scenario({ phase: '增益', singlePhase: true, p0: { hand: ['家族相片'], exp: Array(3).fill('黑桃2') } });
    expect(few.pending?.player).not.toBe(0); // 3 張不夠：玩家 0 沒有可打出的裝備，不被詢問
    const enough = scenario({ phase: '增益', singlePhase: true, p0: { hand: ['家族相片'], exp: Array(4).fill('黑桃2') } });
    expect(enough.pending!.options.map((o) => o.label)).toEqual(['家族相片']);
    expect(names(enough, 0, 'gear')).toEqual([]);
  });
});
