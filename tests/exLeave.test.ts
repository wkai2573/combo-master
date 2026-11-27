import { describe, expect, it } from 'vitest';
import { discard, move, Z } from '../src/engine/ops';
import { scenario } from './helpers';

describe('Ex 卡離開場上時移除遊戲', () => {
  it('在經驗區的 Ex 卡被捨棄：不進棄牌區', () => {
    const g = scenario({ p0: { exp: ['Ex-中毒', '黑桃3'] }, singlePhase: true });
    discard(g, Z(g, 0, 'exp')[0]);
    expect(Z(g, 0, 'discard')).toEqual([]);
    expect(Z(g, 0, 'exp').map((c) => c.id)).toEqual(['黑桃3']);
  });

  it('在增益區的 Ex 卡被移走：不進任何區域', () => {
    const g = scenario({ p0: { buff: ['Ex-中毒'], hand: ['黑桃3'] }, singlePhase: true });
    const [ex] = Z(g, 0, 'buff');
    move(g, ex, 'discard');
    expect(Z(g, 0, 'buff')).toEqual([]);
    expect(Z(g, 0, 'exp')).toEqual([]);
    const [again] = scenario({ p0: { buff: ['Ex-中毒'] }, singlePhase: true }).state.players[0].zones.buff;
    expect(again.zone).toBe('buff');
  });

  it('Ex 卡在經驗、增益與戰鬥區之間移動時仍留在場上', () => {
    const g = scenario({ p0: { exp: ['Ex-中毒'] }, singlePhase: true });
    const [ex] = Z(g, 0, 'exp');
    move(g, ex, 'buff');
    expect(Z(g, 0, 'exp')).toEqual([]);
    expect(Z(g, 0, 'buff')).toContain(ex);
    move(g, ex, 'moves');
    expect(Z(g, 0, 'buff')).toEqual([]);
    expect(Z(g, 0, 'moves')).toContain(ex);
  });

  it.each(['moves', 'stunt', 'pursuit'] as const)('戰鬥區的 Ex 卡離開 %s 時移除遊戲', (zone) => {
    const g = scenario({ p0: { [zone]: ['Ex-中毒'] }, singlePhase: true });
    const [ex] = Z(g, 0, zone);
    discard(g, ex);
    expect(Z(g, 0, zone)).toEqual([]);
    expect(Z(g, 0, 'discard')).toEqual([]);
  });

  it('一般卡離開增益區照舊進目的地區域', () => {
    const g = scenario({ p0: { buff: ['黑桃3'] }, singlePhase: true });
    discard(g, Z(g, 0, 'buff')[0]);
    expect(Z(g, 0, 'discard').map((c) => c.id)).toEqual(['黑桃3']);
  });
});
