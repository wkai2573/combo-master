import { describe, expect, it } from 'vitest';
import { totalAtk, totalDef } from '../src/engine/combat';
import { Z } from '../src/engine/ops';
import { names, pick, scenario, setZones } from './helpers';

const labels = (g: ReturnType<typeof scenario>) => g.pending!.options.map((o) => o.label);

describe('出招與範圍內', () => {
  it('起手任何招式皆可；之後只能出兩邊最後一張之間的連擊值', () => {
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

  it('同連擊值不能重複打出', () => {
    const g = scenario({
      p0: { hand: ['黑桃5', '梅花5', '黑桃7'] },
      p1: { hand: ['黑桃9'] },
    });
    pick(g, '黑桃5');
    pick(g, '黑桃9');
    expect(labels(g)).toEqual(['黑桃7', '收招']);
  });

  it('777 不能在起手步驟打出', () => {
    const g = scenario({ p0: { hand: ['777', '黑桃1', '黑桃2'] }, p1: { hand: ['黑桃9'] } });
    expect(labels(g)).toEqual(['黑桃1', '黑桃2']);
  });

  it('先手可從經驗區打出先祖圖騰', () => {
    const g = scenario({ p0: { hand: ['黑桃2', '黑桃3'], exp: ['先祖圖騰'] } });
    expect(labels(g)).toContain('先祖圖騰');
    const g2 = scenario({
      first: 1,
      p0: { hand: ['黑桃2'], exp: ['先祖圖騰'] },
      p1: { hand: ['黑桃4', '黑桃5'] },
    });
    pick(g2, '黑桃4');
    // 玩家0 為後攻，不能從經驗區打出先祖圖騰
    expect(labels(g2)).not.toContain('先祖圖騰');
  });
});

describe('戰鬥流程與傷害', () => {
  it('後攻第一個動作就收招：跳過追擊，直接傷害計算', () => {
    const g = scenario({ p0: { hand: ['黑桃5'] }, p1: { hand: ['黑桃1', '黑桃2'] } });
    pick(g, '收招');
    expect(g.state.log.join('\n')).not.toContain('追擊判定');
    expect(Z(g, 1, 'rage')).toHaveLength(6); // 黑桃5 攻擊 6，對手防禦 0
    expect(Z(g, 0, 'rage')).toHaveLength(0);
    expect(names(g, 0, 'exp')).toEqual(['黑桃5']);
    expect(g.state.phase).toBe('爆發');
  });

  it('追擊判定、總攻擊／總防禦、傷害公式與歸還順序', () => {
    const g = scenario({ p0: { hand: ['黑桃5'] }, p1: { hand: ['黑桃9'] } });
    pick(g, '黑桃9');
    // 牌頂皆為黑桃1（連擊值 1，不在 5~9 內）→ 雙方追擊成功
    // 玩家0：6+6=12 攻 / 4 防；玩家1（刺客，每次成功+2）：5+6+2=13 攻 / 5 防
    expect(Z(g, 0, 'rage')).toHaveLength(9); // 13 - 4
    expect(Z(g, 1, 'rage')).toHaveLength(7); // 12 - 5
    expect(names(g, 0, 'exp')).toEqual(['黑桃5', '黑桃1']); // 招式在前、追擊卡在後
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

  it('手牌相同則比怒氣區翻牌的連擊值', () => {
    const g = scenario({
      p0: { deck: [], hand: ['黑桃1'], rage: ['黑桃2', '黑桃9'] },
      p1: { deck: [], hand: ['黑桃1'], rage: ['黑桃3', '黑桃1'] },
    });
    // 洗牌順序隨機，但 p0 的牌必為 {2,9}、p1 為 {3,1}，不論順序最終都會分出勝負
    expect(g.state.winner === 0 || g.state.winner === 1).toBe(true);
    expect(g.over).toBe(true);
  });

  it('連擊值同值就繼續翻，全部翻完仍同則平手', () => {
    const g = scenario({
      p0: { deck: [], hand: ['黑桃1'], rage: ['黑桃5', '紅心5'] },
      p1: { deck: [], hand: ['黑桃1'], rage: ['梅花5', '方塊5'] },
    });
    expect(g.state.winner).toBe('draw');
  });

  it('連擊值都同值但怒氣區較少、先翻完者落敗', () => {
    const g = scenario({
      p0: { deck: [], hand: ['黑桃1'], rage: ['黑桃5', '紅心5'] },
      p1: { deck: [], hand: ['黑桃1'], rage: ['梅花5'] },
    });
    expect(g.state.winner).toBe(0);
  });

  it('怒氣區連擊值大者勝', () => {
    const g = scenario({
      p0: { deck: [], hand: ['黑桃1'], rage: ['黑桃9'] },
      p1: { deck: [], hand: ['黑桃1'], rage: ['黑桃2'] },
    });
    expect(g.state.winner).toBe(0);
  });
});

describe('卡片效果', () => {
  it('式不過3：對手打出第 4 張招式時可捨棄該招式', () => {
    const g = scenario({
      p0: { hand: ['黑桃1', '黑桃2', '黑桃3', '黑桃4'] },
      p1: { hand: ['黑桃9', '黑桃8', '黑桃7', '方塊1'], exp: ['式不過3'] },
    });
    pick(g, '黑桃1'); pick(g, '黑桃9');
    pick(g, '黑桃2'); pick(g, '黑桃8');
    pick(g, '黑桃3'); pick(g, '黑桃7');
    pick(g, '黑桃4');
    expect(g.pending!.title).toContain('是否發動');
    pick(g, '式不過3');
    expect(names(g, 0, 'discard')).toContain('黑桃4');
    expect(names(g, 1, 'discard')).toEqual(expect.arrayContaining(['式不過3', '方塊1']));
  });

  it('陷阱N：對手出招連擊值為 N 時，蓋 1 經驗並把陷阱放到戰鬥區底', () => {
    const g = scenario({
      p0: { hand: ['黑桃3', '黑桃1'] },
      p1: { hand: ['黑桃9'], exp: ['陷阱3', '黑桃2'] },
    });
    pick(g, '黑桃3');
    expect(g.pending!.title).toContain('是否發動');
    pick(g, '陷阱3');
    // 陷阱 3 攻 2 防 0；之後 p1 範圍變成 3~3 沒牌可出 → 直接傷害 → 歸還進經驗區
    expect(names(g, 1, 'exp')).toEqual(['黑桃2', '陷阱3']);
    expect(Z(g, 1, 'exp')[0].covered).toBe(true);
    expect(Z(g, 1, 'rage')).toHaveLength(4); // 黑桃3 攻擊 4
  });

  it('替身：每 1 傷害捨棄 1 張覆蓋的經驗代替', () => {
    const g = scenario({
      p0: { hand: ['黑桃5'] },
      p1: { buff: ['替身'], exp: ['~黑桃2', '~黑桃3', '黑桃4'] },
    });
    expect(Z(g, 1, 'rage')).toHaveLength(4); // 6 傷害 - 2 張替身
    expect(names(g, 1, 'discard')).toEqual(['黑桃2', '黑桃3']);
    expect(names(g, 1, 'exp')).toContain('黑桃4');
  });

  it('吸血打擊：傷害計算後回復 傷害/3（無條件捨去）', () => {
    const g = scenario({
      p0: { hand: ['吸血打擊'], rage: ['黑桃1'] },
      p1: { hand: [] },
    });
    expect(Z(g, 0, 'rage')).toHaveLength(0);
    expect(g.state.log.join('\n')).toContain('回復 1');
  });

  it('力量爆破：作為最上方招式時攻擊力 -6', () => {
    const g = scenario({ p0: { hand: ['力量爆破'] }, p1: { hand: [] } });
    expect(Z(g, 1, 'rage')).toHaveLength(6);
  });

  it('煉金印記：此回合每打出 1 張招式回復 1', () => {
    const g = scenario({
      p0: { hand: ['煉金印記', '黑桃2'], rage: ['黑桃1', '黑桃1'] },
      p1: { hand: ['黑桃9'] },
    });
    pick(g, '煉金印記');
    pick(g, '黑桃9');
    pick(g, '黑桃2');
    expect(g.state.log.filter((l) => l.includes('【煉金印記】回復 1'))).toHaveLength(1);
  });

  it('商人抽牌：看牌組上方 2 張選 1 張，另一張放回底部', () => {
    const g = scenario({
      chars: ['商人', '勇者'],
      p0: { hand: ['黑桃5'], deck: ['黑桃2', '黑桃3', ...Array(20).fill('黑桃1')] },
      p1: { hand: [] },
    });
    // 商人（先攻）的抽牌階段
    expect(g.pending!.title).toContain('商人');
    pick(g, '黑桃3');
    expect(names(g, 0, 'hand')).toContain('黑桃3');
    expect(Z(g, 0, 'deck').at(-1)!.id).toBe('黑桃2');
  });
});

describe('角色效果（總攻擊／總防禦）', () => {
  it('勇者：總攻擊 15 以上 +3，覺醒後條件改為 10', () => {
    const g = scenario();
    setZones(g, 0, { combat: ['黑桃1', '黑桃7', '梅花8'] }); // 6+7+9=22
    expect(totalAtk(g, 0)).toBe(25);
    setZones(g, 0, { combat: ['黑桃1', '黑桃2'] }); // 11
    expect(totalAtk(g, 0)).toBe(11);
    setZones(g, 0, { combat: ['黑桃1', '黑桃2'], exp: Array(8).fill('黑桃1') });
    expect(totalAtk(g, 0)).toBe(14);
  });

  it('先人：先攻時攻擊 +（出招張數 - 1）', () => {
    const g = scenario({ chars: ['先人', '勇者'] });
    setZones(g, 0, { combat: ['黑桃1', '黑桃2', '黑桃3'] }); // 6+5+4
    g.state.flags.played[0] = 3;
    expect(totalAtk(g, 0)).toBe(15 + 2);
  });

  it('後人：後攻時總防禦 +2，覺醒後連追擊卡防禦也計算', () => {
    const g = scenario({ chars: ['勇者', '後人'], first: 0 });
    setZones(g, 1, { combat: ['黑桃1'], pursuit: ['黑桃3'] }); // 防 4；追擊卡防 6
    expect(totalDef(g, 1)).toBe(4 + 2);
    setZones(g, 1, { combat: ['黑桃1'], pursuit: ['黑桃3'], exp: Array(8).fill('黑桃1') });
    expect(totalDef(g, 1)).toBe(4 + 6 + 2);
  });

  it('戒備打擊作為追擊卡時會計算防禦力', () => {
    const g = scenario();
    setZones(g, 0, { combat: ['黑桃1'], pursuit: ['戒備打擊'] });
    expect(totalDef(g, 0)).toBe(4 + 5);
  });
});

describe('提示驗證', () => {
  it('不合法的回應會被拒絕', () => {
    const g = scenario({ p0: { hand: ['黑桃5', '黑桃3'] } });
    expect(() => g.submit(1, ['x'])).toThrow();
    expect(() => g.submit(0, ['不存在'])).toThrow();
    expect(() => g.submit(0, [])).toThrow(); // 起手必須選 1 張
  });
});
