import { describe, expect, it } from 'vitest';
import { cardOpt, Z } from '../src/engine/ops';
import type { ZoneName } from '../src/engine/types';
import { faceVisibleTo } from '../src/engine/visibility';
import { scenario } from './helpers';

// 玩家 0 的各區域各放一張；經驗區另外放一張裏側的
const g = scenario({
  p0: {
    hand: ['黑桃1', '黑桃8'], rage: ['黑桃2'], discard: ['黑桃3'], combat: ['黑桃4'], pursuit: ['黑桃5'],
    exp: ['黑桃6', '~黑桃7'], buff: [], gear: [],
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

  it('棄牌區、戰鬥區、追擊卡是公開的', () => {
    for (const zone of ['discard', 'combat', 'pursuit'] as const) {
      expect(faceVisibleTo(card(zone), 0)).toBe(true);
      expect(faceVisibleTo(card(zone), 1)).toBe(true);
    }
  });

  it('視角與提示選項用同一條規則', () => {
    for (const zone of ['hand', 'rage', 'exp', 'discard'] as const) {
      Z(g, 0, zone).forEach((c) => {
        for (const viewer of [0, 1] as const) {
          const seenInOpt = !cardOpt(c, viewer).hidden;
          expect(seenInOpt).toBe(faceVisibleTo(c, viewer));
        }
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
