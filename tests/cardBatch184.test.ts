import { describe, expect, it } from 'vitest';
import { ALL_CARDS, getCard } from '../src/data/cards';

// 卡表更新批次（#184）：既有 3 張連擊值調整，新卡與 Ex 卡的資料進遊戲，暫名 id 改成正式卡名
describe('既有卡的連擊值調整', () => {
  it('電弧 5、交涉 4、二連矢 2，攻守不變', () => {
    expect([getCard('電弧').atk, getCard('電弧').def, getCard('電弧').combo]).toEqual([3, 4, 5]);
    expect([getCard('交涉').atk, getCard('交涉').def, getCard('交涉').combo]).toEqual([3, 4, 4]);
    expect([getCard('二連矢').atk, getCard('二連矢').def, getCard('二連矢').combo]).toEqual([3, 4, 2]);
  });
});

describe('新卡的資料', () => {
  const NEW = [
    '盛怒漩渦', '威嚇戰吼', '狂戰', '毒藥', '煙霧陷阱', '冰凍陷阱', '捕熊陷阱', '作假帳', '煉金印記',
    '箭雨', '穿雲箭', '天譴之箭', '冰茅', '聖獸白虎', '聖獸玄武',
  ];

  it('15 張新招式與 2 張 Ex 卡都在遊戲資料裡，內部 id 就是卡名', () => {
    for (const id of NEW) expect(getCard(id).name, id).toBe(id);
    expect(getCard('Ex-白虎').duration).toBe(7);
    expect(getCard('Ex-玄武').duration).toBe(7);
  });

  it('全部卡片的內部 id 彼此不重複', () => {
    const ids = ALL_CARDS.map((c) => c.id);
    expect(ids.length - new Set(ids).size).toBe(0);
  });

  it('狂戰是劍士專用卡', () => {
    expect(getCard('狂戰').cls).toBe('劍士');
  });
});
