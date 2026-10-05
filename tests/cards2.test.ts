import { describe, expect, it } from 'vitest';
import { aimLimit, pursuitCount, returnStep, totalAtk, totalDef } from '../src/engine/combat';
import type { Game } from '../src/engine/game';
import { discard, optionalPay, Z, type Gen } from '../src/engine/ops';
import { merchantAfterBurst, onPassEffects, resolveCovered, scripts, turnStartEffects } from '../src/engine/scripts';
import { atkOf, defOf, names, pick, scenario, setZones } from './helpers';

const filler = Array(20).fill('黑桃2') as string[];

/** 依序餵答案給 generator，回傳最後一次結果 */
function drive(it: Gen<unknown>, answers: string[][]) {
  let r = it.next();
  for (const a of answers) {
    if (r.done) break;
    r = it.next(a);
  }
  return r;
}
const keyOf = (g: Game, p: 0 | 1, zone: Parameters<typeof Z>[2], id: string, nth = 0) =>
  `c${Z(g, p, zone).filter((c) => c.id === id)[nth].uid}`;

describe('爆發階段：抽 2', () => {
  it('把 1 張手牌放入經驗區後抽 2；招財貓再多抽 1', () => {
    const base = (gear: string[]) =>
      scenario({ p0: { hand: ['黑桃5'], gear }, p1: { hand: [] } });
    const g = base([]);
    expect(g.pending!.title).toContain('爆發');
    const hand = Z(g, 0, 'hand');
    expect(hand).toHaveLength(1); // 抽牌階段抽到的 1 張
    pick(g, hand[0] ? names(g, 0, 'hand')[0] : '');
    expect(Z(g, 0, 'hand')).toHaveLength(2);

    const cat = base(['招財貓']);
    pick(cat, names(cat, 0, 'hand')[0]);
    expect(Z(cat, 0, 'hand')).toHaveLength(3);
  });
});

describe('商人', () => {
  it('爆發後可調整未覆蓋經驗卡的順序', () => {
    const g = scenario({ chars: ['商人', '勇者'], p0: { exp: ['黑桃1', '黑桃2', '黑桃3'] } });
    const r = drive(merchantAfterBurst(g, 0), [['yes'], [keyOf(g, 0, 'exp', '黑桃3')], [keyOf(g, 0, 'exp', '黑桃2')]]);
    expect(r.done).toBe(true);
    expect(names(g, 0, 'exp')).toEqual(['黑桃3', '黑桃2', '黑桃1']);
  });

  it('覆蓋中的經驗卡不動，只重排未覆蓋的', () => {
    const g = scenario({ chars: ['商人', '勇者'], p0: { exp: ['黑桃1', '~黑桃2', '黑桃3'] } });
    drive(merchantAfterBurst(g, 0), [['yes'], [keyOf(g, 0, 'exp', '黑桃3')]]);
    expect(names(g, 0, 'exp')).toEqual(['黑桃3', '黑桃2', '黑桃1']);
    expect(Z(g, 0, 'exp')[1].covered).toBe(true);
  });

  it('覺醒後可以再把 1 張未覆蓋的經驗卡加入手牌；不是商人就沒有', () => {
    const exp = Array(8).fill('黑桃1') as string[];
    const g = scenario({ chars: ['商人', '勇者'], p0: { hand: [], exp: [...exp.slice(0, 7), '黑桃4'] } });
    const r = drive(merchantAfterBurst(g, 0), [['no'], ['yes'], [keyOf(g, 0, 'exp', '黑桃4')]]);
    expect(r.done).toBe(true);
    expect(names(g, 0, 'hand')).toEqual(['黑桃4']);

    const other = scenario({ chars: ['勇者', '商人'], p0: { exp: ['黑桃1', '黑桃2'] } });
    expect(merchantAfterBurst(other, 0).next().done).toBe(true);
  });
});

describe('瞄準：次數與等級', () => {
  it('次數：遊俠 1（覺醒 +1），瞄準器 +1；其他角色沒有瞄準', () => {
    const a = scenario({ chars: ['遊俠', '勇者'], p0: { exp: [] } });
    expect(aimLimit(a, 0)).toBe(1);
    setZones(a, 0, { exp: Array(8).fill('黑桃1') });
    expect(aimLimit(a, 0)).toBe(2);
    setZones(a, 0, { gear: ['瞄準器'] });
    expect(aimLimit(a, 0)).toBe(2);
    const w = scenario({ chars: ['勇者', '刺客'] });
    expect(aimLimit(w, 0)).toBe(0);
    setZones(w, 0, { gear: ['瞄準器'] });
    expect(aimLimit(w, 0)).toBe(1);
  });

  it('狙擊印記：[起] 此回合瞄準升級 1', () => {
    const g = scenario({ chars: ['遊俠', '勇者'], p0: { hand: ['狙擊印記', '黑桃2'] }, p1: { hand: [] } });
    pick(g, '狙擊印記');
    expect(g.state.flags.aimUp[0]).toBe(1);
  });

  it('LV2：抽 1，再選手中 1 張卡放到牌組頂或底，然後判定牌組頂', () => {
    const g = scenario({
      chars: ['遊俠', '勇者'],
      p0: { hand: ['黑桃7'], deck: ['黑桃8', '黑桃1', ...filler] },
      p1: { hand: ['黑桃9'] },
    });
    g.state.flags.aimUp[0] = 1;
    pick(g, '黑桃9');
    expect(g.pending!.title).toContain('LV2');
    pick(g, '使用');
    pick(g, '牌組底'); // 抽到的黑桃8 是手中唯一一張，自動選它
    expect(g.state.flags.aimUsed[0]).toBe(1);
    expect(Z(g, 0, 'deck').at(-1)!.id).toBe('黑桃8');
    expect(g.state.flags.pursuitSuccess[0]).toBe(1); // 新的牌頂黑桃1 在範圍 7~9 外
  });
});

describe('新卡（第二批）', () => {
  it('力量爆破：[頂] 總攻擊 −3，[追] 追擊判定失敗', () => {
    const g = scenario();
    setZones(g, 0, { combat: ['力量爆破'] });
    expect(totalAtk(g, 0)).toBe(atkOf('力量爆破') - 3);
  });

  it('低價買進：[經] 被覆蓋時回復 3', () => {
    const g = scenario({
      chars: ['商人', '勇者'],
      p0: { hand: ['黑桃2', '黑桃5'], exp: ['低價買進', '黑桃3'], rage: Array(5).fill('黑桃1') },
    });
    const it = optionalPay(g, 0, Z(g, 0, 'hand')[0], { cover: 1 });
    expect(drive(it, [['yes']]).done).toBe(true);
    expect(Z(g, 0, 'exp')[0].covered).toBe(true);
    expect(Z(g, 0, 'rage')).toHaveLength(2);
  });

  it('高價賣出：[經] 被覆蓋時抽 2', () => {
    const g = scenario({ p0: { hand: ['黑桃2', '黑桃5'], exp: ['高價賣出', '黑桃3'] } });
    const before = Z(g, 0, 'hand').length;
    drive(optionalPay(g, 0, Z(g, 0, 'hand')[0], { cover: 1 }), [['yes']]);
    expect(Z(g, 0, 'hand')).toHaveLength(before + 2);
  });

  it('復仇之嚎：[經_怒3]', () => {
    const g = scenario({ p0: { exp: ['復仇之嚎'], rage: Array(8).fill('黑桃1') } });
    const card = Z(g, 0, 'exp')[0];
    drive(scripts['復仇之嚎'].afterDamageExp!(g, 0, card, { taken: 5, dealt: 2 }), [['yes']]);
    expect(Z(g, 0, 'rage')).toHaveLength(8 - 3 - 1);
  });

  it('順手牽羊：[起_蓋X] 抽 X，此回合總攻擊 −X（X ≤ 2）', () => {
    const g = scenario({
      chars: ['刺客', '勇者'],
      p0: { hand: ['順手牽羊', '黑桃2'], exp: ['黑桃3', '黑桃4', '黑桃5'] },
      p1: { hand: [] },
    });
    pick(g, '順手牽羊');
    expect(g.pending!.options.map((o) => o.label)).toEqual(['不發動', '蓋1', '蓋2']);
    pick(g, '蓋2');
    expect(g.state.flags.atkBonus[0]).toBe(-2);
    expect(Z(g, 0, 'exp').filter((c) => c.covered)).toHaveLength(2);
    expect(Z(g, 0, 'hand')).toHaveLength(4); // 打出後剩 1 張＋抽 2＋抽牌階段抽 1
  });

  it('交涉：[發_蓋X] 抽 X，再放 X 張手牌到牌組底', () => {
    const g = scenario({
      chars: ['商人', '勇者'],
      p0: { hand: ['交涉', '黑桃2', '黑桃3'], exp: ['黑桃4', '黑桃5'] },
      p1: { hand: [] },
    });
    pick(g, '交涉');
    pick(g, '蓋1');
    pick(g, '黑桃2');
    expect(Z(g, 0, 'deck').at(-1)!.id).toBe('黑桃2');
    expect(Z(g, 0, 'exp').filter((c) => c.covered)).toHaveLength(1);
    expect(Z(g, 0, 'hand')).toHaveLength(3); // 剩 2 張＋抽 1，放 1 張到牌組底，再加抽牌階段抽 1
  });

  it('冰霜護甲：[發_蓋2] 回復 X（X＝覆蓋的經驗數），再捨棄 2 張覆蓋的經驗', () => {
    const g = scenario({
      chars: ['法師', '勇者'],
      p0: { hand: ['冰霜護甲', '黑桃2'], exp: ['黑桃3', '黑桃4', '~黑桃5', '~黑桃6'], rage: Array(5).fill('黑桃1') },
      p1: { hand: [] },
    });
    pick(g, '冰霜護甲');
    pick(g, '發動');
    pick(g, '黑桃5', '黑桃6');
    expect(Z(g, 0, 'rage')).toHaveLength(1); // 回復 4
    expect(names(g, 0, 'discard')).toEqual(expect.arrayContaining(['黑桃5', '黑桃6']));
    expect(Z(g, 0, 'exp').filter((c) => c.covered)).toHaveLength(2);
  });

  it('盾擊：[頂] 總攻擊 +X，X＝戰鬥區防禦力 ≧ 4 的卡片張數', () => {
    const g = scenario();
    const ids = ['黑桃1', '梅花1', '盾擊'];
    setZones(g, 0, { combat: ids });
    const x = ids.filter((id) => defOf(id) >= 4).length;
    expect(x).toBeGreaterThanOrEqual(2);
    expect(totalAtk(g, 0)).toBe(ids.reduce((n, id) => n + atkOf(id), 0) + x);
    setZones(g, 0, { combat: ['盾擊', '黑桃1'] }); // 不在最上方就沒有
    expect(totalAtk(g, 0)).toBe(atkOf('盾擊') + atkOf('黑桃1'));
  });

  it('即時停損：[發_蓋2] 打出後雙方立即收招', () => {
    const g = scenario({
      chars: ['商人', '勇者'],
      p0: { hand: ['即時停損', '黑桃2'], exp: ['黑桃3', '黑桃4'] },
      p1: { hand: ['黑桃5', '黑桃9'] },
    });
    pick(g, '即時停損');
    pick(g, '發動');
    const log = g.state.log.join('\n');
    expect(log).toContain('雙方立即收招');
    expect(log).not.toContain('玩家B（勇者） 出招');
  });

  it('二連矢：[追] 追擊 +1（追擊中途多翻 1 張）', () => {
    const g = scenario({
      p0: { hand: ['黑桃7'], deck: ['二連矢', '黑桃1', ...filler] },
      p1: { hand: ['黑桃9'] },
    });
    pick(g, '黑桃9');
    expect(g.state.flags.pursuitSuccess[0]).toBe(2); // 二連矢（連擊值 3，範圍外）成功，再翻黑桃1 也成功
  });

  it('二刀連擊：戰鬥區只有此卡時追擊 +1', () => {
    const g = scenario();
    setZones(g, 0, { combat: ['二刀連擊'] });
    expect(pursuitCount(g, 0)).toBe(2);
  });

  it('凡骨的意志：回合開始時強制蓋 1，總攻擊與總防禦各加戰鬥區白板卡數量', () => {
    const g = scenario({ chars: ['商人', '刺客'], p0: { exp: ['凡骨的意志', '黑桃3'] } });
    expect(drive(turnStartEffects(g), []).done).toBe(true);
    expect(g.state.flags.vanillaBoost[0]).toBe(1);
    expect(Z(g, 0, 'exp').filter((c) => c.covered).map((c) => c.id)).toEqual(['黑桃3']);
    const ids = ['黑桃1', '黑桃2', '伏擊'];
    setZones(g, 0, { combat: ids, exp: [] });
    g.state.flags.vanillaBoost[0] = 1;
    expect(totalAtk(g, 0)).toBe(ids.reduce((n, id) => n + atkOf(id), 0) + 2); // 白板卡 2 張
    expect(totalDef(g, 0)).toBe(ids.reduce((n, id) => n + defOf(id), 0) + 2);
  });

  it('卸除鎧甲：[起_蓋2] 把對方 1 張裝備或增益送入棄牌區', () => {
    const g = scenario({
      chars: ['刺客', '勇者'],
      p0: { hand: ['卸除鎧甲', '黑桃2'], exp: ['黑桃3', '黑桃4', '黑桃5'] },
      p1: { hand: [], gear: ['月光劍'] },
    });
    pick(g, '卸除鎧甲');
    pick(g, '發動'); // 對方只有 1 張裝備，自動選它
    expect(names(g, 1, 'discard')).toContain('月光劍');
    expect(Z(g, 1, 'gear')).toHaveLength(0);
  });

  it('火球：[起_蓋3] 對方直擊 2', () => {
    const g = scenario({
      chars: ['法師', '勇者'],
      p0: { hand: ['火球', '黑桃2'], exp: ['黑桃3', '黑桃4', '黑桃5'] },
      p1: { hand: [] },
    });
    pick(g, '火球');
    pick(g, '發動');
    expect(Z(g, 1, 'discard')).toHaveLength(2);
  });

  it('塗毒：歸還時 [Ex卡-中毒] 移入出招卡較少的一方，相同時落入對方；離開經驗區就移除遊戲', () => {
    const g = scenario();
    g.state.flags.poisonQ = [0];
    g.state.flags.played = [1, 2];
    returnStep(g);
    expect(names(g, 0, 'exp')).toContain('Ex卡-中毒');

    const t = scenario();
    t.state.flags.poisonQ = [0];
    t.state.flags.played = [2, 2];
    returnStep(t);
    expect(names(t, 1, 'exp')).toContain('Ex卡-中毒');

    const poison = Z(t, 1, 'exp').find((c) => c.id === 'Ex卡-中毒')!;
    discard(t, poison);
    expect(Z(t, 1, 'discard').some((c) => c.id === 'Ex卡-中毒')).toBe(false);
    expect(Z(t, 1, 'exp').some((c) => c.id === 'Ex卡-中毒')).toBe(false);
  });

  it('中毒：我方後攻的回合開始時，直擊我方 3；先攻時不會', () => {
    const g = scenario({ p1: { exp: ['Ex卡-中毒'] } });
    const deck = Z(g, 1, 'deck').length;
    drive(turnStartEffects(g), []);
    expect(Z(g, 1, 'deck')).toHaveLength(deck - 3);

    const f = scenario({ first: 1, p1: { exp: ['Ex卡-中毒'] } });
    const d2 = Z(f, 1, 'deck').length;
    drive(turnStartEffects(f), []);
    expect(Z(f, 1, 'deck')).toHaveLength(d2);
  });

  it('家族相片：回合開始時 [蓋1_怒3] 回復 1', () => {
    const g = scenario({ p0: { gear: ['家族相片'], exp: ['黑桃3'], rage: Array(4).fill('黑桃1') } });
    const deck = Z(g, 0, 'deck').length;
    drive(turnStartEffects(g), [['yes']]);
    expect(Z(g, 0, 'rage')).toHaveLength(0); // 怒 3 再回復 1
    expect(Z(g, 0, 'deck')).toHaveLength(deck + 1);
    expect(Z(g, 0, 'exp')[0].covered).toBe(true);
  });

  it('冰與雷之曲：收招時戰鬥區有「冰」「雷」特徵的卡各 1 張，才可蓋 3 抽 1、回復 1', () => {
    const g = scenario({ p0: { gear: ['冰與雷之曲'], exp: ['黑桃1', '黑桃2', '黑桃3'], combat: ['冰霜護甲', '電弧'], rage: ['黑桃4'] } });
    const hand = Z(g, 0, 'hand').length;
    drive(onPassEffects(g, 0), [['yes']]);
    expect(Z(g, 0, 'hand')).toHaveLength(hand + 1);
    expect(Z(g, 0, 'rage')).toHaveLength(0);

    const only = scenario({ p0: { gear: ['冰與雷之曲'], exp: ['黑桃1', '黑桃2', '黑桃3'], combat: ['冰霜護甲'] } });
    expect(onPassEffects(only, 0).next().done).toBe(true); // 條件不足：不會詢問
  });

  it('幸運兔腳：[蓋2] 追擊判定失敗時額外翻 1 張', () => {
    const g = scenario({
      p0: { hand: ['黑桃1'] },
      p1: { hand: ['黑桃9'], gear: ['幸運兔腳'], exp: ['黑桃2', '黑桃3'], deck: ['黑桃5', '月光劍', ...filler] },
    });
    pick(g, '黑桃9');
    pick(g, '發動');
    expect(g.state.flags.pursuitSuccess[1]).toBe(1);
  });

  it('resolveCovered 沒有排隊的卡時不做事', () => {
    const g = scenario();
    expect(resolveCovered(g).next().done).toBe(true);
  });
});
