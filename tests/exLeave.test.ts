import { describe, expect, it } from 'vitest';
import { checkExLeaveRule, EX_LEAVE_RULES } from '../src/data/exCards';
import { discard, move, Z } from '../src/engine/ops';
import { scenario } from './helpers';

describe('Ex 卡離開所在區域就移除遊戲', () => {
  it('在經驗區的 Ex 卡被捨棄：不進棄牌區', () => {
    const g = scenario({ p0: { exp: ['Ex-中毒', '黑桃3'] }, singlePhase: true });
    discard(g, Z(g, 0, 'exp')[0]);
    expect(Z(g, 0, 'discard')).toEqual([]);
    expect(Z(g, 0, 'exp').map((c) => c.id)).toEqual(['黑桃3']);
  });

  it('在增益區的 Ex 卡被移走：不進任何區域', () => {
    const g = scenario({ p0: { buff: ['Ex-中毒'], hand: ['黑桃3'] }, singlePhase: true });
    const [ex] = Z(g, 0, 'buff');
    move(g, ex, 'exp');
    expect(Z(g, 0, 'buff')).toEqual([]);
    expect(Z(g, 0, 'exp')).toEqual([]);
    const [again] = scenario({ p0: { buff: ['Ex-中毒'] }, singlePhase: true }).state.players[0].zones.buff;
    expect(again.zone).toBe('buff');
  });

  it('一般卡離開增益區照舊進目的地區域', () => {
    const g = scenario({ p0: { buff: ['黑桃3'] }, singlePhase: true });
    discard(g, Z(g, 0, 'buff')[0]);
    expect(Z(g, 0, 'discard').map((c) => c.id)).toEqual(['黑桃3']);
  });
});

describe('Ex 卡通則的文字檢查', () => {
  const [EXP, BUFF] = [EX_LEAVE_RULES.exp, EX_LEAVE_RULES.buff];

  it('指定區域時必須寫對應的那一句', () => {
    expect(checkExLeaveRule(`[經]：我方 +0−1。\n${EXP}`, 'exp')).toBe('');
    expect(checkExLeaveRule(`持續回合：2。\n${BUFF}`, 'buff')).toBe('');
    expect(checkExLeaveRule(`[經]：我方 +0−1。\n${BUFF}`, 'exp')).toContain(EXP);
    expect(checkExLeaveRule(`持續回合：2。\n${EXP}`, 'buff')).toContain(BUFF);
    expect(checkExLeaveRule('[經]：我方 +0−1。', 'exp')).not.toBe('');
  });

  it('不知道區域時兩句擇一即可，都沒有才失敗', () => {
    expect(checkExLeaveRule(EXP)).toBe('');
    expect(checkExLeaveRule(BUFF)).toBe('');
    expect(checkExLeaveRule('持續回合：2。')).not.toBe('');
  });
});
