import { describe, expect, it } from 'vitest';
import { getCard } from '../src/data/cards';
import { isClassCard } from '../src/data/enabledCards';
import { Z } from '../src/engine/ops';
import { names, pick, scenario } from './helpers';

const sorted = (xs: string[]) => [...xs].sort();

describe('職業卡', () => {
  it('職業欄不是共用的卡才算職業卡', () => {
    expect(isClassCard(getCard('戒備打擊'))).toBe(true);
    expect(isClassCard(getCard('公開資訊'))).toBe(true);
    expect(isClassCard(getCard('黑桃1'))).toBe(false);
    expect(isClassCard(getCard('生命藥水'))).toBe(false);
    expect(isClassCard(getCard('木棍'))).toBe(false);
  });
});

describe('職業專精書：[發_蓋1] 看牌組上方 5 張卡，選擇其中 1 張職業卡加入手牌，其餘隨機放到牌組底', () => {
  const book = (deck: string[]) =>
    scenario({
      chars: ['勇者', '刺客'],
      singlePhase: true,
      p0: { hand: ['職業專精書', '黑桃2'], exp: ['黑桃3', '黑桃4'], deck },
      p1: { hand: [] },
    });
  const FILL = Array.from({ length: 20 }, () => '黑桃1');

  it('從上方 5 張選 1 張職業卡加入手牌，其餘 4 張放到牌組底，生命值少 1', () => {
    const g = book(['戒備打擊', '黑桃5', '黑桃6', '黑桃7', '盾擊', ...FILL]);
    pick(g, '職業專精書');
    pick(g, '發動');
    pick(g, '盾擊');
    expect(names(g, 0, 'hand')).toContain('盾擊');
    expect(names(g, 0, 'hand')).not.toContain('戒備打擊');
    expect(Z(g, 0, 'deck')).toHaveLength(24); // 25 張 − 加入手牌的 1 張
    expect(sorted(names(g, 0, 'deck').slice(-4))).toEqual(sorted(['戒備打擊', '黑桃5', '黑桃6', '黑桃7']));
  });

  it('上方 5 張沒有職業卡：不加入手牌，5 張全部隨機放到牌組底', () => {
    const g = book(['黑桃5', '黑桃6', '黑桃7', '黑桃8', '黑桃9', ...FILL]);
    const handBefore = Z(g, 0, 'hand').length;
    pick(g, '職業專精書');
    pick(g, '發動');
    expect(Z(g, 0, 'hand')).toHaveLength(handBefore - 1); // 只有打出的那張離開手牌
    expect(Z(g, 0, 'deck')).toHaveLength(25);
    expect(sorted(names(g, 0, 'deck').slice(-5))).toEqual(sorted(['黑桃5', '黑桃6', '黑桃7', '黑桃8', '黑桃9']));
  });

  it('只看上方 5 張：第 6 張就算是職業卡也不能選', () => {
    const g = book(['黑桃5', '黑桃6', '黑桃7', '黑桃8', '黑桃9', '戒備打擊', ...FILL]);
    pick(g, '職業專精書');
    pick(g, '發動');
    expect(names(g, 0, 'hand')).not.toContain('戒備打擊');
    expect(Z(g, 0, 'deck')).toHaveLength(26);
  });

  it('牌組不足 5 張時看全部剩下的卡；只有 1 張職業卡就直接取得', () => {
    const g = book(['黑桃5', '戒備打擊', '黑桃6']);
    pick(g, '職業專精書');
    pick(g, '發動');
    expect(names(g, 0, 'hand')).toContain('戒備打擊');
    expect(sorted(names(g, 0, 'deck'))).toEqual(sorted(['黑桃5', '黑桃6']));
  });

  it('表側經驗不足 1 張付不起蓋1：沒有發動的詢問', () => {
    const g = scenario({
      chars: ['勇者', '刺客'],
      singlePhase: true,
      p0: { hand: ['職業專精書', '黑桃2'], exp: [], deck: ['戒備打擊', ...FILL] },
      p1: { hand: [] },
    });
    pick(g, '職業專精書');
    expect(g.pending?.title ?? '').not.toContain('職業專精書');
    expect(Z(g, 0, 'deck')[0].id).toBe('戒備打擊');
  });
});
