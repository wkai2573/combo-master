import { describe, expect, it } from 'vitest';
import { getCard } from '../src/data/cards';
import { ENABLED_EFFECT_CARDS } from '../src/data/enabledCards';
import { Z } from '../src/engine/ops';
import { pick, scenario } from './helpers';

// 布甲（id 皮甲）、木棍：共用裝備，[蓋1] 當我方收招時，總防禦或總攻擊 +1（這回合）
describe('共用裝備：布甲與木棍', () => {
  it('卡表資料：布甲是共用防具、木棍是共用武器，都已開放', () => {
    expect(getCard('皮甲')).toMatchObject({ name: '布甲', cls: '共用', kind: 'equip', slot: '防具' });
    expect(getCard('木棍')).toMatchObject({ name: '木棍', cls: '共用', kind: 'equip', slot: '武器' });
    expect(ENABLED_EFFECT_CARDS).toEqual(expect.arrayContaining(['皮甲', '木棍']));
  });

  /** 玩家 0 裝備 gear，先手出黑桃1、玩家 1 出黑桃9，玩家 0 收招時決定要不要發動；回傳雙方這回合承受的傷害 */
  const run = (gear: string, use: boolean) => {
    const g = scenario({
      phase: '先手',
      singlePhase: true,
      p0: { hand: ['黑桃1', '黑桃2'], gear: [gear], exp: ['黑桃3', '黑桃4'] },
      p1: { hand: ['黑桃9'] },
    });
    pick(g, '黑桃1');
    pick(g, '黑桃9');
    pick(g, '收招');
    expect(g.pending!.title).toContain(gear === '皮甲' ? '布甲' : '木棍');
    pick(g, use ? '發動' : '不發動');
    return g;
  };

  it('布甲：發動付蓋1，這回合我方總防禦 +1，少受 1 點傷害；不發動沒有變化', () => {
    const yes = run('皮甲', true);
    const no = run('皮甲', false);
    expect(Z(yes, 0, 'exp')[0].covered).toBe(true);
    expect(Z(no, 0, 'exp')[0].covered).toBe(false);
    expect(yes.state.flags.damageTaken[0]).toBe(no.state.flags.damageTaken[0] - 1);
    expect(yes.state.flags.damageTaken[1]).toBe(no.state.flags.damageTaken[1]);
    expect(yes.state.log.join('\n')).toContain('此回合總防禦 +1');
  });

  it('木棍：發動付蓋1，這回合我方總攻擊 +1，對方多受 1 點傷害', () => {
    const yes = run('木棍', true);
    const no = run('木棍', false);
    expect(yes.state.flags.damageTaken[1]).toBe(no.state.flags.damageTaken[1] + 1);
    expect(yes.state.flags.damageTaken[0]).toBe(no.state.flags.damageTaken[0]);
    expect(yes.state.log.join('\n')).toContain('此回合總攻擊 +1');
  });

  it('表側經驗不足 1 張，付不起蓋1：不詢問', () => {
    const g = scenario({
      phase: '先手',
      singlePhase: true,
      p0: { hand: ['黑桃1', '黑桃2'], gear: ['木棍'], exp: ['~黑桃3'] },
      p1: { hand: ['黑桃9'] },
    });
    pick(g, '黑桃1');
    pick(g, '黑桃9');
    pick(g, '收招');
    expect(g.pending?.title ?? '').not.toContain('木棍');
  });
});
