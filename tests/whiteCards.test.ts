import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '../src/data/cards';
import { isVanilla } from '../src/data/enabledCards';

// 攻擊、防禦寫成兩位數字：60＝攻擊 6、防禦 0。每列是連擊值 1~9，依序是黑桃、紅心、梅花、方塊
const EXPECTED: Record<string, string[]> = {
  黑桃: ['60', '52', '44', '35', '26', '17', '08', '60', '52'],
  紅心: ['44', '35', '26', '17', '08', '60', '52', '44', '35'],
  梅花: ['26', '17', '08', '60', '52', '44', '35', '26', '17'],
  方塊: ['08', '60', '52', '44', '35', '26', '17', '08', '60'],
};

const white = ALL_CARDS.filter(isVanilla);

describe('白板卡數值', () => {
  it('每個花色、每個連擊值的攻守與規劃表一致', () => {
    for (const [suit, row] of Object.entries(EXPECTED)) {
      row.forEach((v, i) => {
        const c = ALL_CARDS.find((x) => x.id === `${suit}${i + 1}`)!;
        expect(`${c.atk}${c.def}`, c.id).toBe(v);
        expect(c.combo, c.id).toBe(i + 1);
      });
    }
  });

  it('同一連擊值的 4 張白板卡，攻守互不相同', () => {
    for (let n = 1; n <= 9; n++) {
      const pairs = white.filter((c) => c.combo === n).map((c) => `${c.atk}${c.def}`);
      expect(pairs, `連擊值 ${n}`).toHaveLength(4);
      expect(new Set(pairs).size, `連擊值 ${n}：${pairs.join(' ')}`).toBe(4);
    }
  });

  it('每個花色隨連擊值上升，攻擊依 6、5、4、3、2、1、0 循環遞減', () => {
    const ring = [6, 5, 4, 3, 2, 1, 0];
    for (const suit of Object.keys(EXPECTED)) {
      const cards = Array.from({ length: 9 }, (_, i) => ALL_CARDS.find((x) => x.id === `${suit}${i + 1}`)!);
      for (let i = 1; i < 9; i++) {
        expect(ring.indexOf(cards[i].atk), `${suit}${i + 1}`).toBe((ring.indexOf(cards[i - 1].atk) + 1) % 7);
      }
    }
  });
});
