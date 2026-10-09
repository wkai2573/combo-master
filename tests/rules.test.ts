import { describe, expect, it } from 'vitest';
import { playables, pursuitCount, resolveCombatStats, totalAtk, totalDef } from '../src/engine/combat';
import { draw, Z } from '../src/engine/ops';
import { optionalPay } from '../src/engine/cost';
import { atkOf, defOf, names, pick, scenario, setZones } from './helpers';
import { 伏擊狀態 } from '../src/engine/sources/thief';

const labels = (g: ReturnType<typeof scenario>) => g.pending!.options.map((o) => o.label);

describe('出招與範圍內', () => {
  it('先手步驟任何招式皆可；之後只能出兩邊最後一張之間的連擊值', () => {
    const g = scenario({
      p0: { hand: ['黑桃5', '黑桃3', '黑桃8'] },
      p1: { hand: ['黑桃1', '黑桃6', '黑桃9'] },
    });
    expect(labels(g)).toEqual(['黑桃5', '黑桃3', '黑桃8']);
    pick(g, '黑桃5');
    // 後攻尚未出牌，全部在範圍內
    expect(labels(g)).toEqual(['黑桃1', '黑桃6', '黑桃9', '收招']);
    pick(g, '黑桃9');
    // 先攻範圍：5 ~ 9
    expect(labels(g)).toEqual(['黑桃8', '收招']);
  });

  it('戰鬥階段第一個步驟叫先手步驟：階段、提示與紀錄都用這個名稱', () => {
    const g = scenario({
      p0: { hand: ['黑桃5', '黑桃3'] },
      p1: { hand: ['黑桃1', '黑桃6'] },
    });
    expect(g.state.phase).toBe('先手');
    expect(g.pending!.title).toContain('先手步驟');
    pick(g, '黑桃5');
    expect(g.state.phase).toBe('反擊');
    expect(g.state.log.some((l) => l.includes('先手出招【黑桃5】'))).toBe(true);
    expect(g.state.log.some((l) => l.includes('起手'))).toBe(false);
  });

  it('戰鬥區只能出現一次重複：重複過之後，戰鬥區已有的連擊值都不能再出，新的連擊值照常可以', () => {
    const g = scenario({
      p0: { hand: ['紅心3', '方塊2', '梅花2', '黑桃9'], moves: ['黑桃8', '黑桃5', '梅花5', '黑桃3'] },
      p1: { hand: [], moves: ['紅心2'] },
    });
    // 我方戰鬥區 8、5、5、3：5 已經重複過；範圍 2~3，第 2 張 3 不能出，新的 2 可以（兩張都是 2，所以不會被自動出招）
    expect(playables(g, 0).map((c) => c.id)).toEqual(['方塊2', '梅花2']);

    // 還沒重複過時，第一次重複可以
    const first = scenario({
      p0: { hand: ['紅心3', '方塊2', '梅花2', '黑桃9'], moves: ['黑桃8', '黑桃5', '黑桃3'] },
      p1: { hand: [], moves: ['紅心2'] },
    });
    expect(playables(first, 0).map((c) => c.id)).toEqual(['紅心3', '方塊2', '梅花2']);
  });

  it('同連擊值可以重複打出 1 次（共 2 張），第 3 張起就不行', () => {
    const g = scenario({
      p0: { hand: ['黑桃5', '梅花5', '紅心5', '黑桃7'] },
      p1: { hand: ['黑桃9', '紅心9', '黑桃8'] },
    });
    pick(g, '黑桃5');
    pick(g, '黑桃9');
    // 範圍 5~9：我方已有 1 張 5，還能再出第 2 張 5
    expect(labels(g)).toEqual(['梅花5', '紅心5', '黑桃7', '收招']);
    pick(g, '梅花5');
    pick(g, '紅心9'); // 對方也打出第 2 張 9
    // 我方已有 2 張 5，不能再出第 3 張；範圍 5~9 內還能出 7
    expect(labels(g)).toEqual(['黑桃7', '收招']);
  });

  it('範例：我 4、對方 5、我 4、對方 5、我再出 5，這時對方範圍 5~5 但已有 2 張 5，不能出牌', () => {
    const g = scenario({
      p0: { hand: ['黑桃4', '紅心4', '方塊5'] },
      p1: { hand: ['黑桃5', '紅心5', '梅花5'] },
    });
    pick(g, '黑桃4'); // 我方先手 4
    pick(g, '黑桃5'); // 對方出 5
    expect(labels(g)).toEqual(['紅心4', '方塊5', '收招']); // 範圍 4~5，再出一張 4 合法
    pick(g, '紅心4'); // 我方第 2 張 4
    pick(g, '紅心5'); // 對方第 2 張 5
    expect(labels(g)).toEqual(['方塊5', '收招']); // 我方還能出 5（5 在我方是第 1 張）
    pick(g, '方塊5');
    // 對方範圍 5~5，手上雖有梅花5，但對方已有 2 張 5 → 自動收招，不會有提示
    expect(g.state.log).toContain('玩家B（刺客） 收招');
    expect(names(g, 1, 'hand')).toContain('梅花5');
  });
});

describe('戰鬥流程與傷害', () => {
  it('後攻第一個動作就收招：跳過追擊，直接傷害計算', () => {
    const g = scenario({ p0: { hand: ['黑桃5'] }, p1: { hand: ['黑桃1', '黑桃2'] } });
    pick(g, '收招');
    expect(g.state.log.join('\n')).not.toContain('追擊判定');
    expect(Z(g, 1, 'rage')).toHaveLength(atkOf('黑桃5')); // 對手戰鬥區是空的，防禦 0
    expect(Z(g, 0, 'rage')).toHaveLength(0);
    expect(names(g, 0, 'exp')).toEqual(['黑桃5']);
    expect(g.state.phase).toBe('爆發');
  });

  it('追擊判定、總攻擊／總防禦、傷害公式與歸還順序', () => {
    const g = scenario({ p0: { hand: ['黑桃5'] }, p1: { hand: ['黑桃9'] } });
    pick(g, '黑桃9');
    // 牌頂皆為黑桃1（連擊值 1，不在 5~9 內）→ 雙方追擊成功
    // 玩家0：黑桃5＋追擊卡黑桃1；玩家1（刺客）：黑桃9＋追擊卡黑桃1，追擊成功時把 Ex-流血 放進玩家0 的經驗區，玩家0 總防禦 −1
    const atk0 = atkOf('黑桃5') + atkOf('黑桃1');
    const atk1 = atkOf('黑桃9') + atkOf('黑桃1');
    expect(Z(g, 0, 'rage')).toHaveLength(atk1 - (defOf('黑桃5') - 1));
    expect(Z(g, 1, 'rage')).toHaveLength(atk0 - defOf('黑桃9'));
    expect(names(g, 0, 'exp')).toEqual(['Ex-流血', '黑桃5', '黑桃1']); // 追擊時放進來的流血在前，歸還的招式在前、追擊卡在後
    expect(names(g, 1, 'exp')).toEqual(['黑桃9', '黑桃1']);
  });

  it('追擊判定的卡在範圍內則失敗並回到手中', () => {
    const g = scenario({
      p0: { hand: ['黑桃1'], deck: ['黑桃9', ...Array(20).fill('黑桃1')] },
      p1: { hand: ['黑桃9'], deck: ['黑桃5', ...Array(20).fill('黑桃1')] },
    });
    pick(g, '黑桃9');
    // 範圍 1~9，牌頂 9 與 5 都在範圍內 → 失敗
    expect(g.state.flags.pursuitSuccess).toEqual([0, 0]);
    expect(names(g, 0, 'hand')).toContain('黑桃9');
    expect(names(g, 1, 'hand')).toContain('黑桃5');
  });

  it('牌組歸零者落敗', () => {
    const g = scenario({
      p0: { hand: ['黑桃5'] },
      p1: { deck: ['黑桃1', '黑桃1'] },
    });
    expect(g.over).toBe(true);
    expect(g.state.winner).toBe(0);
    expect(g.pending).toBeNull();
  });
});

describe('同時歸零的勝負', () => {
  it('手牌多者勝', () => {
    const g = scenario({ p0: { deck: [], hand: ['黑桃1', '黑桃2', '黑桃3'] }, p1: { deck: [], hand: ['黑桃1'] } });
    expect(g.state.winner).toBe(0);
    expect(g.state.winReason).toContain('手牌');
  });

  it('手牌相同直接平手，不比怒氣區', () => {
    const g = scenario({
      p0: { deck: [], hand: ['黑桃1'], rage: ['黑桃2', '黑桃9'] },
      p1: { deck: [], hand: ['黑桃1'], rage: ['黑桃3', '黑桃1'] },
    });
    expect(g.over).toBe(true);
    expect(g.state.winner).toBe('draw');
    expect(g.state.winReason).toContain('手牌');
    expect(g.state.phase).toBe('結束');
  });

  it('手牌相同時怒氣區張數不同也一樣平手', () => {
    const g = scenario({
      p0: { deck: [], hand: ['黑桃1'], rage: ['黑桃5', '紅心5'] },
      p1: { deck: [], hand: ['黑桃1'], rage: ['梅花5'] },
    });
    expect(g.state.winner).toBe('draw');
  });
});

describe('卡片效果', () => {
  it('力量爆破：[頂] 我方總攻擊 -3', () => {
    const g = scenario({ p0: { hand: ['力量爆破'] }, p1: { hand: [] } });
    expect(Z(g, 1, 'rage')).toHaveLength(atkOf('力量爆破') - 3);
  });
});

describe('角色效果（總攻擊／總防禦）', () => {
  it('勇者：總攻擊 15 以上 +3，覺醒後條件改為 10', () => {
    const g = scenario();
    const sum = (ids: string[]) => ids.reduce((n, id) => n + atkOf(id), 0);
    const big = ['黑桃1', '黑桃9', '黑桃8']; // 總攻擊 ≥ 15
    const mid = ['黑桃1', '黑桃9']; // 10 ≤ 總攻擊 < 15
    expect(sum(big)).toBeGreaterThanOrEqual(15);
    expect(sum(mid)).toBeGreaterThanOrEqual(10);
    expect(sum(mid)).toBeLessThan(15);
    setZones(g, 0, { moves: big });
    expect(totalAtk(g, 0)).toBe(sum(big) + 3);
    setZones(g, 0, { moves: mid });
    expect(totalAtk(g, 0)).toBe(sum(mid));
    setZones(g, 0, { moves: mid, exp: Array(8).fill('黑桃1') });
    expect(totalAtk(g, 0)).toBe(sum(mid) + 3);
  });

  it('先人：先攻時攻擊 +（出招張數 - 1）', () => {
    const g = scenario({ chars: ['先人', '勇者'] });
    const ids = ['黑桃1', '黑桃2', '黑桃3'];
    setZones(g, 0, { moves: ids });
    g.state.flags.played[0] = 3;
    expect(totalAtk(g, 0)).toBe(ids.reduce((n, id) => n + atkOf(id), 0) + 2);
  });

  it('後人：後攻時總防禦 +1；覺醒後每張追擊卡若為白板卡，其防禦也計入總防禦，否則總防禦 +2', () => {
    const g = scenario({ chars: ['勇者', '後人'], first: 0 });
    setZones(g, 1, { moves: ['黑桃1'], pursuit: ['黑桃3'] });
    expect(totalDef(g, 1)).toBe(defOf('黑桃1') + 1); // 未覺醒：追擊卡的防禦不計
    const awake = Array(8).fill('黑桃1');
    setZones(g, 1, { moves: ['黑桃1'], pursuit: ['黑桃3'], exp: awake });
    expect(totalDef(g, 1)).toBe(defOf('黑桃1') + defOf('黑桃3') + 1); // 白板追擊卡：防禦計入
    setZones(g, 1, { moves: ['黑桃1'], pursuit: ['伏擊'], exp: awake });
    expect(totalDef(g, 1)).toBe(defOf('黑桃1') + 1 + 2); // 非白板追擊卡：防禦不計，總防禦 +2
    setZones(g, 1, { moves: ['黑桃1'], pursuit: ['黑桃3', '伏擊', '地雷陷阱'], exp: awake });
    expect(totalDef(g, 1)).toBe(defOf('黑桃1') + defOf('黑桃3') + 1 + 2 + 2); // 每張各自判定
  });

  it('後人：先攻的回合沒有這些加成', () => {
    const g = scenario({ chars: ['後人', '勇者'], first: 0 });
    setZones(g, 0, { moves: ['黑桃1'], pursuit: ['伏擊'], exp: Array(8).fill('黑桃1') });
    expect(totalDef(g, 0)).toBe(defOf('黑桃1'));
  });

  it('戒備打擊（劍士）：[頂] 總攻擊 +1、總防禦 +2，只有在最上方時才算', () => {
    const g = scenario();
    setZones(g, 0, { moves: ['黑桃1', '戒備打擊'] });
    expect(totalDef(g, 0)).toBe(defOf('黑桃1') + defOf('戒備打擊') + 2);
    expect(totalAtk(g, 0)).toBe(atkOf('黑桃1') + atkOf('戒備打擊') + 1);
    setZones(g, 0, { moves: ['戒備打擊', '黑桃1'] });
    expect(totalDef(g, 0)).toBe(defOf('黑桃1') + defOf('戒備打擊'));
    expect(totalAtk(g, 0)).toBe(atkOf('黑桃1') + atkOf('戒備打擊'));
  });


  it('伏擊（盜賊）：[先] 作為先手步驟出招時，此回合總攻擊 +4；不是先手步驟就沒有', () => {
    const g = scenario({ chars: ['刺客', '勇者'], p0: { hand: ['伏擊', '黑桃3'] }, p1: { hand: ['黑桃5'] } });
    expect(g.pending!.options.map((o) => o.label)).toContain('伏擊');
    pick(g, '伏擊');
    expect(伏擊狀態.read(g, 0).atk).toBe(4);
    expect(totalAtk(g, 0)).toBe(atkOf('伏擊') + 4);

    const g2 = scenario({ first: 1, chars: ['勇者', '刺客'], p0: { hand: ['伏擊'] }, p1: { hand: ['黑桃5'] } });
    pick(g2, '伏擊'); // 玩家1 先攻只有一張牌、自動先手出招；玩家0 後攻反擊，不是先手步驟
    expect(伏擊狀態.read(g2, 0).atk).toBe(0);
  });

  it('魅影射擊（弓箭手）：[追] 成為追擊卡時，我方總防禦 +4', () => {
    const g = scenario();
    setZones(g, 0, { moves: ['黑桃1'], pursuit: ['魅影射擊'] });
    expect(totalDef(g, 0)).toBe(defOf('黑桃1') + 4);
    setZones(g, 0, { moves: ['黑桃1'], pursuit: ['黑桃2'] });
    expect(totalDef(g, 0)).toBe(defOf('黑桃1'));
  });

  it('地雷陷阱（弓箭手）：[追] 成為追擊卡時，我方總攻擊 +3（含卡本身的攻擊）', () => {
    const g = scenario({ chars: ['遊俠', '勇者'] });
    setZones(g, 0, { moves: ['黑桃1'], pursuit: ['地雷陷阱'] });
    expect(totalAtk(g, 0)).toBe(atkOf('黑桃1') + atkOf('地雷陷阱') + 3);
  });

  it('二刀連擊（盜賊）：[頂] 在招式卡疊最上方時追擊 +1', () => {
    const g = scenario();
    setZones(g, 0, { moves: ['二刀連擊'] });
    expect(pursuitCount(g, 0)).toBe(2);
    setZones(g, 0, { moves: ['黑桃1', '二刀連擊'] });
    expect(pursuitCount(g, 0)).toBe(2);
    setZones(g, 0, { moves: ['二刀連擊', '黑桃1'] });
    expect(pursuitCount(g, 0)).toBe(1);
    setZones(g, 0, { moves: ['黑桃1'] });
    expect(pursuitCount(g, 0)).toBe(1);
  });

  it('電弧（法師）：[發_蓋1] 抽X，再放 X 張手牌到牌組底，X＝對方戰鬥區招式數', () => {
    const g = scenario({
      first: 1,
      chars: ['法師', '勇者'],
      p0: { hand: ['電弧', '黑桃2'], exp: ['黑桃3'], deck: ['黑桃7', ...Array(20).fill('黑桃1')] },
      p1: { hand: ['黑桃5'] },
    });
    pick(g, '電弧'); // 玩家1 先攻只有 1 張，自動先手出招；對方戰鬥區有 1 張 → X = 1
    pick(g, '發動'); // 付蓋1
    expect(g.pending!.title).toContain('電弧');
    pick(g, '黑桃2');
    expect(names(g, 0, 'hand')).toContain('黑桃7');
    expect(Z(g, 0, 'deck').at(-1)!.id).toBe('黑桃2');
  });

});

describe('提示驗證', () => {
  it('不合法的回應會被拒絕', () => {
    const g = scenario({ p0: { hand: ['黑桃5', '黑桃3'] } });
    expect(() => g.submit(1, ['x'])).toThrow();
    expect(() => g.submit(0, ['不存在'])).toThrow();
    expect(() => g.submit(0, [])).toThrow(); // 先手步驟必須選 1 張
  });
});

describe('戰鬥結算深模組 (resolveCombatStats)', () => {
  it('正確結算攻守數值並提供詳細的 breakdown 明細', () => {
    const g = scenario({ chars: ['勇者', '後人'], first: 0 });
    // 玩家 0 (勇者)：戰鬥區出 黑桃1、黑桃9，追擊 地雷陷阱 (+3 atk)
    setZones(g, 0, { moves: ['黑桃1', '黑桃9'], pursuit: ['地雷陷阱'] });
    const s0 = resolveCombatStats(g, 0);
    const expectedBase0 = atkOf('黑桃1') + atkOf('黑桃9') + atkOf('地雷陷阱') + 3;
    expect(s0.atk).toBe(expectedBase0 + (expectedBase0 >= 15 ? 3 : 0));
    expect(s0.breakdown.combatZoneAtk).toBe(atkOf('黑桃1') + atkOf('黑桃9'));
    expect(s0.breakdown.pursuitAtk).toBe(atkOf('地雷陷阱') + 3);

    // 玩家 1 (後人，後攻未覺醒)：防禦 +1
    setZones(g, 1, { moves: ['黑桃1'], pursuit: ['黑桃3'] });
    const s1 = resolveCombatStats(g, 1);
    expect(s1.def).toBe(defOf('黑桃1') + 1);
    expect(s1.breakdown.charBonusDef).toBe(1);
  });
});
