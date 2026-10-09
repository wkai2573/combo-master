import { describe, expect, it } from 'vitest';
import { totalAtk } from '../src/engine/combat';
import type { Game } from '../src/engine/game';
import { Z } from '../src/engine/ops';
import { getCard } from '../src/data/cards';
import { atkOf, names, pick, scenario, setZones } from './helpers';

const many = (id: string, n: number) => Array(n).fill(id) as string[];
const filler = many('黑桃1', 20);

/** 一路以「不選／選前幾個」回應，直到進入指定回合 */
function skipToTurn(g: Game, turn: number) {
  for (let i = 0; i < 200 && g.pending && g.state.turn < turn; i++) {
    const req = g.pending;
    g.submit(req.player, req.options.slice(0, req.min).map((o) => o.key));
  }
}

describe('追擊相關', () => {
  it('力量爆破作為追擊卡時判定失敗', () => {
    const g = scenario({
      p0: { hand: ['黑桃2'], deck: ['力量爆破', ...filler] },
      p1: { hand: ['黑桃4'] },
    });
    pick(g, '黑桃4');
    // 力量爆破連擊值 9 本來在 2~4 範圍外會成功，但 [追] 效果使其失敗
    expect(g.state.flags.pursuitSuccess[0]).toBe(0);
    expect(names(g, 0, 'hand')).toContain('力量爆破');
  });
});

describe('回合流程', () => {
  it('回合結束會交換先後攻', () => {
    const g = scenario({ p0: { hand: ['黑桃5'] }, p1: { hand: [] } });
    skipToTurn(g, 2);
    expect(g.state.first).toBe(1);
  });
});

describe('裝備、角色', () => {
  it('增益階段：經驗不足不能打出裝備；滿足後可打出且同部位只能 1 張', () => {
    const lack = scenario({
      // 打出的黑桃5 歸還後多 1 張，仍低於瞄準器的經驗需求
      p0: { hand: ['黑桃5', '瞄準器'], exp: many('黑桃1', getCard('瞄準器').expReq - 2) },
      p1: { hand: [] },
    });
    let asked = false;
    for (let i = 0; i < 50 && lack.pending && lack.state.turn < 2; i++) {
      if (lack.pending.title.includes('增益階段')) asked = true;
      lack.submit(lack.pending.player, lack.pending.options.slice(0, lack.pending.min).map((o) => o.key));
    }
    expect(asked).toBe(false);

    const ok = scenario({
      p0: { hand: ['黑桃5', '瞄準器'], exp: many('黑桃1', getCard('瞄準器').expReq) },
      p1: { hand: [] },
    });
    for (let i = 0; i < 20 && ok.pending && !ok.pending.title.includes('增益階段'); i++) {
      ok.submit(ok.pending.player, ok.pending.options.slice(0, ok.pending.min).map((o) => o.key));
    }
    pick(ok, '瞄準器');
    expect(names(ok, 0, 'gear')).toEqual(['瞄準器']);
  });

  it('法師：起始手牌 7 張（一般角色 5 張）', () => {
    const g = scenario({ chars: ['法師', '勇者'] });
    expect(Z(g, 0, 'hand')).toHaveLength(7);
    expect(Z(g, 1, 'hand')).toHaveLength(5);
  });
});
