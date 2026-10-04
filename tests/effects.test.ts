import { describe, expect, it } from 'vitest';
import type { Game } from '../src/engine/game';
import { data, Z } from '../src/engine/ops';
import { names, pick, scenario } from './helpers';

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
  it('誘餌圖騰：追擊階段開始時捨棄並覆蓋 3 經驗，對手此回合追擊 -1', () => {
    const g = scenario({
      p0: { hand: ['黑桃5'] },
      p1: { hand: ['黑桃9'], exp: ['誘餌圖騰', '黑桃1', '黑桃2', '黑桃3'] },
    });
    pick(g, '黑桃9');
    expect(g.pending!.title).toContain('誘餌圖騰');
    pick(g, '發動');
    expect(g.state.flags.pursuitMinus).toEqual([1, 0]);
    expect(g.state.flags.pursuitSuccess[0]).toBe(0);
    expect(names(g, 1, 'discard')).toContain('誘餌圖騰');
    expect(Z(g, 1, 'exp').filter((c) => c.covered).map((c) => data(c).name)).toEqual(['黑桃1', '黑桃2', '黑桃3']);
  });

  it('兔腳項鍊：追擊判定失敗時可蓋 2 額外翻 1 張', () => {
    const g = scenario({
      p0: { hand: ['黑桃1'] },
      p1: { hand: ['黑桃9'], gear: ['兔腳項鍊'], exp: ['黑桃2', '黑桃3'], deck: ['黑桃5', '月光劍', ...filler] },
    });
    pick(g, '黑桃9');
    expect(g.pending!.title).toContain('兔腳項鍊');
    pick(g, '發動');
    // 黑桃5 在範圍 1~9 內失敗；額外翻出的月光劍連擊值 0（範圍外）→ 成功
    expect(g.state.flags.pursuitSuccess[1]).toBe(1);
    expect(g.state.flags.rabbitUsed[1]).toBe(true);
    expect(names(g, 1, 'hand')).toContain('黑桃5');
  });

  it('精準追擊：改為抽 X，從手牌選 X 張作為追擊判定', () => {
    const g = scenario({
      p0: { hand: ['精準追擊'], deck: ['黑桃1', ...filler] },
      p1: { hand: ['黑桃9'] },
    });
    pick(g, '黑桃9');
    // 精準追擊連擊值 4、對手 9 → 範圍 4~9；抽到的黑桃1 在範圍外 → 判定成功
    expect(g.state.log.join('\n')).toContain('追擊判定：翻開【黑桃1】');
    expect(g.state.flags.pursuitSuccess[0]).toBe(1);
  });

  it('陷阱變換：翻到陷阱時放入經驗區，改選經驗區 1 張陷阱作為追擊卡', () => {
    const g = scenario({
      p0: { hand: ['陷阱變換'], exp: ['陷阱5'], deck: ['陷阱3', ...filler] },
      p1: { hand: ['黑桃1'] },
    });
    pick(g, '黑桃1');
    expect(g.pending!.title).toContain('陷阱變換');
    pick(g, '陷阱5');
    expect(g.state.flags.pursuitSuccess[0]).toBe(1);
    expect(names(g, 0, 'exp')).toContain('陷阱3');
  });

  it('驚嚇陷阱：成為追擊卡時，經驗區 1 張卡回手，再把手中 1 張陷阱放入經驗區', () => {
    const g = scenario({
      // 陷阱7 連擊值 7 在範圍 2~4 外，打不出去，所以流程會直接進入追擊
      p0: { hand: ['黑桃2', '陷阱7'], exp: ['黑桃8'], deck: ['驚嚇陷阱', ...filler] },
      p1: { hand: ['黑桃4'] },
    });
    pick(g, '黑桃2');
    pick(g, '黑桃4');
    // 範圍 2~4，驚嚇陷阱連擊值 6 → 成功
    expect(names(g, 0, 'hand')).toContain('黑桃8');
    expect(names(g, 0, 'exp')).toContain('陷阱7');
  });

  it('力量爆破不再有「追擊判定失敗」：連擊值 9 在 2~4 範圍外，追擊成功', () => {
    const g = scenario({
      p0: { hand: ['黑桃2'], deck: ['力量爆破', ...filler] },
      p1: { hand: ['黑桃4'] },
    });
    pick(g, '黑桃4');
    expect(g.state.flags.pursuitSuccess[0]).toBe(1);
    expect(names(g, 0, 'exp')).toContain('力量爆破'); // 追擊卡在歸還步驟放進經驗區
  });
});

describe('出招效果', () => {
  it('黑暗詛咒：對手招式獲得「覆蓋我方 1 張經驗」', () => {
    const g = scenario({
      p0: { hand: ['黑暗詛咒'] },
      p1: { hand: ['黑桃9', '黑桃5'], exp: ['黑桃1'] },
    });
    expect(Z(g, 1, 'exp')[0].covered).toBe(false);
    pick(g, '黑桃9');
    expect(Z(g, 1, 'exp')[0].covered).toBe(true);
  });

  it('降級詛咒：蓋 2、怒 5，雙方各捨棄 1 張經驗', () => {
    const g = scenario({
      p0: { hand: ['降級詛咒'], exp: ['黑桃1', '黑桃2', '黑桃3'], rage: many('黑桃1', 5) },
      p1: { hand: ['黑桃9'], exp: ['黑桃4', '黑桃5'] },
    });
    expect(g.pending!.title).toContain('降級詛咒');
    pick(g, '發動');
    pick(g, '黑桃3'); // 玩家0 捨棄
    pick(g, '黑桃4'); // 玩家1 捨棄
    expect(names(g, 0, 'discard')).toContain('黑桃3');
    expect(names(g, 1, 'discard')).toContain('黑桃4');
    expect(Z(g, 0, 'rage')).toHaveLength(0);
  });

  it('必殺一擊：覺醒且怒 10 時此回合追擊 +1', () => {
    const g = scenario({
      p0: { hand: ['必殺一擊'], exp: many('黑桃1', 8), rage: many('黑桃1', 10) },
      p1: { hand: ['黑桃9'] },
    });
    expect(g.pending!.title).toContain('必殺一擊');
    pick(g, '發動');
    expect(g.state.flags.pursuitPlus[0]).toBe(1);
    expect(Z(g, 0, 'rage')).toHaveLength(0);
  });

  it('必殺一擊：未覺醒不會詢問', () => {
    const g = scenario({
      p0: { hand: ['必殺一擊'], exp: many('黑桃1', 3), rage: many('黑桃1', 10) },
      p1: { hand: ['黑桃9'] },
    });
    expect(g.pending!.title).not.toContain('必殺一擊');
  });

  it('快速治療：蓋 3 回復 3', () => {
    const g = scenario({
      p0: { hand: ['快速治療'], exp: ['黑桃1', '黑桃2', '黑桃3'], rage: many('黑桃1', 4) },
      p1: { hand: [] },
    });
    pick(g, '發動');
    expect(Z(g, 0, 'rage')).toHaveLength(1);
    expect(Z(g, 0, 'exp').filter((c) => c.covered)).toHaveLength(3);
  });

  it('布局：蓋 2，捨棄 1 張手牌並把棄牌區 1 張卡放到牌組頂', () => {
    const g = scenario({
      p0: { hand: ['布局', '黑桃2'], exp: ['黑桃1', '黑桃3'], discard: ['黑桃9'] },
      p1: { hand: ['黑桃8'] },
    });
    pick(g, '布局');
    pick(g, '發動');
    pick(g, '黑桃9');
    expect(Z(g, 0, 'deck')[0].id).toBe('黑桃9');
    expect(names(g, 0, 'discard')).toContain('黑桃2');
  });

  it('777：牌頂連擊值不同則捨棄；相同則保留', () => {
    const diff = scenario({
      p0: { hand: ['黑桃2', '777'], deck: ['黑桃1', ...filler] },
      p1: { hand: ['黑桃9'], deck: ['黑桃2', ...filler] },
    });
    pick(diff, '黑桃9');
    pick(diff, '777');
    expect(names(diff, 0, 'discard')).toContain('777');

    const same = scenario({
      p0: { hand: ['黑桃2', '777'], deck: ['黑桃1', ...filler] },
      p1: { hand: ['黑桃9'], deck: ['梅花1', ...filler] },
    });
    pick(same, '黑桃9');
    pick(same, '777');
    expect(names(same, 0, 'discard')).not.toContain('777');
  });

  it('陷阱投擲／陷阱回收／陷阱窟', () => {
    const throwing = scenario({ p0: { hand: ['陷阱投擲', '陷阱5'] }, p1: { hand: [] } });
    pick(throwing, '陷阱投擲');
    expect(names(throwing, 0, 'exp')).toContain('陷阱5');

    const recycle = scenario({
      p0: { hand: ['陷阱回收'], discard: ['陷阱3'], rage: many('黑桃1', 4) },
      p1: { hand: [] },
    });
    pick(recycle, '發動');
    expect(names(recycle, 0, 'hand')).toContain('陷阱3');

    const cave = scenario({
      p0: { hand: ['陷阱窟'], exp: ['陷阱3', '陷阱4', '黑桃1'], rage: many('黑桃1', 10) },
      p1: { hand: ['黑桃9'] },
    });
    pick(cave, '發動');
    expect(names(cave, 0, 'combat')).toEqual(expect.arrayContaining(['陷阱3', '陷阱4', '陷阱窟']));
    expect(names(cave, 0, 'exp')).toEqual(['黑桃1']);
  });

  it('狙擊印記：之後打出持有[發]的招式時，抽 1 張怒氣卡再捨棄 1 張手牌', () => {
    const g = scenario({
      p0: { hand: ['狙擊印記', '快速治療', '黑桃2'], rage: ['黑桃1'] },
      p1: { hand: ['黑桃9'] },
    });
    pick(g, '狙擊印記');
    pick(g, '黑桃9');
    pick(g, '快速治療');
    expect(g.pending!.title).toContain('狙擊印記');
    pick(g, '黑桃1');
    expect(names(g, 0, 'discard')).toContain('黑桃1');
  });

  it('不變應萬變：對手受到傷害較多時回合結束不交換先後攻', () => {
    const g = scenario({ p0: { hand: ['不變應萬變'] }, p1: { hand: [] } });
    expect(g.state.flags.noSwap).toBe(true);
    skipToTurn(g, 2);
    expect(g.state.turn).toBe(2);
    expect(g.state.first).toBe(0);
  });

  it('一般情況回合結束會交換先後攻', () => {
    const g = scenario({ p0: { hand: ['黑桃5'] }, p1: { hand: [] } });
    skipToTurn(g, 2);
    expect(g.state.first).toBe(1);
  });
});

describe('裝備與增益、角色', () => {
  it('金手鐲：爆發階段開始時蓋 2，爆發改為抽 3', () => {
    const g = scenario({
      p0: { hand: ['黑桃5'], gear: ['金手鐲'], exp: ['黑桃1', '黑桃2'] },
      p1: { hand: [] },
    });
    expect(g.pending!.title).toContain('金手鐲');
    pick(g, '發動');
    pick(g, '黑桃1'); // 爆發：把抽牌階段抽到的牌放入經驗區
    expect(Z(g, 0, 'hand')).toHaveLength(3);
  });

  it('月光劍：增益階段開始時打開 1 張覆蓋的經驗卡', () => {
    const g = scenario({
      p0: { hand: ['黑桃5'], gear: ['月光劍'], exp: ['~黑桃1'] },
      p1: { hand: [] },
    });
    skipToTurn(g, 2);
    expect(Z(g, 0, 'exp')[0].covered).toBe(false);
  });

  it('慢速治癒：增益階段開始時回復 2；持續時間到就放入經驗區', () => {
    const g = scenario({
      p0: { hand: ['黑桃5'], buff: ['慢速治癒'], rage: many('黑桃1', 3) },
      p1: { hand: [] },
    });
    Z(g, 0, 'buff')[0].counters = 3;
    skipToTurn(g, 2);
    expect(Z(g, 0, 'rage')).toHaveLength(1);
    expect(Z(g, 0, 'buff')).toHaveLength(0);
    expect(names(g, 0, 'exp')).toContain('慢速治癒');
  });

  it('增益階段：經驗不足不能打出裝備；滿足後可打出且同部位只能 1 張', () => {
    const lack = scenario({
      // 起始 4 張，打出的黑桃5 歸還後共 5 張，仍低於月光劍需求 6
      p0: { hand: ['黑桃5', '月光劍'], exp: many('黑桃1', 4) },
      p1: { hand: [] },
    });
    let asked = false;
    for (let i = 0; i < 50 && lack.pending && lack.state.turn < 2; i++) {
      if (lack.pending.title.includes('增益階段')) asked = true;
      lack.submit(lack.pending.player, lack.pending.options.slice(0, lack.pending.min).map((o) => o.key));
    }
    expect(asked).toBe(false);

    const ok = scenario({
      p0: { hand: ['黑桃5', '月光劍'], exp: many('黑桃1', 6) },
      p1: { hand: [] },
    });
    for (let i = 0; i < 20 && ok.pending && !ok.pending.title.includes('增益階段'); i++) {
      ok.submit(ok.pending.player, ok.pending.options.slice(0, ok.pending.min).map((o) => o.key));
    }
    pick(ok, '月光劍');
    expect(names(ok, 0, 'gear')).toEqual(['月光劍']);
  });

  it('法師：起始手牌額外抽 3（共 8 張）', () => {
    const g = scenario({ chars: ['法師', '勇者'] });
    // 起始 8 張；第一個提示為起手出招，手牌尚未減少
    expect(Z(g, 0, 'hand')).toHaveLength(8);
    expect(Z(g, 1, 'hand')).toHaveLength(5);
  });

  it('法師覺醒：抽牌階段額外抽怒氣區 1 張', () => {
    const g = scenario({
      chars: ['法師', '勇者'],
      p0: { hand: ['黑桃5'], exp: many('黑桃1', 8), rage: ['黑桃2'] },
      p1: { hand: [] },
    });
    expect(names(g, 0, 'hand')).toContain('黑桃2');
    expect(Z(g, 0, 'hand')).toHaveLength(2);
  });

  it('刺客：每次追擊判定成功攻擊 +1（覺醒 +2），合計最多 +5', () => {
    const g = scenario({ chars: ['刺客', '勇者'] });
    const base = atkOf('黑桃1');
    g.state.flags.pursuitSuccess[0] = 2;
    setCombat(g);
    expect(attack(g)).toBe(base + 2);
    g.state.flags.pursuitSuccess[0] = 7; // 超過上限
    expect(attack(g)).toBe(base + 5);
    setZones(g, 0, { combat: ['黑桃1'], exp: Array(8).fill('黑桃1') }); // 覺醒
    g.state.flags.pursuitSuccess[0] = 2;
    expect(attack(g)).toBe(base + 4);
    g.state.flags.pursuitSuccess[0] = 4;
    expect(attack(g)).toBe(base + 5);
  });
});

import { totalAtk } from '../src/engine/combat';
import { atkOf, setZones } from './helpers';
function setCombat(g: Game) {
  setZones(g, 0, { combat: ['黑桃1'] });
}
const attack = (g: Game) => totalAtk(g, 0);
