import { describe, expect, it } from 'vitest';
import { combatZone, data, Z } from '../src/engine/ops';

import { scenario, setZones } from './helpers';

describe('戰鬥區＝招式卡疊加追擊卡疊', () => {
  it('招式卡疊在前、追擊卡疊在後，各自保持由底到頂的順序', () => {
    const g = scenario();
    setZones(g, 0, { moves: ['黑桃1', '黑桃2'], pursuit: ['黑桃3', '黑桃4'] });
    expect(combatZone(g, 0).map((c) => data(c).name)).toEqual(['黑桃1', '黑桃2', '黑桃3', '黑桃4']);
  });

  it('沒有追擊卡時等於招式卡疊，沒有任何牌時是空的', () => {
    const g = scenario();
    setZones(g, 0, { moves: ['黑桃1'] });
    expect(combatZone(g, 0)).toEqual(Z(g, 0, 'moves'));
    setZones(g, 1, { moves: [], pursuit: [] });
    expect(combatZone(g, 1)).toEqual([]);
  });
});
