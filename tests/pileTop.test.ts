import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '../src/data/cards';
import { pileTop, viewFor } from '../src/engine/view';
import { scenario } from './helpers';

const GEAR = ALL_CARDS.find((c) => c.kind === 'equip')!.id;
// 目前卡表沒有增益卡；增益區只看卡在哪裡，放任何一張招式即可
const BUFF = '黑桃9';

// 手機版面的牌堆頂牌：經驗堆是最後放進去的那張，裝備增益堆是裝備加增益排好後的最後一張
describe('牌堆頂牌', () => {
  it('沒有牌的牌堆沒有頂牌', () => {
    const v = viewFor(scenario({ p0: { exp: [] } }), 0);
    expect(pileTop(v.players[0], 'exp')).toBeNull();
    expect(pileTop(v.players[0], 'gear')).toBeNull();
  });

  it('經驗堆的頂牌是經驗區最後一張', () => {
    const v = viewFor(scenario({ p0: { exp: ['黑桃3', '黑桃4', '黑桃5'] } }), 0);
    const top = pileTop(v.players[0], 'exp')!;
    expect(top.id).toBe('黑桃5');
    expect(top.covered).toBe(false);
  });

  it('頂牌是裏側：擁有者看得到牌面並標為裏側', () => {
    const v = viewFor(scenario({ p0: { exp: ['黑桃3', '~黑桃4'] } }), 0);
    const top = pileTop(v.players[0], 'exp')!;
    expect(top.id).toBe('黑桃4');
    expect(top.covered).toBe(true);
  });

  it('頂牌是裏側：對手只看到牌背', () => {
    const v = viewFor(scenario({ p0: { exp: ['黑桃3', '~黑桃4'] } }), 1);
    expect(pileTop(v.players[0], 'exp')!.id).toBeNull();
  });

  it('裝備增益堆：裝備在前、增益在後，頂牌是最後一張', () => {
    const v = viewFor(scenario({ p0: { gear: [GEAR], buff: [BUFF] } }), 0);
    expect(pileTop(v.players[0], 'gear')!.id).toBe(BUFF);
  });

  it('裝備增益堆只有裝備時，頂牌是那張裝備', () => {
    const v = viewFor(scenario({ p0: { gear: [GEAR] } }), 0);
    expect(pileTop(v.players[0], 'gear')!.id).toBe(GEAR);
  });
});
