import { describe, expect, it } from 'vitest';
import { totalAtk, totalDef } from '../src/engine/combat';
import { becomePursuitCard } from '../src/engine/judge';
import { newCard, Z } from '../src/engine/ops';
import { defOf, drive, names, scenario, setZones } from './helpers';

/** 玩家 0 的一次追擊成功：翻開的牌成為追擊卡 */
function pursuitSuccess(g: ReturnType<typeof scenario>, id = '黑桃3') {
  const card = newCard(g, id, 0, 'hand');
  drive(becomePursuitCard(g, 0, card));
}

describe('刺客：追擊成功時，將 Ex-流血加入對方經驗區', () => {
  it('每次追擊成功加 1 張，放在對方經驗區最後方，表側；自己的經驗區不變', () => {
    const g = scenario({ chars: ['刺客', '勇者'], p0: { exp: ['黑桃1'] }, p1: { exp: ['黑桃2'] } });
    pursuitSuccess(g);
    expect(names(g, 1, 'exp')).toEqual(['黑桃2', 'Ex-流血']);
    expect(Z(g, 1, 'exp')[1].covered).toBe(false);
    expect(names(g, 0, 'exp')).toEqual(['黑桃1']);
    expect(g.state.log.join('\n')).toContain('【刺客】追擊成功，[Ex-流血]加入玩家B');
  });

  it('沒有次數上限：每次追擊成功都加', () => {
    const g = scenario({ chars: ['刺客', '勇者'], p0: { exp: ['黑桃1'] }, p1: { exp: [] } });
    for (let i = 0; i < 7; i++) pursuitSuccess(g);
    expect(names(g, 1, 'exp')).toEqual(Array(7).fill('Ex-流血'));
  });

  it('流血讓對方總防禦 −1，多張疊加', () => {
    const g = scenario({ chars: ['刺客', '勇者'], p1: { moves: ['梅花1'] } });
    const base = totalDef(g, 1);
    expect(base).toBe(defOf('梅花1'));
    pursuitSuccess(g);
    pursuitSuccess(g);
    expect(totalDef(g, 1)).toBe(base - 2);
  });

  it('覺醒後（追加）同一次追擊成功再加 1 張 Ex-中毒', () => {
    const g = scenario({ chars: ['刺客', '勇者'], p0: { exp: Array(8).fill('黑桃1') }, p1: { exp: [] } });
    pursuitSuccess(g);
    expect(names(g, 1, 'exp')).toEqual(['Ex-流血', 'Ex-中毒']);
    expect(g.state.log.join('\n')).toContain('[Ex-流血]與[Ex-中毒]');
  });

  it('不是刺客就沒有這個效果', () => {
    const g = scenario({ chars: ['勇者', '刺客'], p1: { exp: [] } });
    pursuitSuccess(g);
    expect(names(g, 1, 'exp')).toEqual([]);
  });

  it('舊效果（追擊成功次數加總攻擊，上限 +5）已移除：追擊成功的次數不再影響總攻擊', () => {
    const g = scenario({ chars: ['刺客', '勇者'] });
    setZones(g, 0, { moves: ['黑桃1'] });
    const base = totalAtk(g, 0);
    g.state.flags.pursuitSuccess[0] = 4;
    expect(totalAtk(g, 0)).toBe(base);
  });

  it('和卡自己的 [追] 效果進同一個追擊成功時窗口：兩個強制效果由玩家決定先後', () => {
    const g = scenario({ chars: ['刺客', '勇者'], p0: { moves: ['黑桃4'] } });
    const card = newCard(g, '二連矢', 0, 'hand');
    const r = becomePursuitCard(g, 0, card).next([]);
    expect(r.done).toBe(false);
    const req = r.value as { title: string; options: Array<{ label: string }> };
    expect(req.title).toContain('追擊成功時');
    expect(req.options.map((o) => o.label).join()).toContain('刺客');
    expect(req.options.map((o) => o.label).join()).toContain('二連矢');
  });
});
