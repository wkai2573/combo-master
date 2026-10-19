import { describe, expect, it } from 'vitest';
import { getCard } from '../src/data/cards';
import { ENABLED_EFFECT_CARDS } from '../src/data/enabledCards';
import { EX_LEAVE_RULES } from '../src/data/exCards';
import { presetDeck } from '../src/data/presetDecks';
import { totalAtk } from '../src/engine/combat';
import { exZoneOf, hasEffect, hasExpEffect } from '../src/engine/effects';
import { awakened, Z } from '../src/engine/ops';
import { viewFor } from '../src/engine/view';
import { buffCounter } from '../src/ui/components/CardFace';
import { atkOf, names, pick, scenario, setZones } from './helpers';

const exRage = (g: ReturnType<typeof scenario>, p: 0 | 1 = 0) => Z(g, p, 'buff').filter((c) => c.id === 'Ex-狂怒');

describe('狂怒與 Ex-狂怒：卡表資料與登記', () => {
  it('狂怒是盜賊招式 3／4／5（攻擊、充能）已開放；Ex-狂怒是充能特徵、持續回合 2', () => {
    expect(getCard('狂怒')).toMatchObject({ cls: '盜賊', kind: 'move', atk: 3, def: 4, combo: 5, traits: ['攻擊', '充能'] });
    expect(ENABLED_EFFECT_CARDS).toContain('狂怒');
    expect(getCard('Ex-狂怒')).toMatchObject({ traits: ['充能'], duration: 2 });
    expect(getCard('Ex-狂怒').text).toContain(EX_LEAVE_RULES.buff);
  });

  it('效果來源都有登記：狂怒在招式卡疊，Ex-狂怒在增益區（不是經驗效果）', () => {
    expect(hasEffect('狂怒')).toBe(true);
    expect(hasEffect('Ex-狂怒')).toBe(true);
    expect(exZoneOf('Ex-狂怒')).toBe('buff');
    expect(exZoneOf('Ex-中毒')).toBe('exp');
    expect(hasExpEffect('Ex-狂怒')).toBe(false);
  });

  it('預設牌組：刺客與先人各放 3 張狂怒，其他職業沒有', () => {
    for (const id of ['刺客', '先人']) expect(presetDeck(id).filter((c) => c === '狂怒'), id).toHaveLength(3);
    for (const id of ['勇者', '後人', '商人', '遊俠', '法師']) expect(presetDeck(id)).not.toContain('狂怒');
  });
});

describe('狂怒 [發_蓋2]：將 1 張 Ex-狂怒 放入我方增益區', () => {
  const play = (exp: string[]) =>
    scenario({ chars: ['刺客', '勇者'], singlePhase: true, p0: { hand: ['狂怒'], exp }, p1: { hand: [] } });

  it('付得起蓋2 才詢問，發動後蓋住最前面的 2 張，Ex-狂怒當回合就在增益區、指示物 0', () => {
    const g = play(['黑桃1', '黑桃3', '黑桃4']);
    expect(g.pending!.title).toContain('狂怒');
    pick(g, '發動');
    expect(exRage(g)).toHaveLength(1);
    expect(exRage(g)[0].counters).toBe(0);
    expect(Z(g, 0, 'exp').slice(0, 2).map((c) => c.covered)).toEqual([true, true]);
    expect(names(g, 0, 'exp')).not.toContain('Ex-狂怒'); // 不進經驗區
    expect(g.state.log.join('\n')).toContain('Ex-狂怒');
  });

  it('不發動就什麼都不放；表側經驗不足 2 張時根本不詢問', () => {
    const no = play(['黑桃1', '黑桃3', '黑桃4']);
    pick(no, '不發動');
    expect(exRage(no)).toHaveLength(0);
    expect(Z(no, 0, 'exp').filter((c) => c.covered)).toHaveLength(0);

    const few = play(['黑桃1', '~黑桃3']);
    expect(few.pending?.title ?? '').not.toContain('狂怒');
    expect(exRage(few)).toHaveLength(0);
  });

  it('Ex-狂怒不算經驗區張數：經驗區張數與覺醒不受影響', () => {
    const g = play(['黑桃1', '黑桃3', '黑桃4']);
    pick(g, '發動');
    expect(Z(g, 0, 'exp').some((c) => c.id === 'Ex-狂怒')).toBe(false);
    expect(awakened(g, 0)).toBe(false);
  });

  it('再放入新的 Ex-狂怒時，增益區所有 Ex-狂怒的指示物歸零，張數疊加；不受同名增益只能 1 張限制', () => {
    const g = scenario({
      chars: ['刺客', '勇者'], singlePhase: true,
      p0: { hand: ['狂怒'], exp: ['黑桃1', '黑桃3'], buff: ['Ex-狂怒@1', 'Ex-狂怒@1'] }, p1: { hand: [] },
    });
    pick(g, '發動');
    expect(exRage(g).map((c) => c.counters)).toEqual([0, 0, 0]);
  });
});

describe('狂怒 [頂]：我方 +2X+0，X＝增益區的 Ex-狂怒張數', () => {
  const stack = (moves: string[], rage: number, extra: { pursuit?: string[] } = {}) => {
    const g = scenario({ chars: ['刺客', '勇者'] });
    setZones(g, 0, { moves, ...extra, buff: Array(rage).fill('Ex-狂怒') });
    return g;
  };

  it('位於招式卡疊最上方時，每張 Ex-狂怒 +2', () => {
    expect(totalAtk(stack(['黑桃1', '狂怒'], 0), 0)).toBe(atkOf('黑桃1') + atkOf('狂怒'));
    expect(totalAtk(stack(['黑桃1', '狂怒'], 1), 0)).toBe(atkOf('黑桃1') + atkOf('狂怒') + 2);
    expect(totalAtk(stack(['黑桃1', '狂怒'], 3), 0)).toBe(atkOf('黑桃1') + atkOf('狂怒') + 6);
  });

  it('被疊在下面或成為追擊卡時沒有加成', () => {
    expect(totalAtk(stack(['狂怒', '黑桃1'], 2), 0)).toBe(atkOf('狂怒') + atkOf('黑桃1'));
    expect(totalAtk(stack(['黑桃1'], 2, { pursuit: ['狂怒'] }), 0)).toBe(atkOf('黑桃1') + atkOf('狂怒'));
  });

  it('只算我方的增益區，對方的 Ex-狂怒不算', () => {
    const g = scenario({ chars: ['刺客', '勇者'] });
    setZones(g, 0, { moves: ['狂怒'] });
    setZones(g, 1, { buff: ['Ex-狂怒', 'Ex-狂怒'] });
    expect(totalAtk(g, 0)).toBe(atkOf('狂怒'));
  });
});

describe('Ex-狂怒的計時：增益階段開始時指示物 +1，到 2 時移除遊戲', () => {
  const buffPhase = (buff: string[], extra: { exp?: string[]; hand?: string[] } = {}) =>
    scenario({ chars: ['刺客', '勇者'], phase: '增益', singlePhase: true, p0: { buff, hand: [], ...extra }, p1: { hand: [] } });

  it('放置那回合不計；下一回合增益階段變 1，再下一回合變 2 時移除', () => {
    expect(exRage(buffPhase(['Ex-狂怒@0'])).map((c) => c.counters)).toEqual([1]);
    expect(exRage(buffPhase(['Ex-狂怒@1']))).toHaveLength(0);
  });

  it('到期時直接移除遊戲：不進經驗區、不進棄牌區，不算經驗區張數', () => {
    const g = buffPhase(['Ex-狂怒@1'], { exp: ['黑桃1', '黑桃2'] });
    expect(Z(g, 0, 'exp')).toHaveLength(2);
    expect(Z(g, 0, 'discard')).toHaveLength(0);
    expect(Z(g, 0, 'hand')).toHaveLength(0);
    expect(g.state.log.join('\n')).toContain('【Ex-狂怒】持續時間結束，移除遊戲');
  });

  it('多張 Ex-狂怒各自計時；雙方的增益區都會計時', () => {
    const g = scenario({
      chars: ['刺客', '刺客'], phase: '增益', singlePhase: true,
      p0: { buff: ['Ex-狂怒@1', 'Ex-狂怒@0'], hand: [] }, p1: { buff: ['Ex-狂怒@1'], hand: [] },
    });
    expect(exRage(g, 0).map((c) => c.counters)).toEqual([1]);
    expect(exRage(g, 1)).toHaveLength(0);
  });

  it('玩家不能從手牌打出 Ex-狂怒，增益階段也沒有它的選項', () => {
    const g = buffPhase(['Ex-狂怒@0'], { hand: ['黑桃1'] });
    expect(g.pending).toBeNull(); // 沒有可打出的裝備或增益
  });
});

describe('卸除鎧甲不能選增益區裡的 Ex-狂怒', () => {
  it('對方只有 Ex-狂怒時沒有可選的對象，不詢問', () => {
    const g = scenario({
      chars: ['刺客', '刺客'], singlePhase: true,
      p0: { hand: ['卸除鎧甲'], exp: ['黑桃1', '黑桃3'] }, p1: { hand: [], buff: ['Ex-狂怒'] },
    });
    expect(g.pending?.title ?? '').not.toContain('卸除鎧甲');
    expect(exRage(g, 1)).toHaveLength(1);
  });
});

describe('增益區的畫面', () => {
  it('雙方都看得到對方增益區的 Ex-狂怒與它的指示物', () => {
    const g = scenario({ chars: ['刺客', '勇者'], p0: { buff: ['Ex-狂怒@1'] } });
    const seen = viewFor(g, 1, false).players[0].buff;
    expect(seen.map((c) => [c.id, c.counters])).toEqual([['Ex-狂怒', 1]]);
  });

  it('顯示剩餘持續回合：持續回合 2，指示物 0 剩 2、指示物 1 剩 1；指示物 +1 時剩餘 −1', () => {
    expect(buffCounter('Ex-狂怒', 0)).toEqual({ counters: 2, counterDelta: undefined });
    expect(buffCounter('Ex-狂怒', 1, 1)).toEqual({ counters: 1, counterDelta: -1 });
    expect(buffCounter('家族相片', 0)).toEqual({ counters: 0, counterDelta: undefined }); // 沒有持續回合的卡照舊
  });
});
