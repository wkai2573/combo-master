import { describe, expect, it } from 'vitest';
import { aimLimit, pursuitCount, returnStep, totalAtk, totalDef } from '../src/engine/combat';
import { discard, optionalPay, pay, Z } from '../src/engine/ops';
import { scripts } from '../src/engine/scripts';
import { getCard } from '../src/data/cards';
import { atkOf, defOf, names, pick, scenario, setZones } from './helpers';

const filler = Array(20).fill('黑桃2') as string[];

describe('爆發階段：抽 2', () => {
  it('把 1 張手牌放入經驗區後抽 2；招財貓可以蓋 2 再多抽 1', () => {
    const base = (gear: string[]) =>
      scenario({ p0: { hand: ['黑桃5'], gear, exp: ['黑桃1', '黑桃2'] }, p1: { hand: [] } });
    const g = base([]);
    expect(g.pending!.title).toContain('爆發');
    const hand = Z(g, 0, 'hand');
    expect(hand).toHaveLength(1); // 抽牌階段抽到的 1 張
    pick(g, hand[0] ? names(g, 0, 'hand')[0] : '');
    expect(Z(g, 0, 'hand')).toHaveLength(2);

    const cat = base(['招財貓']);
    pick(cat, names(cat, 0, 'hand')[0]);
    expect(cat.pending!.title).toContain('招財貓'); // [蓋2]：是否發動
    pick(cat, '發動');
    expect(Z(cat, 0, 'hand')).toHaveLength(3);
    expect(Z(cat, 0, 'exp').filter((c) => c.covered)).toHaveLength(2);

    const skip = base(['招財貓']);
    pick(skip, names(skip, 0, 'hand')[0]);
    pick(skip, '不發動'); // 不發動就不蓋、不多抽
    expect(Z(skip, 0, 'hand')).toHaveLength(2);
    expect(Z(skip, 0, 'exp').filter((c) => c.covered)).toHaveLength(0);
  });
});

describe('商人', () => {
  it('爆發後可調整表側經驗的順序', () => {
    const g = scenario({
      chars: ['商人', '勇者'],
      phase: '爆發',
      singlePhase: true,
      p0: { hand: ['黑桃3'], exp: ['黑桃1', '黑桃2'] },
      p1: { hand: [] },
    });
    pick(g, '黑桃3');
    pick(g, '發動');
    pick(g, '黑桃3');
    pick(g, '黑桃2');
    expect(names(g, 0, 'exp')).toEqual(['黑桃3', '黑桃2', '黑桃1']);
  });

  it('裏側的經驗卡不動，只重排表側的', () => {
    const g = scenario({
      chars: ['商人', '勇者'],
      phase: '爆發',
      singlePhase: true,
      p0: { hand: ['黑桃3'], exp: ['黑桃1', '~黑桃2'] },
      p1: { hand: [] },
    });
    pick(g, '黑桃3');
    pick(g, '發動');
    pick(g, '黑桃3');
    expect(names(g, 0, 'exp')).toEqual(['黑桃3', '黑桃2', '黑桃1']);
    expect(Z(g, 0, 'exp')[1].covered).toBe(true);
  });

  it('覺醒後可以再把 1 張表側經驗加入手牌；不是商人就沒有', () => {
    const exp = Array(8).fill('黑桃1') as string[];
    const g = scenario({
      chars: ['商人', '勇者'],
      phase: '爆發',
      singlePhase: true,
      p0: { hand: ['黑桃5'], exp: [...exp.slice(0, 7), '黑桃4'] },
      p1: { hand: [] },
    });
    pick(g, '黑桃5');
    // 調整順序與加入手牌兩個效果同時可發動：進爆發窗口，自己選要發哪個（詳見 window.test.ts）
    pick(g, '【商人】覺醒：將 1 張表側經驗加入手牌');
    pick(g, '黑桃4');
    expect(names(g, 0, 'hand')).toContain('黑桃4');

    const other = scenario({
      chars: ['勇者', '商人'],
      phase: '爆發',
      singlePhase: true,
      p0: { hand: ['黑桃5'], exp: ['黑桃1', '黑桃2'] },
      p1: { hand: [] },
    });
    pick(other, '黑桃5');
    expect(other.pending).toBeNull();
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

  it('狙擊印記：[先] 此回合瞄準升級 1', () => {
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

  it('低價買進：[經] 被蓋成裏側時回復 3', () => {
    const g = scenario({
      chars: ['商人', '勇者'],
      p0: { exp: ['低價買進', '黑桃3'], rage: Array(5).fill('黑桃1') },
    });
    pay(g, 0, { cover: 1 }).next();
    expect(Z(g, 0, 'exp')[0].covered).toBe(true);
    expect(Z(g, 0, 'rage')).toHaveLength(2);
  });

  it('高價賣出：[經] 被蓋成裏側時抽 1', () => {
    const g = scenario({ p0: { exp: ['高價賣出', '黑桃3'] } });
    const before = Z(g, 0, 'hand').length;
    pay(g, 0, { cover: 1 }).next();
    expect(Z(g, 0, 'hand')).toHaveLength(before + 1);
  });

  it('復仇之嚎：[經_怒3]', () => {
    const g = scenario({ p0: { exp: ['復仇之嚎'], rage: Array(8).fill('黑桃1') } });
    const card = Z(g, 0, 'exp')[0];
    const it = scripts['復仇之嚎'].afterDamageExp!(g, 0, card, { taken: 5, dealt: 2 });
    it.next();
    it.next(['yes']);
    expect(Z(g, 0, 'rage')).toHaveLength(8 - 3 - 1);
  });

  it('順手牽羊：[發_蓋X] 抽 X，此回合總防禦 −X（X ≤ 2），不影響總攻擊', () => {
    const g = scenario({
      chars: ['刺客', '勇者'],
      p0: { hand: ['順手牽羊', '黑桃2'], exp: ['黑桃3', '黑桃4', '黑桃5'] },
      p1: { hand: [] },
    });
    pick(g, '順手牽羊');
    expect(g.pending!.options.map((o) => o.label)).toEqual(['不發動', '蓋1', '蓋2']);
    pick(g, '蓋2');
    expect(g.state.flags.defBonus[0]).toBe(-2);
    expect(g.state.flags.atkBonus[0]).toBe(0);
    expect(Z(g, 0, 'exp').filter((c) => c.covered)).toHaveLength(2);
    expect(Z(g, 0, 'hand')).toHaveLength(4); // 打出後剩 1 張＋抽 2＋抽牌階段抽 1
  });

  it('順手牽羊：[發] 在反擊步驟打出也能發動；總防禦最低為 0', () => {
    const g = scenario({
      chars: ['勇者', '刺客'],
      p0: { hand: ['黑桃5', '黑桃4'] },
      p1: { hand: ['順手牽羊', '黑桃6'], exp: ['黑桃3', '黑桃4'], deck: ['黑桃7', ...filler] },
    });
    pick(g, '黑桃5');
    pick(g, '順手牽羊');
    pick(g, '蓋1');
    expect(g.state.flags.defBonus[1]).toBe(-1);
    expect(totalDef(g, 1)).toBe(defOf('順手牽羊') - 1);
    g.state.flags.defBonus[1] = -99;
    expect(totalDef(g, 1)).toBe(0);
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

  it('冰霜護甲：[發_蓋2] 回復 X（X＝裏側經驗數），再捨棄 3 張裏側經驗', () => {
    const g = scenario({
      chars: ['法師', '勇者'],
      p0: { hand: ['冰霜護甲', '黑桃2'], exp: ['黑桃3', '黑桃4', '~黑桃5', '~黑桃6'], rage: Array(5).fill('黑桃1') },
      p1: { hand: [] },
    });
    pick(g, '冰霜護甲');
    pick(g, '發動');
    // 蓋2 之後 4 張都是裏側；裏側卡對擁有者顯示牌面，直接看著牌面選出 3 張
    expect(g.pending!.options).toHaveLength(4);
    pick(g, '黑桃5', '黑桃6', '黑桃4');
    expect(Z(g, 0, 'rage')).toHaveLength(1); // 回復 4
    expect(names(g, 0, 'discard').sort()).toEqual(['黑桃4', '黑桃5', '黑桃6']);
    expect(Z(g, 0, 'exp').filter((c) => c.covered).map((c) => c.id)).toEqual(['黑桃3']);
  });

  it('冰霜護甲：裏側經驗不足 3 張就全捨棄，不詢問', () => {
    const g = scenario({
      chars: ['法師', '勇者'],
      p0: { hand: ['冰霜護甲', '黑桃2'], exp: ['黑桃3', '黑桃4'], rage: Array(5).fill('黑桃1') },
      p1: { hand: [] },
    });
    pick(g, '冰霜護甲');
    pick(g, '發動');
    expect(names(g, 0, 'discard').sort()).toEqual(['黑桃3', '黑桃4']);
    expect(names(g, 0, 'exp')).not.toContain('黑桃3'); // 兩張都被捨棄（之後歸還的冰霜護甲自己進了經驗區）
    expect(Z(g, 0, 'rage')).toHaveLength(3); // 回復 2
  });

  it('盾擊：[頂] 戰鬥區每張招式卡的原始攻擊力若小於原始防禦力，該卡的攻擊力改為原始防禦力', () => {
    const g = scenario({ chars: ['刺客', '勇者'] });
    const ids = ['梅花1', '黑桃9', '盾擊'];
    expect(atkOf('梅花1')).toBeLessThan(defOf('梅花1')); // 攻擊力小於防禦力：會被補到防禦力
    expect(atkOf('黑桃9')).toBeGreaterThan(defOf('黑桃9')); // 攻擊力較大：不變
    setZones(g, 0, { combat: ids });
    const lifted = ids.reduce((n, id) => n + Math.max(atkOf(id), defOf(id)), 0);
    expect(totalAtk(g, 0)).toBe(lifted);
    expect(lifted).toBeGreaterThan(ids.reduce((n, id) => n + atkOf(id), 0));
    // 防禦力不受影響
    expect(totalDef(g, 0)).toBe(ids.reduce((n, id) => n + defOf(id), 0));
  });

  it('盾擊：不在最上方就沒有效果；追擊卡不算；其餘加成在補攻擊力之後照算', () => {
    const g = scenario({ chars: ['刺客', '勇者'] });
    setZones(g, 0, { combat: ['盾擊', '梅花1'] });
    expect(totalAtk(g, 0)).toBe(atkOf('盾擊') + atkOf('梅花1'));
    setZones(g, 0, { combat: ['梅花1', '盾擊'], pursuit: ['梅花1'] });
    expect(totalAtk(g, 0)).toBe(defOf('梅花1') + atkOf('盾擊') + atkOf('梅花1')); // 追擊的梅花1 照原本的攻擊力
    g.state.flags.atkBonus[0] = 3;
    expect(totalAtk(g, 0)).toBe(defOf('梅花1') + atkOf('盾擊') + atkOf('梅花1') + 3);
  });

  it('即時停損：[發_蓋4] 先手步驟打出後雙方立即收招，沒有反擊步驟也不做追擊判定', () => {
    const g = scenario({
      chars: ['商人', '勇者'],
      p0: { hand: ['即時停損', '黑桃2'], exp: ['黑桃3', '黑桃4', '黑桃5', '黑桃6'] },
      p1: { hand: ['黑桃5', '黑桃9'] },
    });
    pick(g, '即時停損');
    pick(g, '發動');
    const log = g.state.log.join('\n');
    expect(log).toContain('雙方立即收招');
    expect(log).not.toContain('玩家B（勇者） 出招');
    expect(log).not.toContain('追擊判定');
    expect(log).toContain('傷害計算');
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

  it('凡骨的意志：回合開始時需蓋前 2 張表側經驗，總攻擊與總防禦各加戰鬥區白板卡數量', () => {
    // scenario 開局時已經跑過第一回合的回合開始效果
    const g = scenario({ chars: ['商人', '刺客'], p0: { exp: ['黑桃3', '黑桃4', '凡骨的意志'] } });
    expect(g.state.flags.vanillaBoost[0]).toBe(1);
    expect(Z(g, 0, 'exp').filter((c) => c.covered).map((c) => c.id)).toEqual(['黑桃3', '黑桃4']);
    const ids = ['黑桃1', '黑桃2', '伏擊'];
    setZones(g, 0, { combat: ids, exp: [] });
    g.state.flags.vanillaBoost[0] = 1;
    expect(totalAtk(g, 0)).toBe(ids.reduce((n, id) => n + atkOf(id), 0) + 2); // 白板卡 2 張
    expect(totalDef(g, 0)).toBe(ids.reduce((n, id) => n + defOf(id), 0) + 2);
  });

  it('凡骨的意志：蓋是照順序蓋，最前面就是自己時會蓋到自己；效果照常發動，之後被蓋住就無效', () => {
    const g = scenario({ chars: ['商人', '刺客'], p0: { exp: ['凡骨的意志', '黑桃3', '黑桃4'] } });
    expect(g.state.flags.vanillaBoost[0]).toBe(1);
    expect(Z(g, 0, 'exp').filter((c) => c.covered).map((c) => c.id)).toEqual(['凡骨的意志', '黑桃3']);
    expect(g.state.log.join('\n')).toContain('蓋到自己');
    // 下個回合：它已經被蓋住，不能再發動，也不會去蓋黑桃3
    const nextTurn = scenario({
      chars: ['商人', '刺客'],
      phase: '重置',
      singlePhase: true,
      p0: { exp: ['~凡骨的意志', '黑桃3'] },
    });
    expect(nextTurn.state.flags.vanillaBoost[0]).toBe(0);
    expect(Z(nextTurn, 0, 'exp')[1].covered).toBe(false);
  });

  it('凡骨的意志：表側經驗剛好 2 張，兩張都蓋（包含自己），仍會生效', () => {
    const g = scenario({ chars: ['商人', '刺客'], phase: '重置', singlePhase: true, p0: { exp: ['黑桃3', '~黑桃4', '凡骨的意志'] } });
    // 表側只有黑桃3 與它自己
    expect(g.state.flags.vanillaBoost[0]).toBe(1);
    expect(Z(g, 0, 'exp').map((c) => c.covered)).toEqual([true, true, true]);
  });

  it('凡骨的意志：它是唯一的表側經驗時，蓋 1 就是蓋自己，仍會生效', () => {
    const g = scenario({ chars: ['商人', '刺客'], phase: '重置', singlePhase: true, p0: { exp: ['凡骨的意志'] } });
    expect(g.state.flags.vanillaBoost[0]).toBe(1);
    expect(Z(g, 0, 'exp')[0].covered).toBe(true);
  });

  it('卸除鎧甲：[發_蓋2] 把對方 1 張裝備或增益送入棄牌區', () => {
    const g = scenario({
      chars: ['刺客', '勇者'],
      p0: { hand: ['卸除鎧甲', '黑桃2'], exp: ['黑桃3', '黑桃4', '黑桃5'] },
      p1: { hand: [], gear: ['瞄準器'] },
    });
    pick(g, '卸除鎧甲');
    pick(g, '發動'); // 對方只有 1 張裝備，自動選它
    expect(names(g, 1, 'discard')).toContain('瞄準器');
    expect(Z(g, 1, 'gear')).toHaveLength(0);
  });

  it('卸除鎧甲：[發] 在反擊步驟打出也能發動；對方沒有裝備與增益時不詢問', () => {
    const g = scenario({
      chars: ['勇者', '刺客'],
      p0: { hand: ['黑桃5'], gear: ['瞄準器'] },
      p1: { hand: ['卸除鎧甲', '黑桃6'], exp: ['黑桃3', '黑桃4', '黑桃7'] },
    });
    pick(g, '卸除鎧甲');
    pick(g, '發動');
    expect(names(g, 0, 'discard')).toContain('瞄準器');

    const none = scenario({
      chars: ['勇者', '刺客'],
      p0: { hand: ['黑桃5'] },
      p1: { hand: ['卸除鎧甲', '黑桃6'], exp: ['黑桃3', '黑桃4', '黑桃7'] },
    });
    pick(none, '卸除鎧甲');
    expect(none.pending?.title ?? '').not.toContain('卸除鎧甲');
    expect(Z(none, 1, 'exp').filter((c) => c.covered)).toHaveLength(0);
  });

  it('火球：[先_蓋3] 對方直擊 2', () => {
    const g = scenario({
      chars: ['法師', '勇者'],
      p0: { hand: ['火球', '黑桃2'], exp: ['黑桃3', '黑桃4', '黑桃5'] },
      p1: { hand: [] },
    });
    pick(g, '火球');
    pick(g, '發動');
    expect(Z(g, 1, 'discard')).toHaveLength(2);
  });

  it('Explosion!：[先_蓋8] 對方直擊 5，我方收招（對方仍可反擊），並跳過我方這回合的抽牌階段', () => {
    const g = scenario({
      chars: ['法師', '勇者'],
      p0: { hand: ['Explosion!', '黑桃2'], exp: Array(8).fill('黑桃3') },
      p1: { hand: ['黑桃5'] },
    });
    pick(g, 'Explosion!');
    pick(g, '發動');
    expect(Z(g, 1, 'discard')).toHaveLength(5);
    expect(Z(g, 0, 'exp').filter((c) => c.covered)).toHaveLength(8);
    expect(g.state.passed).toEqual([true, false]);
    // 對方還能反擊：輪到玩家1 選擇出招或收招
    expect(g.pending!.player).toBe(1);
    expect(g.pending!.options.map((o) => o.label)).toContain('黑桃5');
    pick(g, '黑桃5'); // 玩家1 手上沒牌了自動收招 → 雙方都已收招，進入追擊、傷害，然後是抽牌階段
    expect(g.state.log.join('\n')).toContain('玩家A（法師） 跳過抽牌階段');
    expect(g.state.phase).toBe('爆發');
    expect(Z(g, 0, 'hand').map((c) => c.id)).toEqual(['黑桃2']); // 沒有抽牌
    expect(Z(g, 1, 'hand')).toHaveLength(1); // 玩家1 照常抽 1
  });

  it('Explosion!：正面經驗不足 8 張不能發動；選擇不發動就沒有任何效果', () => {
    const few = scenario({
      chars: ['法師', '勇者'],
      p0: { hand: ['Explosion!', '黑桃2'], exp: Array(7).fill('黑桃3') },
      p1: { hand: ['黑桃5'] },
    });
    pick(few, 'Explosion!');
    expect(few.pending!.title).not.toContain('Explosion!'); // 付不起，不詢問
    expect(few.state.passed).toEqual([false, false]);
    expect(Z(few, 1, 'discard')).toHaveLength(0);

    const no = scenario({
      chars: ['法師', '勇者'],
      p0: { hand: ['Explosion!', '黑桃2'], exp: Array(8).fill('黑桃3') },
      p1: { hand: ['黑桃5'] },
    });
    pick(no, 'Explosion!');
    pick(no, '不發動');
    expect(no.state.flags.skipDraw).toEqual([false, false]);
    expect(Z(no, 0, 'exp').filter((c) => c.covered)).toHaveLength(0);
    expect(Z(no, 1, 'discard')).toHaveLength(0);
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
    const g = scenario({ phase: '重置', singlePhase: true, p1: { exp: ['Ex卡-中毒'] } });
    expect(Z(g, 1, 'deck')).toHaveLength(17);

    const f = scenario({ first: 1, phase: '重置', singlePhase: true, p1: { exp: ['Ex卡-中毒'] } });
    expect(Z(f, 1, 'deck')).toHaveLength(20);
  });

  it('家族相片：回合開始時 [蓋1_怒3] 回復 1', () => {
    const g = scenario({
      phase: '重置',
      singlePhase: true,
      p0: { gear: ['家族相片'], exp: ['黑桃3'], rage: Array(4).fill('黑桃1') },
    });
    const deck = Z(g, 0, 'deck').length;
    pick(g, '發動');
    expect(Z(g, 0, 'rage')).toHaveLength(0); // 怒 3 再回復 1
    expect(Z(g, 0, 'deck')).toHaveLength(deck + 1);
    expect(Z(g, 0, 'exp')[0].covered).toBe(true);
  });

  it('冰與雷之曲：收招時戰鬥區有「冰」「雷」特徵的卡各 1 張，才可蓋 3 抽 1、回復 1', () => {
    const g = scenario({
      phase: '先手',
      singlePhase: true,
      p0: { hand: ['黑桃1', '黑桃2'], gear: ['冰與雷之曲'], exp: ['黑桃1', '黑桃2', '黑桃3'], combat: ['冰霜護甲', '電弧'], rage: ['黑桃4'] },
      p1: { hand: ['黑桃9'] },
    });
    pick(g, '黑桃1');
    pick(g, '黑桃9');
    pick(g, '收招');
    pick(g, '發動');
    // 手牌變化：打出黑桃1 (-1)、冰與雷之曲抽 1 (+1)、追擊判定落入範圍回到手中 (+1)
    expect(Z(g, 0, 'hand')).toHaveLength(3);
    expect(Z(g, 0, 'exp').filter((c) => c.covered)).toHaveLength(3);
    expect(Z(g, 0, 'rage')).toHaveLength(0);

    const only = scenario({
      phase: '先手',
      singlePhase: true,
      p0: { hand: ['黑桃1', '黑桃2'], gear: ['冰與雷之曲'], exp: ['黑桃1', '黑桃2', '黑桃3'], combat: ['冰霜護甲'] },
      p1: { hand: ['黑桃9'] },
    });
    pick(only, '黑桃1');
    pick(only, '黑桃9');
    pick(only, '收招');
    expect(only.state.passed[0]).toBe(true);
    expect(Z(only, 0, 'exp').filter((c) => c.covered)).toHaveLength(0);
  });

  it('幸運兔腳：[蓋2] 追擊判定失敗時額外翻 1 張', () => {
    const g = scenario({
      p0: { hand: ['黑桃4'] },
      p1: { hand: ['黑桃6'], gear: ['幸運兔腳'], exp: ['黑桃2', '黑桃3'], deck: ['黑桃5', '黑桃1', ...filler] },
    });
    pick(g, '黑桃6');
    pick(g, '發動');
    expect(g.state.flags.pursuitSuccess[1]).toBe(1);
    expect(names(g, 1, 'hand')).toContain('黑桃5'); // 判定失敗的黑桃5加入手牌
  });

  it('追擊判定：翻開非招式卡（裝備、增益）判定失敗，加入手中', () => {
    const g = scenario({
      p0: { hand: ['黑桃4'] },
      p1: { hand: ['黑桃6'], deck: ['瞄準器', ...filler] },
    });
    pick(g, '黑桃6');
    // 瞄準器連擊值雖為 0（在[4, 6]之外），但因非招式卡，判定失敗
    expect(g.state.flags.pursuitSuccess[1]).toBe(0);
    expect(names(g, 1, 'hand')).toContain('瞄準器');
    expect(g.state.log.join('\n')).toContain('（非招式卡）');
  });

  it('pay 蓋到低價買進與高價賣出時，自動觸發蓋反應', () => {
    const g = scenario({ p0: { exp: ['低價買進', '高價賣出'], rage: Array(5).fill('黑桃1'), deck: ['黑桃4', ...filler] } });
    pay(g, 0, { cover: 2 }).next();
    expect(Z(g, 0, 'rage')).toHaveLength(2); // 低價買進：回復 3
    expect(Z(g, 0, 'hand')).toHaveLength(1); // 高價賣出：抽 1
  });
});

describe('卡表同步的新卡：高利貸、狙擊蓄力、熔岩之擊', () => {
  // 只跑戰鬥階段：先攻方手牌只有 1 張招式時自動先手出招，後攻方沒有可出的招式就直接進入傷害計算
  const combat = (s: Parameters<typeof scenario>[0]) => scenario({ phase: '先手', singlePhase: true, ...s });

  it('高利貸：[發] 對方強制蓋 X，X＝對方表側且帶 [經] 的經驗張數；被蓋的卡蓋反應照常觸發', () => {
    const g = combat({
      p0: { hand: ['高利貸'] },
      p1: { hand: [], exp: ['低價買進', '黑桃3', '高價賣出', '黑桃4'], rage: Array(5).fill('黑桃1'), deck: ['黑桃6', ...filler] },
    });
    // X＝2（低價買進、高價賣出）：從最前面蓋 2 張＝低價買進與黑桃3
    expect(Z(g, 1, 'exp').map((c) => c.covered)).toEqual([true, true, false, false]);
    expect(g.state.log.join('\n')).toContain('玩家B（刺客） 回復 3'); // 低價買進被蓋成裏側：回復 3
    expect(g.state.log.join('\n')).toContain('【低價買進】被蓋成裏側');
  });

  it('高利貸：對方沒有帶 [經] 的表側經驗時什麼都不蓋；裏側的 [經] 卡不算；表側不足就蓋到沒有為止', () => {
    const none = combat({ p0: { hand: ['高利貸'] }, p1: { hand: [], exp: ['黑桃3', '~低價買進'] } });
    expect(Z(none, 1, 'exp').map((c) => c.covered)).toEqual([false, true]);

    const one = combat({ p0: { hand: ['高利貸'] }, p1: { hand: [], exp: ['黑桃3', '高價賣出'], deck: ['黑桃6', ...filler] } });
    expect(Z(one, 1, 'exp').map((c) => c.covered)).toEqual([true, false]); // X＝1，蓋最前面 1 張
  });

  it('狙擊蓄力：[發_蓋4] 蓋 4、抽 2，再選 1 張手牌放到牌組頂', () => {
    const g = combat({
      p0: { hand: ['狙擊蓄力', '黑桃2'], exp: ['黑桃1', '黑桃3', '黑桃4', '黑桃5', '黑桃6'], deck: ['黑桃7', '黑桃8', ...filler] },
      p1: { hand: [] },
    });
    pick(g, '狙擊蓄力');
    pick(g, '發動');
    expect(Z(g, 0, 'exp').filter((c) => c.covered)).toHaveLength(4);
    expect(names(g, 0, 'hand').sort()).toEqual(['黑桃2', '黑桃7', '黑桃8']);
    expect(g.pending!.options.map((o) => o.label).sort()).toEqual(['黑桃2', '黑桃7', '黑桃8']);
    pick(g, '黑桃8');
    expect(Z(g, 0, 'deck')[0].id).toBe('黑桃8');
    expect(names(g, 0, 'hand').sort()).toEqual(['黑桃2', '黑桃7']);
  });

  it('狙擊蓄力：表側經驗不足 4 張不詢問；選擇不發動就沒有任何效果', () => {
    const few = combat({ p0: { hand: ['狙擊蓄力', '黑桃2'], exp: ['黑桃1', '黑桃3', '黑桃4'] }, p1: { hand: [] } });
    pick(few, '狙擊蓄力');
    expect(Z(few, 0, 'exp').filter((c) => c.covered)).toHaveLength(0);
    expect(names(few, 0, 'hand')).toEqual(['黑桃2']);

    const decline = combat({ p0: { hand: ['狙擊蓄力', '黑桃2'], exp: Array(5).fill('黑桃3') }, p1: { hand: [] } });
    pick(decline, '狙擊蓄力');
    pick(decline, '不發動');
    expect(Z(decline, 0, 'exp').filter((c) => c.covered)).toHaveLength(0);
    expect(names(decline, 0, 'hand')).toEqual(['黑桃2']);
  });

  it('熔岩之擊：[發_怒3] 捨棄怒氣區 3 張，對方直擊 1', () => {
    const g = combat({
      p0: { hand: ['熔岩之擊'], rage: Array(4).fill('黑桃1') },
      p1: { hand: [] },
    });
    pick(g, '發動');
    expect(Z(g, 0, 'rage')).toHaveLength(1);
    expect(Z(g, 1, 'discard')).toHaveLength(1);
  });

  it('熔岩之擊：怒氣不足 3 張不詢問；選擇不發動就沒有任何效果', () => {
    const few = combat({ p0: { hand: ['熔岩之擊'], rage: ['黑桃1', '黑桃1'] }, p1: { hand: [] } });
    expect(Z(few, 1, 'discard')).toHaveLength(0);

    const decline = combat({ p0: { hand: ['熔岩之擊'], rage: Array(3).fill('黑桃1') }, p1: { hand: [] } });
    pick(decline, '不發動');
    expect(Z(decline, 0, 'rage')).toHaveLength(3);
    expect(Z(decline, 1, 'discard')).toHaveLength(0);
  });
});

describe('冰與雷之曲：戰鬥區的卡合計具有冰與雷兩個特徵', () => {
  // 以暫時改動特徵來驗證：一張卡同時有冰與雷、電不再當作雷
  const withTraits = (id: string, traits: string[], run: () => void) => {
    const card = getCard(id);
    const saved = [...card.traits];
    card.traits.splice(0, card.traits.length, ...traits);
    try {
      run();
    } finally {
      card.traits.splice(0, card.traits.length, ...saved);
    }
  };
  const song = (combat: string[]) => {
    const g = scenario({
      phase: '先手',
      singlePhase: true,
      p0: { hand: ['黑桃1', '黑桃2'], gear: ['冰與雷之曲'], exp: ['黑桃1', '黑桃2', '黑桃3'], combat, rage: ['黑桃4'] },
      p1: { hand: ['黑桃9'] },
    });
    pick(g, '黑桃1');
    pick(g, '黑桃9');
    pick(g, '收招');
    return g;
  };

  it('兩張卡各有一個特徵算符合；電弧的特徵是雷', () => {
    expect(getCard('電弧').traits).toContain('雷');
    expect(song(['冰霜護甲', '電弧']).pending!.title).toContain('冰與雷之曲');
  });

  it('一張卡同時有冰與雷也算符合', () => {
    withTraits('冰霜護甲', ['法術', '冰', '雷'], () => {
      expect(song(['冰霜護甲']).pending!.title).toContain('冰與雷之曲');
    });
  });

  it('只有冰或只有雷不算；電不再當作雷', () => {
    expect(song(['冰霜護甲']).pending).toBeNull();
    expect(song(['電弧']).pending).toBeNull();
    withTraits('電弧', ['法術', '電'], () => {
      expect(song(['冰霜護甲', '電弧']).pending).toBeNull();
    });
  });
});
