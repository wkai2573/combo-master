import { describe, expect, it } from 'vitest';
import { aimLimit, pursuitCount, returnStep, totalAtk, totalDef } from '../src/engine/combat';
import { discard, newCard, Z } from '../src/engine/ops';
import { cover, optionalPay, pay } from '../src/engine/cost';
import { getCard } from '../src/data/cards';
import { armorScenario, atkOf, defOf, drive, liftedAtkOf, names, pick, scenario, setZones } from './helpers';

import { 伏擊狀態, 塗毒狀態, 順手牽羊狀態 } from '../src/engine/sources/thief';
import { 二連矢狀態 } from '../src/engine/sources/archer';
import { 狙擊印記狀態 } from '../src/engine/sources/archer';

const filler = Array(20).fill('黑桃2') as string[];

describe('爆發階段：抽 2', () => {
  it('把 1 張手牌放入經驗區後抽 2；招財貓可以蓋 2 再多抽 1', () => {
    const base = (gear: string[]) =>
      scenario({ phase: '抽牌', p0: { hand: [], gear, exp: ['黑桃1', '黑桃2'] }, p1: { hand: [] } });
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
  const burst = (exp: string[]) =>
    scenario({ chars: ['商人', '勇者'], phase: '爆發', singlePhase: true, p0: { hand: ['黑桃3'], exp }, p1: { hand: [] } });

  it('爆發後可以將 1 張表側經驗放到最前方', () => {
    const g = burst(['黑桃1', '黑桃2']);
    pick(g, '黑桃3'); // 爆發把黑桃3 放進經驗區：黑桃1、黑桃2、黑桃3
    pick(g, '發動');
    // 已經在最前方的黑桃1 不用選
    expect(g.pending!.options.map((o) => o.label).sort()).toEqual(['黑桃2', '黑桃3']);
    expect(g.pending!.min).toBe(1);
    expect(g.pending!.max).toBe(1);
    pick(g, '黑桃3');
    expect(names(g, 0, 'exp')).toEqual(['黑桃3', '黑桃1', '黑桃2']);
  });

  it('不發動就不動；放到最前方的卡仍是表側，其餘的相對位置不變', () => {
    const g = burst(['黑桃1', '黑桃2', '黑桃4']);
    pick(g, '黑桃3');
    pick(g, '不發動');
    expect(names(g, 0, 'exp')).toEqual(['黑桃1', '黑桃2', '黑桃4', '黑桃3']);

    const h = burst(['黑桃1', '黑桃2', '黑桃4']);
    pick(h, '黑桃3');
    pick(h, '發動');
    pick(h, '黑桃4');
    expect(names(h, 0, 'exp')).toEqual(['黑桃4', '黑桃1', '黑桃2', '黑桃3']);
    expect(Z(h, 0, 'exp').every((c) => !c.covered)).toBe(true);
  });

  it('裏側的經驗卡不動，放到的是整個經驗區的最前方', () => {
    const g = burst(['~黑桃1', '黑桃2']);
    pick(g, '黑桃3');
    pick(g, '發動');
    expect(g.pending!.options.map((o) => o.label).sort()).toEqual(['黑桃2', '黑桃3']); // 裏側的黑桃1 不能選
    pick(g, '黑桃3');
    expect(names(g, 0, 'exp')).toEqual(['黑桃3', '黑桃1', '黑桃2']);
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
    const g = scenario({ chars: ['遊俠', '勇者'], p0: { hand: ['狙擊印記', '黑桃2'] }, p1: { hand: [] }, singlePhase: true });
    pick(g, '狙擊印記');
    expect(狙擊印記狀態.read(g, 0).up).toBe(1);
  });

  it('LV2：抽 1，再選手中 1 張卡放到牌組頂或底，然後判定牌組頂', () => {
    const g = scenario({
      chars: ['遊俠', '勇者'],
      p0: { hand: ['黑桃7'], deck: ['黑桃8', '黑桃1', ...filler] },
      p1: { hand: ['黑桃9'] },
      singlePhase: true,
    });
    狙擊印記狀態.of(g, 0).up = 1;
    二連矢狀態.of(g, 0).plus = 1; // 追擊 2 次：第二次判定前，用過的瞄準不能再用
    pick(g, '黑桃9');
    expect(g.pending!.title).toContain('LV2');
    pick(g, '使用');
    pick(g, '牌組底'); // 抽到的黑桃8 是手中唯一一張，自動選它
    expect(g.pending?.title ?? '').not.toContain('瞄準'); // 本回合的瞄準用完了
    expect(Z(g, 0, 'deck').at(-1)!.id).toBe('黑桃8');
    expect(g.state.flags.pursuitSuccess[0]).toBe(2); // 兩次判定都在範圍 7~9 外
  });
});

describe('新卡（第二批）', () => {
  it('力量爆破：[頂] 總攻擊 −3，[追] 追擊判定失敗', () => {
    const g = scenario();
    setZones(g, 0, { moves: ['力量爆破'] });
    expect(totalAtk(g, 0)).toBe(atkOf('力量爆破') - 3);
  });

  it('低價買進：[經] 被蓋成裏側時回復 1', () => {
    const g = scenario({
      chars: ['商人', '勇者'],
      p0: { exp: ['低價買進', '黑桃3'], rage: Array(5).fill('黑桃1') },
    });
    pay(g, 0, { cover: 1 }).next();
    expect(Z(g, 0, 'exp')[0].covered).toBe(true);
    expect(Z(g, 0, 'rage')).toHaveLength(4);
  });

  it('高價賣出：[經] 被蓋成裏側時抽 1', () => {
    const g = scenario({ p0: { exp: ['高價賣出', '黑桃3'] } });
    const before = Z(g, 0, 'hand').length;
    pay(g, 0, { cover: 1 }).next();
    expect(Z(g, 0, 'hand')).toHaveLength(before + 1);
  });

  it('復仇之嚎：[經_怒3] 傷害計算時，若受到的傷害大於造成的，可以付怒氣 3 再把怒氣區上方 1 張加入手牌', () => {
    const g = scenario({ p0: { hand: ['黑桃1'], exp: ['復仇之嚎'], rage: Array(8).fill('黑桃1') }, p1: { hand: ['黑桃9'] }, singlePhase: true });
    伏擊狀態.of(g, 1).atk = 3; // 對方多 3 點總攻擊：受到的傷害大於造成的
    pick(g, '黑桃9');
    expect(g.pending!.title).toContain('復仇之嚎');
    const rage = Z(g, 0, 'rage').length;
    const hand = Z(g, 0, 'hand').length;
    pick(g, '發動');
    // 窗口時傷害還沒放進怒氣區：付 3 取 1，之後這回合的傷害才放進去
    expect(Z(g, 0, 'rage')).toHaveLength(rage - 3 - 1 + g.state.flags.damageTaken[0]);
    expect(Z(g, 0, 'hand')).toHaveLength(hand + 1); // 怒氣區上方 1 張
  });

  it('順手牽羊：[發_蓋X] 抽 X，此回合總防禦 −X（X ≤ 2），不影響總攻擊', () => {
    const g = scenario({
      chars: ['刺客', '勇者'],
      p0: { hand: ['順手牽羊', '黑桃2'], exp: ['黑桃3', '黑桃4', '黑桃5'] },
      p1: { hand: [] },
      singlePhase: true,
    });
    pick(g, '順手牽羊');
    expect(g.pending!.options.map((o) => o.label)).toEqual(['不發動', '蓋1', '蓋2']);
    pick(g, '蓋2');
    expect(順手牽羊狀態.read(g, 0).def).toBe(-2);
    expect(伏擊狀態.read(g, 0).atk).toBe(0);
    expect(Z(g, 0, 'exp').filter((c) => c.covered)).toHaveLength(2);
    expect(Z(g, 0, 'hand')).toHaveLength(3); // 打出後剩 1 張＋抽 2
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
    expect(順手牽羊狀態.read(g, 1).def).toBe(-1);
    expect(totalDef(g, 1)).toBe(defOf('順手牽羊') - 1);
    順手牽羊狀態.of(g, 1).def = -99;
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

  it('冰霜護甲：[頂_蓋2] 傷害計算時，捨棄 X 張裏側經驗，減少受到的 X 點傷害；剛蓋成裏側的卡也能捨棄', () => {
    const g = armorScenario({ exp: ['黑桃3', '黑桃4', '~黑桃5', '~黑桃6'] });
    pick(g, '黑桃9');
    expect(g.pending!.title).toContain('冰霜護甲');
    const dmg = g.state.flags.damagePending[0];
    expect(dmg).toBeGreaterThanOrEqual(3);
    const rage = Z(g, 0, 'rage').length;
    expect(rage).toBe(5); // 窗口期間傷害還沒放進怒氣區
    pick(g, '發動');
    // 蓋2 之後 4 張都是裏側；裏側卡對擁有者顯示牌面，直接看著牌面選出 3 張
    expect(g.pending!.options).toHaveLength(4);
    expect(g.pending!.max).toBe(4);
    pick(g, '黑桃5', '黑桃6', '黑桃4');
    expect(names(g, 0, 'discard').sort()).toEqual(['黑桃4', '黑桃5', '黑桃6']);
    expect(Z(g, 0, 'exp').filter((c) => c.covered).map((c) => c.id)).toEqual(['黑桃3']);
    expect(g.state.flags.damageTaken[0]).toBe(dmg - 3);
    expect(Z(g, 0, 'rage')).toHaveLength(rage + dmg - 3);
  });

  it('冰霜護甲：X 至少 1，最多是將受到的傷害與裏側經驗張數中較小的', () => {
    const g = armorScenario({ exp: ['黑桃3', '黑桃4', '~黑桃5', '~黑桃6'] });
    pick(g, '黑桃9');
    g.state.flags.damagePending[0] = 2; // 將受到 2 點傷害，裏側經驗蓋2 之後有 4 張
    pick(g, '發動');
    expect(g.pending!.min).toBe(1);
    expect(g.pending!.max).toBe(2);
    pick(g, '黑桃5');
    expect(g.state.flags.damageTaken[0]).toBe(1);
    expect(names(g, 0, 'discard')).toEqual(['黑桃5']);
  });

  it('冰霜護甲：不在招式卡疊最上方、付不起蓋2 都不能發動', () => {
    const covered = (g: ReturnType<typeof armorScenario>) => String(g.pending?.title ?? '').includes('冰霜護甲');
    const notTop = armorScenario({ exp: ['黑桃3', '黑桃4'] });
    newCard(notTop, '黑桃2', 0, 'moves'); // 蓋在冰霜護甲上面
    pick(notTop, '黑桃9');
    expect(covered(notTop)).toBe(false);

    const noPay = armorScenario({ exp: ['黑桃3', '~黑桃4'] }); // 表側只有 1 張，付不起蓋2
    pick(noPay, '黑桃9');
    expect(covered(noPay)).toBe(false);
  });

  it('冰霜護甲：被捨棄的 Ex 卡直接移除遊戲，不進棄牌區；直擊不被減免', () => {
    const g = armorScenario({ exp: ['黑桃3', '黑桃4', '~Ex-中毒'] });
    pick(g, '黑桃9');
    pick(g, '發動');
    pick(g, 'Ex-中毒');
    expect(names(g, 0, 'discard')).toEqual([]);
    expect(Z(g, 0, 'exp').some((c) => c.id === 'Ex-中毒')).toBe(false);
  });

  it('盾擊：[頂] 戰鬥區每張招式卡的原始攻擊力若小於原始防禦力，該卡的攻擊力改為原始防禦力', () => {
    const g = scenario({ chars: ['刺客', '勇者'] });
    const ids = ['梅花1', '黑桃9', '盾擊'];
    expect(atkOf('梅花1')).toBeLessThan(defOf('梅花1')); // 攻擊力小於防禦力：會被補到防禦力
    expect(atkOf('黑桃9')).toBeGreaterThan(defOf('黑桃9')); // 攻擊力較大：不變
    setZones(g, 0, { moves: ids });
    const lifted = ids.reduce((n, id) => n + Math.max(atkOf(id), defOf(id)), 0);
    expect(totalAtk(g, 0)).toBe(lifted);
    expect(lifted).toBeGreaterThan(ids.reduce((n, id) => n + atkOf(id), 0));
    // 防禦力不受影響
    expect(totalDef(g, 0)).toBe(ids.reduce((n, id) => n + defOf(id), 0));
  });

  it('盾擊：不在最上方就沒有效果；追擊卡疊的招式卡也會補；其餘加成在補攻擊力之後照算', () => {
    const g = scenario({ chars: ['刺客', '勇者'] });
    setZones(g, 0, { moves: ['盾擊', '梅花1'] });
    expect(totalAtk(g, 0)).toBe(atkOf('盾擊') + atkOf('梅花1'));
    setZones(g, 0, { moves: ['梅花1', '盾擊'], pursuit: ['梅花1'] });
    expect(totalAtk(g, 0)).toBe(defOf('梅花1') + liftedAtkOf('盾擊') + defOf('梅花1')); // 追擊卡疊的梅花1 也補到防禦力，盾擊自己也補
    伏擊狀態.of(g, 0).atk = 3;
    expect(totalAtk(g, 0)).toBe(defOf('梅花1') + liftedAtkOf('盾擊') + defOf('梅花1') + 3);
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
      singlePhase: true,
    });
    pick(g, '黑桃9');
    expect(g.state.flags.pursuitSuccess[0]).toBe(2); // 二連矢（連擊值 3，範圍外）成功，再翻黑桃1 也成功
  });

  it('二刀連擊：戰鬥區只有此卡時追擊 +1', () => {
    const g = scenario();
    setZones(g, 0, { moves: ['二刀連擊'] });
    expect(pursuitCount(g, 0)).toBe(2);
  });

  describe('凡骨的意志', () => {
    const ids = ['黑桃1', '黑桃2', '伏擊'];
    const base = ids.reduce((n, id) => n + atkOf(id), 0);
    const baseDef = ids.reduce((n, id) => n + defOf(id), 0);
    // 戰鬥區放 3 張招式，其中 2 張是白板卡；scenario 開局時已經跑過第一回合的回合開始效果
    const play = (exp: string[], phase?: boolean) =>
      scenario({ chars: ['商人', '刺客'], p0: { exp, moves: ids }, ...(phase ? { phase: '回合開始', singlePhase: true } : { fullGame: true }) });
    const coveredIds = (g: ReturnType<typeof scenario>) => Z(g, 0, 'exp').filter((c) => c.covered).map((c) => c.id);

    it('回合開始時需蓋前 2 張表側經驗，總攻擊與總防禦各加戰鬥區白板卡數量', () => {
      const g = play(['黑桃3', '黑桃4', '凡骨的意志']);
      expect(coveredIds(g)).toEqual(['黑桃3', '黑桃4']);
      expect(totalAtk(g, 0)).toBe(base + 2); // 白板卡 2 張
      expect(totalDef(g, 0)).toBe(baseDef + 2);
    });

    it('前 2 張表側經驗包含自己時，連自己一起蓋，效果失效，沒有加成', () => {
      const g = play(['凡骨的意志', '黑桃3', '黑桃4']);
      expect(coveredIds(g)).toEqual(['凡骨的意志', '黑桃3']);
      expect(g.state.log.join('\n')).toContain('蓋到自己，加成消失');
      expect(totalAtk(g, 0)).toBe(base);
      expect(totalDef(g, 0)).toBe(baseDef);
      // 下個回合：它已經被蓋住，不能再發動，也不會去蓋黑桃3
      const nextTurn = scenario({ chars: ['商人', '刺客'], phase: '回合開始', singlePhase: true, p0: { exp: ['~凡骨的意志', '黑桃3'] } });
      expect(Z(nextTurn, 0, 'exp')[1].covered).toBe(false);
    });

    it('表側經驗剛好 2 張（包含自己）：兩張都蓋，沒有加成', () => {
      const g = scenario({ chars: ['商人', '刺客'], phase: '回合開始', singlePhase: true, p0: { exp: ['黑桃3', '~黑桃4', '凡骨的意志'], moves: ids } });
      expect(Z(g, 0, 'exp').map((c) => c.covered)).toEqual([true, true, true]);
      expect(totalAtk(g, 0)).toBe(base);
    });

    it('它是唯一的表側經驗時，蓋的就是自己，沒有加成', () => {
      const g = play(['凡骨的意志']);
      expect(Z(g, 0, 'exp')[0].covered).toBe(true);
      expect(totalAtk(g, 0)).toBe(base);
    });

    it('[經] 加成是常駐的：爆發放進經驗區的這回合就有加成，不用等到下個回合開始', () => {
      const g = scenario({ chars: ['商人', '刺客'], phase: '爆發', singlePhase: true, p0: { hand: ['凡骨的意志'], moves: ids } });
      expect(totalAtk(g, 0)).toBe(base);
      pick(g, '凡骨的意志');
      expect(Z(g, 0, 'exp').map((c) => c.id)).toEqual(['凡骨的意志']);
      expect(Z(g, 0, 'exp')[0].covered).toBe(false);
      expect(totalAtk(g, 0)).toBe(base + 2);
      expect(totalDef(g, 0)).toBe(baseDef + 2);
    });

    it('回合開始蓋到自己變裏側，之後翻回表側，加成就恢復（表側就持續有效）', () => {
      const g = play(['凡骨的意志']);
      expect(totalAtk(g, 0)).toBe(base);
      Z(g, 0, 'exp')[0].covered = false;
      expect(totalAtk(g, 0)).toBe(base + 2);
    });

    it('被蓋成裏側或離開經驗區，加成就消失；翻回表側才恢復', () => {
      const g = play(['黑桃3', '黑桃4', '凡骨的意志']);
      expect(totalAtk(g, 0)).toBe(base + 2);
      cover(g, 0, 1); // 表側只剩它一張
      expect(totalAtk(g, 0)).toBe(base);
      Z(g, 0, 'exp').find((c) => c.id === '凡骨的意志')!.covered = false;
      expect(totalAtk(g, 0)).toBe(base + 2);
      discard(g, Z(g, 0, 'exp').find((c) => c.id === '凡骨的意志')!);
      expect(totalAtk(g, 0)).toBe(base);
    });

    it('蓋掉另一張 [經] 卡，那張立即失效：它在窗口裡消失，不會發動', () => {
      // 位置：[黑桃3, 凡骨B, 凡骨A]；A 先發會蓋黑桃3 與 B，B 就不能再發動，A 的加成照給
      const g = scenario({ chars: ['商人', '刺客'], phase: '回合開始', singlePhase: true, p0: { exp: ['黑桃3', '凡骨的意志', '凡骨的意志'], moves: ids } });
      const [, , a] = Z(g, 0, 'exp');
      expect(g.pending!.options.map((o) => o.uid)).toEqual([Z(g, 0, 'exp')[1].uid, a.uid]);
      expect(g.pending!.options.map((o) => o.label.slice(-10))).toEqual(['（經驗區第 2 張）', '（經驗區第 3 張）']);
      pick(g, g.pending!.options[1].label);
      expect(g.pending).toBeNull();
      expect(Z(g, 0, 'exp').map((c) => c.covered)).toEqual([true, true, false]);
      expect(totalAtk(g, 0)).toBe(base + 2);
    });
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

  it('Explosion!：[先_怒10] 對方直擊 4，我方收招（對方仍可反擊），並跳過我方下個回合的抽牌階段', () => {
    const g = scenario({
      chars: ['法師', '勇者'],
      p0: { hand: ['Explosion!', '黑桃2'], rage: Array(10).fill('黑桃3') },
      p1: { hand: ['黑桃5'] },
    });
    pick(g, 'Explosion!');
    pick(g, '發動');
    expect(Z(g, 1, 'discard')).toHaveLength(4);
    expect(Z(g, 0, 'rage')).toHaveLength(0); // 怒10：捨棄怒氣區上方 10 張
    expect(Z(g, 0, 'discard')).toHaveLength(10);
    expect(g.state.passed).toEqual([true, false]);
    // 對方還能反擊：輪到玩家1 選擇出招或收招
    expect(g.pending!.player).toBe(1);
    expect(g.pending!.options.map((o) => o.label)).toContain('黑桃5');
    expect(g.state.drawSkips).toEqual([true, false]);
    pick(g, '黑桃5'); // 玩家1 手上沒牌了自動收招 → 雙方都已收招，進入追擊、傷害，然後是下個回合的抽牌階段
    expect(g.state.turn).toBe(2);
    expect(g.state.drawSkips).toEqual([false, false]); // 跳過一次就消耗掉
    expect(g.state.log.join('\n')).toContain('玩家A（法師） 跳過抽牌階段');
    expect(g.state.phase).toBe('爆發');
    expect(Z(g, 0, 'hand').map((c) => c.id)).toEqual(['黑桃2']); // 沒有抽牌
    expect(Z(g, 1, 'hand')).toHaveLength(1); // 玩家1 照常抽 1
  });

  it('Explosion!：怒氣區不足 10 張不能發動；選擇不發動就沒有任何效果', () => {
    const few = scenario({
      chars: ['法師', '勇者'],
      p0: { hand: ['Explosion!', '黑桃2'], rage: Array(9).fill('黑桃3') },
      p1: { hand: ['黑桃5'] },
    });
    pick(few, 'Explosion!');
    expect(few.pending!.title).not.toContain('Explosion!'); // 付不起，不詢問
    expect(few.state.passed).toEqual([false, false]);
    expect(Z(few, 1, 'discard')).toHaveLength(0);

    const no = scenario({
      chars: ['法師', '勇者'],
      p0: { hand: ['Explosion!', '黑桃2'], rage: Array(10).fill('黑桃3') },
      p1: { hand: ['黑桃5'] },
    });
    pick(no, 'Explosion!');
    pick(no, '不發動');
    expect(no.state.drawSkips[0]).toBe(false);
    expect(Z(no, 0, 'rage')).toHaveLength(10);
    expect(Z(no, 1, 'discard')).toHaveLength(0);
  });

  it('塗毒：[發_蓋2] 打出時付費發動，歸還時中毒落入對方；不發動就沒有中毒', () => {
    const setup = () => scenario({ chars: ['刺客', '勇者'], first: 0, p0: { hand: ['塗毒', '黑桃2'], exp: ['黑桃3', '黑桃4'] }, p1: { hand: [] } });
    const yes = setup();
    pick(yes, '塗毒');
    pick(yes, '發動');
    expect(Z(yes, 0, 'exp').slice(0, 2).map((c) => c.covered)).toEqual([true, true]);
    expect(names(yes, 1, 'exp')).toContain('Ex-中毒');
    expect(names(yes, 0, 'exp')).not.toContain('Ex-中毒');
    const no = setup();
    pick(no, '塗毒');
    pick(no, '不發動');
    expect(names(no, 1, 'exp')).not.toContain('Ex-中毒');
    expect(names(no, 0, 'exp')).not.toContain('Ex-中毒');
  });

  it('塗毒：蓋2 付不起（表側經驗不足 2 張）就不能發動', () => {
    const g = scenario({ chars: ['刺客', '勇者'], first: 0, p0: { hand: ['塗毒', '黑桃2'], exp: ['黑桃3'] }, p1: { hand: [] } });
    pick(g, '塗毒');
    expect(Z(g, 0, 'exp')[0].covered).toBe(false);
    expect(names(g, 1, 'exp')).not.toContain('Ex-中毒');
  });

  it('塗毒：歸還時 [Ex-中毒] 一律移入對方的經驗區，不看雙方出招張數；離開經驗區就移除遊戲', () => {
    for (const played of [[1, 2], [2, 2], [2, 1]] as Array<[number, number]>) {
      const g = scenario();
      塗毒狀態.of(g, 0).armed = 1;
      g.state.flags.played = played;
      drive(returnStep(g));
      expect(names(g, 1, 'exp'), played.join()).toContain('Ex-中毒');
      expect(names(g, 0, 'exp'), played.join()).not.toContain('Ex-中毒');
    }

    const t = scenario();
    塗毒狀態.of(t, 0).armed = 1;
    drive(returnStep(t));
    const poison = Z(t, 1, 'exp').find((c) => c.id === 'Ex-中毒')!;
    discard(t, poison);
    expect(Z(t, 1, 'discard').some((c) => c.id === 'Ex-中毒')).toBe(false);
    expect(Z(t, 1, 'exp').some((c) => c.id === 'Ex-中毒')).toBe(false);
  });

  it('家族相片：回合開始時 [蓋1_怒2] 回復 1', () => {
    const g = scenario({
      phase: '回合開始',
      singlePhase: true,
      p0: { gear: ['家族相片'], exp: ['黑桃3'], rage: Array(4).fill('黑桃1') },
    });
    const deck = Z(g, 0, 'deck').length;
    pick(g, '發動');
    expect(Z(g, 0, 'rage')).toHaveLength(1); // 怒 2 再回復 1
    expect(Z(g, 0, 'deck')).toHaveLength(deck + 1);
    expect(Z(g, 0, 'exp')[0].covered).toBe(true);
  });

  it('冰與雷之曲：收招時戰鬥區有「冰」「電」特徵的卡各 1 張，才可蓋 2 抽 1、回復 1', () => {
    const g = scenario({
      phase: '先手',
      singlePhase: true,
      p0: { hand: ['黑桃1', '黑桃2'], gear: ['冰與雷之曲'], exp: ['黑桃1', '黑桃2', '黑桃3'], moves: ['冰霜護甲', '電弧'], rage: ['黑桃4'] },
      p1: { hand: ['黑桃9'] },
    });
    pick(g, '黑桃1');
    pick(g, '黑桃9');
    pick(g, '收招');
    pick(g, '發動');
    // 手牌變化：打出黑桃1 (-1)、冰與雷之曲抽 1 (+1)、追擊判定落入範圍回到手中 (+1)
    expect(Z(g, 0, 'hand')).toHaveLength(3);
    expect(Z(g, 0, 'exp').filter((c) => c.covered)).toHaveLength(2);
    expect(Z(g, 0, 'rage')).toHaveLength(0);

    const only = scenario({
      phase: '先手',
      singlePhase: true,
      p0: { hand: ['黑桃1', '黑桃2'], gear: ['冰與雷之曲'], exp: ['黑桃1', '黑桃2', '黑桃3'], moves: ['冰霜護甲'] },
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
      singlePhase: true,
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

  it('pay 只蓋到一張蓋反應的卡時，自動觸發它的效果', () => {
    const g = scenario({ p0: { exp: ['低價買進', '黑桃3'], rage: Array(5).fill('黑桃1'), deck: ['黑桃4', ...filler] } });
    pay(g, 0, { cover: 1 }).next();
    expect(Z(g, 0, 'rage')).toHaveLength(4); // 低價買進：回復 1
  });
});

describe('卡表同步的新卡：公開資訊（id 高利貸）、狙擊蓄力、熔岩之擊', () => {
  // 只跑戰鬥階段：先攻方手牌只有 1 張招式時自動先手出招，後攻方沒有可出的招式就直接進入傷害計算
  const combat = (s: Parameters<typeof scenario>[0]) => scenario({ phase: '先手', singlePhase: true, ...s });

  /** 玩家 0 付蓋1：最前面的表側經驗（公開資訊）被蓋成裏側，觸發蓋反應 */
  const coverFront = (exp: string[]) => {
    const g = scenario({ p0: { exp } });
    return { g, gen: pay(g, 0, { cover: 1 }) };
  };
  const faceUp = (g: ReturnType<typeof scenario>) => Z(g, 0, 'exp').map((c) => !c.covered);

  it('公開資訊：[經] 被蓋成裏側時，翻開最多 3 張我方裏側經驗（不足就全部），然後捨棄此卡', () => {
    const { g, gen } = coverFront(['高利貸', '~黑桃3', '黑桃4', '~黑桃5']);
    expect(gen.next().done).toBe(true); // 裏側經驗只有 2 張，不用選
    expect(names(g, 0, 'exp')).toEqual(['黑桃3', '黑桃4', '黑桃5']);
    expect(faceUp(g)).toEqual([true, true, true]);
    expect(names(g, 0, 'discard')).toEqual(['公開資訊']);
    expect(g.state.log.join('\n')).toContain('【公開資訊】玩家A（勇者） 翻開 2 張裏側經驗');
  });

  it('公開資訊：裏側經驗超過 3 張時由擁有者選 3 張翻開，沒選到的仍是裏側', () => {
    const { g, gen } = coverFront(['高利貸', '~黑桃1', '~黑桃2', '~黑桃3', '~黑桃4']);
    const r = gen.next();
    expect(r.done).toBe(false);
    const req = r.value as { title: string; min: number; max: number; options: Array<{ key: string; label: string }> };
    expect(req.title).toContain('選擇 3 張裏側經驗翻開');
    expect([req.min, req.max]).toEqual([3, 3]);
    expect(req.options.map((o) => o.label)).toEqual(['黑桃1', '黑桃2', '黑桃3', '黑桃4']); // 不含公開資訊自己
    expect(gen.next(['黑桃1', '黑桃3', '黑桃4'].map((l) => req.options.find((o) => o.label === l)!.key)).done).toBe(true);
    expect(names(g, 0, 'exp')).toEqual(['黑桃1', '黑桃2', '黑桃3', '黑桃4']);
    expect(faceUp(g)).toEqual([true, false, true, true]);
    expect(names(g, 0, 'discard')).toEqual(['公開資訊']);
  });

  it('公開資訊：沒有其他裏側經驗時只捨棄自己；表側時不會發動', () => {
    const { g, gen } = coverFront(['高利貸', '黑桃4']);
    expect(gen.next().done).toBe(true);
    expect(names(g, 0, 'exp')).toEqual(['黑桃4']);
    expect(names(g, 0, 'discard')).toEqual(['公開資訊']);

    const idle = scenario({ p0: { exp: ['高利貸', '~黑桃3'] } });
    expect(names(idle, 0, 'discard')).toEqual([]);
    expect(Z(idle, 0, 'exp').map((c) => c.covered)).toEqual([false, true]);
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

describe('冰與雷之曲：戰鬥區的卡合計具有冰與電兩個特徵', () => {
  // 以暫時改動特徵來驗證：一張卡同時有冰與電、雷不再當作電
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
  const song = (moves: string[]) => {
    const g = scenario({
      phase: '先手',
      singlePhase: true,
      p0: { hand: ['黑桃1', '黑桃2'], gear: ['冰與雷之曲'], exp: ['黑桃1', '黑桃2', '黑桃3'], moves, rage: ['黑桃4'] },
      p1: { hand: ['黑桃9'] },
    });
    pick(g, '黑桃1');
    pick(g, '黑桃9');
    pick(g, '收招');
    return g;
  };

  it('兩張卡各有一個特徵算符合；電弧的特徵是電', () => {
    expect(getCard('電弧').traits).toContain('電');
    expect(song(['冰霜護甲', '電弧']).pending!.title).toContain('冰與雷之曲');
  });

  it('一張卡同時有冰與電也算符合', () => {
    withTraits('冰霜護甲', ['法術', '冰', '電'], () => {
      expect(song(['冰霜護甲']).pending!.title).toContain('冰與雷之曲');
    });
  });

  it('只有冰或只有電不算；雷不再當作電', () => {
    expect(song(['冰霜護甲']).pending).toBeNull();
    expect(song(['電弧']).pending).toBeNull();
    withTraits('電弧', ['法術', '雷'], () => {
      expect(song(['冰霜護甲', '電弧']).pending).toBeNull();
    });
  });
});
