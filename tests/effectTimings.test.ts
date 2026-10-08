import { describe, expect, it } from 'vitest';
import { query } from '../src/engine/effects';
import { Z } from '../src/engine/ops';
import { 凡骨狀態 } from '../src/engine/sources/swordsman';
import { 二連矢狀態, 狙擊印記狀態 } from '../src/engine/sources/archer';
import { 伏擊狀態, 順手牽羊狀態 } from '../src/engine/sources/thief';
import { Explosion狀態 } from '../src/engine/sources/mage';
import { pick, scenario } from './helpers';

/** 效果來源遷移時補的特徵測試：記錄遷移前就有的細節，確保搬家後不變 */
describe('電弧：抽 X，X 是對方戰鬥區的招式數量', () => {
  const activates = (g: ReturnType<typeof scenario>) => g.drainFrames().filter((f) => f.fx.type === 'activate');

  it('對方戰鬥區沒有招式時，什麼都不發生，也不錄發動影格', () => {
    const g = scenario({ chars: ['法師', '勇者'], first: 0, animate: true, p0: { hand: ['電弧', '黑桃1'] }, p1: { hand: [] } });
    pick(g, '電弧'); // 先手出招，對方戰鬥區還是空的
    expect(g.state.log.some((l) => l.includes('【電弧】抽'))).toBe(false);
    expect(activates(g)).toHaveLength(0);
  });

  it('對方戰鬥區有 1 張招式時，抽 1 再放 1 張手牌到牌組底，並錄發動影格', () => {
    const g = scenario({
      chars: ['勇者', '法師'], first: 0, animate: true,
      p0: { hand: ['黑桃5'] }, p1: { hand: ['電弧', '黑桃1'] },
    });
    // 先手只有 1 張可出，自動打出；輪到對方反擊
    g.drainFrames();
    pick(g, '電弧'); // 反擊步驟打出，對方（先手）的戰鬥區有 1 張
    expect(g.pending!.title).toContain('【電弧】選擇 1 張手牌放到牌組底');
    expect(Z(g, 1, 'hand')).toHaveLength(2);
    expect(activates(g)).toHaveLength(1);
  });
});

describe('卡離場後仍要生效的查詢', () => {
  // 這些效果的加成存在回合狀態槽，卡本身早已離開常駐位置，所以處理器要明寫 lasting
  it('凡骨的意志：蓋到自己之後，這回合的加成仍然算', () => {
    const g = scenario({ p0: { exp: [] } });
    凡骨狀態.of(g, 0).n = 1;
    expect(query(g, 0, 'vanillaBoost')).toBe(1);
  });

  it('二連矢：追擊卡歸還之後，這回合的追擊加成仍然算', () => {
    const g = scenario({ p0: { pursuit: [] } });
    二連矢狀態.of(g, 0).plus = 2;
    expect(query(g, 0, 'pursuitBonus')).toBe(2);
  });

  it('狙擊印記、伏擊、順手牽羊、Explosion!：卡離開戰鬥區後，這回合的效果仍然算', () => {
    const g = scenario({ p0: { combat: [] } });
    狙擊印記狀態.of(g, 0).up = 1;
    伏擊狀態.of(g, 0).atk = 4;
    順手牽羊狀態.of(g, 0).def = -2;
    Explosion狀態.of(g, 0).skip = true;
    expect(query(g, 0, 'aimLevel')).toBe(1);
    expect(query(g, 0, 'flatAtk')).toBe(4);
    expect(query(g, 0, 'flatDef')).toBe(-2);
    expect(query(g, 0, 'skipDrawPhase')).toBe(true);
    // 另一位玩家不受影響
    expect(query(g, 1, 'flatAtk')).toBe(0);
  });
});
