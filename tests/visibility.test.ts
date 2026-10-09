import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '../src/data/cards';
import { cardOpt, Z } from '../src/engine/ops';
import { viewFor } from '../src/engine/view';
import type { ZoneName } from '../src/engine/types';
import { faceVisibleTo } from '../src/engine/visibility';
import { scenario } from './helpers';

const GEAR = ALL_CARDS.find((c) => c.kind === 'equip')!.id;
// 目前卡表沒有增益卡；區域只看卡在哪裡，放任何一張招式即可
const BUFF = '黑桃9';

// 玩家 0 的各區域各放一張；經驗區另外放一張裏側的
const g = scenario({
  p0: {
    hand: ['黑桃1', '黑桃8'], rage: ['黑桃2'], discard: ['黑桃3'], moves: ['黑桃4'], pursuit: ['黑桃5'],
    exp: ['黑桃6', '~黑桃7'], buff: [BUFF], gear: [GEAR],
  },
});
const card = (zone: ZoneName, i = 0) => Z(g, 0, zone)[i];

describe('牌面可見性', () => {
  it('手牌與怒氣區只有擁有者看得到牌面', () => {
    for (const zone of ['hand', 'rage'] as const) {
      expect(faceVisibleTo(card(zone), 0)).toBe(true);
      expect(faceVisibleTo(card(zone), 1)).toBe(false);
    }
  });

  it('經驗區：表側的卡雙方都看得到，裏側的卡只有擁有者看得到', () => {
    expect(faceVisibleTo(card('exp', 0), 0)).toBe(true);
    expect(faceVisibleTo(card('exp', 0), 1)).toBe(true);
    expect(faceVisibleTo(card('exp', 1), 0)).toBe(true);
    expect(faceVisibleTo(card('exp', 1), 1)).toBe(false);
  });

  it('牌組只有擁有者看得到', () => {
    expect(faceVisibleTo(card('deck'), 0)).toBe(true);
    expect(faceVisibleTo(card('deck'), 1)).toBe(false);
  });

  it('棄牌區、戰鬥區、追擊卡、裝備、增益是公開的', () => {
    for (const zone of ['discard', 'moves', 'pursuit', 'gear', 'buff'] as const) {
      expect(faceVisibleTo(card(zone), 0)).toBe(true);
      expect(faceVisibleTo(card(zone), 1)).toBe(true);
    }
  });

  it('視角用這條規則：每個區域、每位觀看者，視角裡的牌面有無都與判斷一致', () => {
    for (const viewer of [0, 1] as const) {
      const pv = viewFor(g, viewer).players[0];
      for (const zone of ['hand', 'rage', 'exp', 'discard', 'moves', 'pursuit', 'gear', 'buff'] as const) {
        expect(pv[zone].length).toBeGreaterThan(0);
        pv[zone].forEach((c, i) => expect(c.id !== null).toBe(faceVisibleTo(Z(g, 0, zone)[i], viewer)));
      }
    }
  });

  it('提示選項用這條規則：每個區域、每位觀看者', () => {
    for (const zone of ['hand', 'rage', 'exp', 'discard', 'deck'] as const) {
      Z(g, 0, zone).forEach((c) => {
        for (const viewer of [0, 1] as const) expect(!cardOpt(c, viewer).hidden).toBe(faceVisibleTo(c, viewer));
      });
    }
  });

  it('提示選項：看不到牌面的只有位置，看得到的帶牌面與卡名', () => {
    expect(cardOpt(card('exp', 1), 1)).toMatchObject({ label: '?', hidden: true, uid: card('exp', 1).uid });
    expect(cardOpt(card('exp', 1), 1).cardId).toBeUndefined();
    expect(cardOpt(card('exp', 1), 0)).toMatchObject({ cardId: '黑桃7', label: '黑桃7' });
    expect(cardOpt(card('hand'), 0, '就用這張')).toMatchObject({ cardId: '黑桃1', label: '就用這張' });
  });
});
