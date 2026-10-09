import { describe, expect, it } from 'vitest';
import { getCard } from '../src/data/cards';
import { ENABLED_EFFECT_CARDS } from '../src/data/enabledCards';
import { KEYWORDS } from '../src/data/keywords';
import { ELEMENT_TRAITS } from '../src/engine/sources/mage';
import { Z } from '../src/engine/ops';
import { names, pick, scenario } from './helpers';

// 元素法典（id 星界法典）：[蓋3] 當我方收招時，且我方戰鬥區有【元素】特徵時，
// 從表側經驗選擇 1 張有相同【元素】特徵的卡加入手牌
describe('元素法典', () => {
  it('卡表資料與關鍵字：法師飾品，已開放；【元素】是火、冰、電的統稱，毒不算', () => {
    expect(getCard('星界法典')).toMatchObject({ name: '元素法典', cls: '法師', kind: 'equip', slot: '飾品', expReq: 8 });
    expect(ENABLED_EFFECT_CARDS).toContain('星界法典');
    expect(ELEMENT_TRAITS).toEqual(['火', '冰', '電']);
    const kw = KEYWORDS.find((k) => k.name === '元素')!;
    expect(kw.group).toBe('名詞');
    for (const t of ELEMENT_TRAITS) expect(kw.desc).toContain(t);
    expect(kw.desc).toContain('毒不算');
  });

  /** 玩家 0 裝備元素法典，戰鬥區預先有 moves，再先手出黑桃1；收招時進窗口 */
  const pass = (moves: string[], exp: string[]) => {
    const g = scenario({
      chars: ['法師', '勇者'],
      phase: '先手',
      singlePhase: true,
      p0: { hand: ['黑桃1', '黑桃2'], gear: ['星界法典'], exp, moves },
      p1: { hand: ['黑桃9'] },
    });
    pick(g, '黑桃1');
    pick(g, '黑桃9');
    pick(g, '收招');
    return g;
  };
  const askTitle = (g: ReturnType<typeof pass>) => g.pending?.title ?? '';

  it('戰鬥區有「冰」：從付完蓋3 之後仍是表側的經驗選 1 張有「冰」的卡加入手牌', () => {
    const g = pass(['冰霜護甲'], ['黑桃3', '黑桃4', '黑桃5', '冰霜護甲', '火球']);
    expect(askTitle(g)).toContain('元素法典');
    pick(g, '發動');
    expect(Z(g, 0, 'exp').slice(0, 3).map((c) => c.covered)).toEqual([true, true, true]);
    // 符合的只有冰霜護甲（火球是火，戰鬥區沒有火），只有一個選項時直接拿
    expect(names(g, 0, 'hand')).toContain('冰霜護甲');
    // 經驗區原本那張冰霜護甲拿走了，剩下的是歸還回來的（戰鬥區那張）
    expect(names(g, 0, 'exp').filter((n) => n === '冰霜護甲')).toHaveLength(1);
    expect(names(g, 0, 'exp')).toContain('火球');
  });

  it('戰鬥區同時有「冰」「火」：可選的是兩種元素的卡，但只能拿 1 張', () => {
    const g = pass(['冰霜護甲', '火球'], ['黑桃3', '黑桃4', '黑桃5', '冰霜護甲', '火球', '電弧']);
    pick(g, '發動');
    expect(g.pending!.options.map((o) => o.label).sort()).toEqual(['冰霜護甲', '火球'].sort()); // 電弧是電，戰鬥區沒有電
    expect(g.pending!.min).toBe(1);
    expect(g.pending!.max).toBe(1);
    pick(g, '火球');
    expect(names(g, 0, 'hand')).toContain('火球');
    expect(names(g, 0, 'exp')).toContain('冰霜護甲');
  });

  it('蓋3 先付：最前面的 3 張表側經驗被蓋成裏側，就算是符合的卡也不能選；沒有符合的卡就不能發動', () => {
    const g = pass(['冰霜護甲'], ['冰霜護甲', '黑桃4', '黑桃5', '黑桃6']);
    expect(askTitle(g)).not.toContain('元素法典');
    expect(Z(g, 0, 'exp').every((c) => !c.covered)).toBe(true);
  });

  it('戰鬥區沒有【元素】特徵（毒不算）就不能發動', () => {
    const g = pass(['塗毒'], ['黑桃3', '黑桃4', '黑桃5', '冰霜護甲', '電弧']);
    expect(askTitle(g)).not.toContain('元素法典');
  });

  it('付不起蓋3（表側經驗不足 3 張）不能發動；選擇不發動就什麼都不變', () => {
    const few = pass(['冰霜護甲'], ['冰霜護甲', '黑桃4']);
    expect(askTitle(few)).not.toContain('元素法典');

    const decline = pass(['冰霜護甲'], ['黑桃3', '黑桃4', '黑桃5', '冰霜護甲']);
    expect(askTitle(decline)).toContain('元素法典');
    pick(decline, '不發動');
    expect(Z(decline, 0, 'exp').filter((c) => c.covered)).toHaveLength(0);
    expect(names(decline, 0, 'hand')).not.toContain('冰霜護甲');
  });
});
