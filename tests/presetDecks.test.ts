import { describe, expect, it } from 'vitest';
import { getCard } from '../src/data/cards';
import { presetDeck, PRESET_CHARACTER_IDS } from '../src/data/presetDecks';
import { isVanilla } from '../src/data/enabledCards';

const count = (deck: string[]) => {
  const m = new Map<string, number>();
  for (const id of deck) m.set(id, (m.get(id) ?? 0) + 1);
  return m;
};

// 各職業開放中的效果招式（獨立列出，不從資料推算）
const SWORD = ['戒備打擊', '復仇之嚎', '凡骨的意志', '熔岩之擊', '洩憤'];
const MOVES: Record<string, string[]> = {
  勇者: SWORD,
  後人: SWORD,
  刺客: ['伏擊', '二刀連擊', '順手牽羊', '卸除鎧甲', '塗毒'],
  先人: ['伏擊', '二刀連擊', '順手牽羊', '卸除鎧甲', '塗毒'],
  商人: ['低價買進', '高價賣出', '交涉', '即時停損', '公開資訊', '財富管理'],
  遊俠: ['魅影射擊', '地雷陷阱', '狙擊印記', '二連矢', '狙擊蓄力', '生命偷取'],
  法師: ['力量爆破', '電弧', '火球', '冰霜護甲', 'Explosion!'],
};
const TRINKET: Record<string, string> = { 勇者: '家族相片', 後人: '家族相片', 刺客: '幸運兔腳', 先人: '幸運兔腳', 商人: '招財貓', 遊俠: '瞄準器', 法師: '元素法典' };

const whites = (deck: string[]) => deck.map(getCard).filter(isVanilla);
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('預設牌組的組成', () => {
  it.each(PRESET_CHARACTER_IDS)('%s：每張職業效果招式 3 張，嘲諷與盾擊依角色處理', (id) => {
    const n = count(presetDeck(id));
    for (const name of MOVES[id]) expect(n.get(name), `${id} 的 ${name}`).toBe(3);
    expect(n.get('嘲諷') ?? 0, `${id} 的嘲諷`).toBe(id === '後人' ? 1 : 0);
    expect(n.get('盾擊') ?? 0, `${id} 的盾擊`).toBe(id === '後人' ? 3 : 0);
  });

  it.each(PRESET_CHARACTER_IDS)('%s：裝備只有木棍、布甲、職業飾品各 1 張', (id) => {
    const equips = presetDeck(id).filter((c) => getCard(c).kind === 'equip').sort();
    expect(equips).toEqual(['木棍', '布甲', TRINKET[id]].sort());
  });

  it.each(PRESET_CHARACTER_IDS)('%s：生命藥水的張數', (id) => {
    const potions = presetDeck(id).filter((c) => c === '生命藥水').length;
    expect(potions).toBe(['勇者', '後人', '商人'].includes(id) ? 1 : 2);
  });

  it.each(PRESET_CHARACTER_IDS)('%s：除了指定的效果卡與裝備，其餘都是白板卡，共 50 張', (id) => {
    const deck = presetDeck(id);
    expect(deck).toHaveLength(50);
    const fixed = MOVES[id].length * 3 + 3 /* 裝備 */ + (id === '後人' ? 4 : 0) + (['勇者', '後人', '商人'].includes(id) ? 1 : 2);
    expect(whites(deck)).toHaveLength(50 - fixed);
  });

  it.each(PRESET_CHARACTER_IDS)('%s：連擊值 1~9 的招式張數盡量平均（每個 3~7 張）', (id) => {
    const moves = presetDeck(id).map(getCard).filter((c) => c.kind === 'move');
    for (let n = 1; n <= 9; n++) {
      const k = moves.filter((c) => c.combo === n).length;
      expect(k, `${id} 連擊值 ${n}`).toBeGreaterThanOrEqual(3);
      expect(k, `${id} 連擊值 ${n}`).toBeLessThanOrEqual(7);
    }
  });
});

describe('預設牌組的白板卡傾向', () => {
  const atk = (id: string) => avg(whites(presetDeck(id)).map((c) => c.atk));
  const gap = (id: string) => avg(whites(presetDeck(id)).map((c) => Math.abs(c.atk - c.def)));

  it('勇者最偏攻，後人最偏守，刺客偏攻，先人居中', () => {
    expect(atk('勇者')).toBeGreaterThan(atk('刺客'));
    expect(atk('刺客')).toBeGreaterThan(atk('先人'));
    expect(atk('先人')).toBeGreaterThan(atk('後人'));
    expect(atk('法師')).toBeGreaterThan(atk('先人'));
  });

  it('商人、先人、遊俠挑攻守接近的白板卡，比偏攻或偏守的角色接近', () => {
    for (const id of ['商人', '先人', '遊俠']) {
      for (const other of ['勇者', '後人']) expect(gap(id), `${id} 對 ${other}`).toBeLessThan(gap(other));
    }
  });
});
