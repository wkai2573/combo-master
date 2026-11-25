import { describe, expect, it } from 'vitest';
import { getCard } from '../src/data/cards';
import { ENABLED_EFFECT_CARDS } from '../src/data/enabledCards';
import { presetDeck } from '../src/data/presetDecks';
import { pursuitCount, totalAtk, totalDef } from '../src/engine/combat';
import { hasEffect, query } from '../src/engine/effects';
import { move, Z } from '../src/engine/ops';
import { faceVisibleTo } from '../src/engine/visibility';
import { atkOf, defOf, names, pick, scenario, title } from './helpers';

const filler = Array(20).fill('黑桃4') as string[];
const log = (g: ReturnType<typeof scenario>) => g.state.log.join('\n');
const ids = (g: ReturnType<typeof scenario>, p: 0 | 1, z: Parameters<typeof Z>[2]) => Z(g, p, z).map((c) => `${c.covered ? '~' : ''}${c.id}`);

describe('卡表資料與登記（盛怒漩渦、狂戰）', () => {
  it('卡表數值與開放清單', () => {
    expect(getCard('盛怒漩渦')).toMatchObject({ cls: '劍士', atk: 4, def: 2, combo: 1, traits: ['攻擊'] });
    expect(getCard('狂戰')).toMatchObject({ cls: '劍士', atk: 3, def: 3, combo: 8, traits: ['變化'] });
    for (const id of ['盛怒漩渦', '狂戰']) {
      expect(ENABLED_EFFECT_CARDS, id).toContain(id);
      expect(hasEffect(id), id).toBe(true);
    }
  });

  it('預設牌組：劍士（勇者、後人）各放 3 張，其他職業不放', () => {
    for (const char of ['勇者', '後人']) {
      for (const id of ['盛怒漩渦', '狂戰']) expect(presetDeck(char).filter((c) => c === id), `${char} ${id}`).toHaveLength(3);
    }
    for (const char of ['刺客', '先人', '商人', '遊俠', '法師']) expect(presetDeck(char).join()).not.toMatch(/盛怒漩渦|狂戰/);
  });
});

describe('盛怒漩渦 [發]：選擇棄牌區 3 張卡放到怒氣區頂', () => {
  const play = (discard: string[], rage: string[] = ['黑桃9']) =>
    scenario({ chars: ['勇者', '刺客'], first: 0, p0: { hand: ['盛怒漩渦'], discard, rage, deck: filler }, p1: { hand: ['黑桃5'] }, singlePhase: true });

  it('棄牌區 4 張，選 3 張放到怒氣區頂，沒有費用，沒選的留在棄牌區', () => {
    const g = play(['黑桃1', '黑桃2', '黑桃3', '黑桃5']);
    expect(title(g)).toContain('盛怒漩渦');
    pick(g, '黑桃1', '黑桃3', '黑桃5');
    expect(Z(g, 0, 'rage')).toHaveLength(4);
    expect(ids(g, 0, 'discard')).toEqual(['黑桃2']);
    expect(ids(g, 0, 'exp')).toEqual([]); // 沒有蓋牌費用
    // 放進去的 3 張在怒氣區頂，原本的黑桃9 在最下面
    expect(Z(g, 0, 'rage').at(-1)!.id).toBe('黑桃9');
  });

  it('棄牌區剛好 3 張時全放進去，不用再選', () => {
    const g = play(['黑桃1', '黑桃2', '黑桃3']);
    expect(Z(g, 0, 'rage')).toHaveLength(4);
    expect(ids(g, 0, 'discard')).toEqual([]);
  });

  it('棄牌區不足 3 張時有幾張放幾張', () => {
    const g = play(['黑桃1', '黑桃2']);
    expect(Z(g, 0, 'rage')).toHaveLength(3);
    expect(ids(g, 0, 'discard')).toEqual([]);
  });

  it('棄牌區沒有牌時什麼都不發生，也不詢問', () => {
    const g = play([]);
    expect(title(g)).not.toContain('盛怒漩渦');
    expect(Z(g, 0, 'rage')).toHaveLength(1);
  });

  it('放進怒氣區的牌誰都看不到牌面，紀錄只寫張數', () => {
    const g = play(['伏擊', '塗毒', '毒藥']);
    for (const card of Z(g, 0, 'rage')) for (const viewer of [0, 1] as const) expect(faceVisibleTo(card, viewer)).toBe(false);
    for (const secret of ['伏擊', '塗毒', '毒藥']) expect(log(g)).not.toContain(secret);
    expect(log(g)).toContain('放到怒氣區頂');
  });

  it('只動棄牌區的牌：怒氣區與棄牌區的總張數不變', () => {
    const g = play(['黑桃1', '黑桃2', '黑桃3', '黑桃5']);
    pick(g, '黑桃1', '黑桃2', '黑桃3');
    expect(Z(g, 0, 'rage').length + Z(g, 0, 'discard').length).toBe(1 + 4);
  });
});

describe('狂戰 [經]：我方 +X+0，X＝我方戰鬥區的招式數量', () => {
  // 對方手上留一張可出的牌，讓對局停在反擊步驟，招式還在戰鬥區時讀總攻擊與總防禦
  const stats = (exp: string[], moves: string[], pursuit: string[] = []) =>
    scenario({ chars: ['勇者', '刺客'], first: 0, p0: { exp, moves, pursuit, hand: [] }, p1: { hand: ['黑桃9'] }, singlePhase: true });

  it('表側在經驗區時，戰鬥區每 1 張招式（含追擊卡疊）加 1 總攻擊，不加防禦', () => {
    const g = stats(['狂戰'], ['黑桃3', '黑桃5'], ['黑桃9']);
    expect(totalAtk(g, 0)).toBe(atkOf('黑桃3') + atkOf('黑桃5') + atkOf('黑桃9') + 3);
    expect(totalDef(g, 0)).toBe(defOf('黑桃3') + defOf('黑桃5'));
  });

  it('戰鬥區沒有招式時沒有加成', () => {
    const g = stats(['狂戰'], []);
    expect(totalAtk(g, 0)).toBe(0);
  });

  it('只加我方，對方不受影響', () => {
    const g = stats(['狂戰'], ['黑桃3']);
    expect(query(g, 1, 'flatAtk')).toBe(0);
  });

  it('兩張狂戰各加一次', () => {
    const g = stats(['狂戰', '狂戰'], ['黑桃3', '黑桃5']);
    expect(totalAtk(g, 0)).toBe(atkOf('黑桃3') + atkOf('黑桃5') + 4);
  });

  it('被蓋成裏側就沒有加成，翻回表側就恢復', () => {
    const g = stats(['~狂戰'], ['黑桃3', '黑桃5']);
    expect(totalAtk(g, 0)).toBe(atkOf('黑桃3') + atkOf('黑桃5'));
    Z(g, 0, 'exp')[0].covered = false;
    expect(totalAtk(g, 0)).toBe(atkOf('黑桃3') + atkOf('黑桃5') + 2);
  });

  it('不在經驗區（在棄牌區、怒氣區、牌組）就沒有加成', () => {
    const g = scenario({ chars: ['勇者', '刺客'], first: 0, p0: { hand: [], discard: ['狂戰'], rage: ['狂戰'], deck: ['狂戰', ...filler], moves: ['黑桃3'] }, p1: { hand: ['黑桃9'] }, singlePhase: true });
    expect(totalAtk(g, 0)).toBe(atkOf('黑桃3'));
  });
});

describe('狂戰 [經]：我方戰鬥區卡片效果全部無效', () => {
  it('[頂] 的數值修正不作用：戒備打擊在最上方的 +1+2 沒有了，只剩卡面與狂戰自己的加成', () => {
    const withTrap = (exp: string[]) =>
      scenario({ chars: ['勇者', '刺客'], first: 0, p0: { exp, moves: ['黑桃3', '戒備打擊'], hand: [] }, p1: { hand: ['黑桃9'] }, singlePhase: true });
    const plain = withTrap([]);
    expect(totalAtk(plain, 0)).toBe(atkOf('黑桃3') + atkOf('戒備打擊') + 1);
    expect(totalDef(plain, 0)).toBe(defOf('黑桃3') + defOf('戒備打擊') + 2);
    const berserk = withTrap(['狂戰']);
    expect(totalAtk(berserk, 0)).toBe(atkOf('黑桃3') + atkOf('戒備打擊') + 2); // 狂戰 +2（戰鬥區 2 張）
    expect(totalDef(berserk, 0)).toBe(defOf('黑桃3') + defOf('戒備打擊'));
  });

  it('盾擊在最上方時，不再把攻擊力補到原始防禦力', () => {
    const withShield = (exp: string[]) =>
      scenario({ chars: ['勇者', '刺客'], first: 0, p0: { exp, moves: ['黑桃3', '盾擊'], hand: [] }, p1: { hand: ['黑桃9'] }, singlePhase: true });
    const lifted = totalAtk(withShield([]), 0);
    const voided = totalAtk(withShield(['狂戰']), 0);
    expect(lifted).toBe(Math.max(atkOf('黑桃3'), defOf('黑桃3')) + Math.max(atkOf('盾擊'), defOf('盾擊')));
    expect(voided).toBe(atkOf('黑桃3') + atkOf('盾擊') + 2);
  });

  it('[追] 的加成不作用：追擊卡疊的地雷陷阱沒有 +4 攻擊', () => {
    const withMine = (exp: string[]) =>
      scenario({ chars: ['遊俠', '刺客'], first: 0, p0: { exp, moves: ['黑桃3'], pursuit: ['地雷陷阱'], hand: [] }, p1: { hand: ['黑桃9'] }, singlePhase: true });
    expect(totalAtk(withMine([]), 0)).toBe(atkOf('黑桃3') + atkOf('地雷陷阱') + 4);
    expect(totalAtk(withMine(['狂戰']), 0)).toBe(atkOf('黑桃3') + atkOf('地雷陷阱') + 2);
  });

  it('頂部的其他效果也不作用：二刀連擊的追擊 +1 沒有了', () => {
    const withCombo = (exp: string[]) =>
      scenario({ chars: ['刺客', '勇者'], first: 0, p0: { exp, moves: ['二刀連擊'], hand: [] }, p1: { hand: ['黑桃9'] }, singlePhase: true });
    expect(pursuitCount(withCombo([]), 0)).toBe(2);
    expect(pursuitCount(withCombo(['狂戰']), 0)).toBe(1);
  });

  it('[發] 不作用：熔岩之擊付得起怒3 也不出現發動提示，對方沒有被直擊', () => {
    const play = (exp: string[]) =>
      scenario({ chars: ['勇者', '刺客'], first: 0, p0: { hand: ['熔岩之擊'], exp, rage: Array(5).fill('黑桃1'), deck: filler }, p1: { hand: ['黑桃5'], deck: filler }, singlePhase: true });
    expect(title(play([]))).toContain('熔岩之擊');
    const g = play(['狂戰']);
    expect(title(g)).not.toContain('熔岩之擊');
    expect(Z(g, 1, 'discard')).toHaveLength(0);
    expect(Z(g, 0, 'rage')).toHaveLength(5);
  });

  it('[頂] 的出招時效果不作用：威嚇戰吼在最上方也不直擊', () => {
    const foePlays = (exp: string[]) =>
      scenario({
        chars: ['勇者', '刺客'], first: 0,
        p0: { exp, moves: ['威嚇戰吼'], rage: Array(9).fill('黑桃1'), hand: [] },
        p1: { hand: ['黑桃5'], deck: Array(4).fill('黑桃2') },
        singlePhase: true,
      });
    const normal = foePlays([]);
    pick(normal, '黑桃5');
    expect(Z(normal, 1, 'discard').length).toBeGreaterThan(0);
    const g = foePlays(['狂戰']);
    pick(g, '黑桃5');
    expect(Z(g, 1, 'discard')).toHaveLength(0);
  });

  it('不影響經驗區的效果：凡骨的意志照常加成', () => {
    const g = scenario({ chars: ['勇者', '刺客'], first: 0, p0: { exp: ['狂戰', '凡骨的意志'], moves: ['黑桃3', '黑桃5'], hand: [] }, p1: { hand: ['黑桃9'] }, singlePhase: true });
    expect(totalAtk(g, 0)).toBe(atkOf('黑桃3') + atkOf('黑桃5') + 2 + 2); // 狂戰 +2、凡骨 +2（白板卡 2 張）
  });

  it('不影響裝備與增益：家族相片照常可發動，Ex-白虎的 +2 照常算', () => {
    const g = scenario({ chars: ['勇者', '刺客'], phase: '回合開始', singlePhase: true, first: 0,
      p0: { exp: ['狂戰', '黑桃3', '黑桃4'], gear: ['家族相片'], buff: ['Ex-白虎'], rage: Array(6).fill('黑桃1'), deck: filler, hand: [] }, p1: { hand: [] } });
    expect(title(g)).toContain('家族相片');
    expect(query(g, 0, 'flatAtk')).toBe(2);
  });

  it('只管我方：對方戰鬥區的卡片效果照常', () => {
    const g = scenario({ chars: ['勇者', '刺客'], first: 0, p0: { exp: ['狂戰'], moves: ['黑桃3'], hand: [] }, p1: { moves: ['戒備打擊'], hand: ['黑桃4'] }, singlePhase: true });
    expect(totalAtk(g, 1)).toBe(atkOf('戒備打擊') + 1);
    expect(totalDef(g, 1)).toBe(defOf('戒備打擊') + 2);
  });

  it('被蓋成裏側後全部恢復，翻回表側又無效', () => {
    const g = scenario({ chars: ['勇者', '刺客'], first: 0, p0: { exp: ['~狂戰'], moves: ['黑桃3', '戒備打擊'], hand: [] }, p1: { hand: ['黑桃9'] }, singlePhase: true });
    expect(query(g, 0, 'combatEffectsVoid')).toBe(false);
    expect(totalAtk(g, 0)).toBe(atkOf('黑桃3') + atkOf('戒備打擊') + 1);
    Z(g, 0, 'exp')[0].covered = false;
    expect(query(g, 0, 'combatEffectsVoid')).toBe(true);
    expect(totalAtk(g, 0)).toBe(atkOf('黑桃3') + atkOf('戒備打擊') + 2);
  });

  it('狂戰離開經驗區（捨棄到棄牌區）後效果恢復', () => {
    const g = scenario({ chars: ['勇者', '刺客'], first: 0, p0: { exp: ['狂戰'], moves: ['黑桃3', '戒備打擊'], hand: [] }, p1: { hand: ['黑桃9'] }, singlePhase: true });
    expect(query(g, 0, 'combatEffectsVoid')).toBe(true);
    move(g, Z(g, 0, 'exp')[0], 'discard');
    expect(query(g, 0, 'combatEffectsVoid')).toBe(false);
  });
});

describe('狂戰 [經]：傷害計算後，未受傷時將此卡蓋為裏側', () => {
  it.each([false, true])('依對方是否造成傷害決定要不要蓋為裏側（有傷害：%s）', (attacks) => {
    const g = scenario({
      chars: ['勇者', '法師'], first: 0, singlePhase: true,
      p0: { exp: ['狂戰', '狂戰'], rage: ['黑桃1'], deck: filler, hand: [] },
      p1: { hand: attacks ? ['力量爆破'] : [] },
    });
    if (attacks) pick(g, '力量爆破');
    const damage = g.state.flags.damageTaken[0];
    expect(damage > 0).toBe(attacks);
    expect(ids(g, 0, 'exp')).toEqual(damage > 0 ? ['狂戰', '狂戰'] : ['~狂戰', '~狂戰']);
    expect(query(g, 0, 'combatEffectsVoid')).toBe(damage > 0);
    expect(Z(g, 0, 'rage')).toHaveLength(1 + damage);
  });
});
