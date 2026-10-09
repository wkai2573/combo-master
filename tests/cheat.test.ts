import { describe, expect, it } from 'vitest';
import { isExCardId } from '../src/data/exCards';
import { ALL_CARDS } from '../src/data/cards';
import { CHEAT_POOL } from '../src/engine/cheat';
import { Z } from '../src/engine/ops';
import { names, pick, scenario } from './helpers';

// 先攻方第一個提示是「選一張手牌出招」，手牌至少 2 張才不會自動出招；測試都停在這個提示上
const uidOf = (g: ReturnType<typeof scenario>, p: 0 | 1, z: Parameters<typeof Z>[2], name: string) =>
  Z(g, p, z).find((c) => c.id === name)!.uid;

describe('作弊：卡池', () => {
  it('全卡池就是所有卡，不含 Ex 卡（未開放的卡也在裡面）', () => {
    expect(CHEAT_POOL.map((c) => c.id)).toEqual(ALL_CARDS.filter((c) => !isExCardId(c.id)).map((c) => c.id));
    expect(CHEAT_POOL.some((c) => isExCardId(c.id))).toBe(false);
    expect(CHEAT_POOL.length).toBeGreaterThan(36);
  });
});

describe('作弊：加入手牌', () => {
  it('可以加入自己或對方的手牌，並寫進遊戲紀錄', () => {
    const g = scenario({ p0: { hand: ['黑桃1', '黑桃6'] }, p1: { hand: ['黑桃2'] } });
    g.cheatAdd(0, 0, '黑桃5');
    g.cheatAdd(0, 1, '熔岩之擊');
    expect(names(g, 0, 'hand')).toEqual(['黑桃1', '黑桃6', '黑桃5']);
    expect(names(g, 1, 'hand')).toEqual(['黑桃2', '熔岩之擊']);
    const log = g.state.log.filter((l) => l.includes('【作弊】'));
    expect(log).toHaveLength(2);
    expect(log[0]).toContain('黑桃5');
    expect(log[1]).toContain('熔岩之擊');
  });

  it('Ex 卡與不存在的卡被拒絕，手牌不變', () => {
    const g = scenario({ p0: { hand: ['黑桃1', '黑桃6'] } });
    expect(() => g.cheatAdd(0, 0, 'Ex卡-中毒')).toThrow('Ex');
    expect(() => g.cheatAdd(0, 0, '不存在的卡')).toThrow('不存在');
    expect(names(g, 0, 'hand')).toEqual(['黑桃1', '黑桃6']);
  });

  it('加入的卡在下一個提示可以正常打出', () => {
    const g = scenario({ p0: { hand: ['黑桃1', '黑桃6'] }, p1: { hand: ['黑桃2'] } });
    g.cheatAdd(0, 1, '黑桃9');
    pick(g, '黑桃1');
    expect(g.pending!.player).toBe(1);
    pick(g, '黑桃9');
    expect(names(g, 1, 'moves')).toEqual(['黑桃9']);
  });
});

describe('作弊：移除手牌', () => {
  it('移出遊戲：不進棄牌區，也不在任何區域', () => {
    const g = scenario({ p0: { hand: ['黑桃1', '黑桃2'] }, p1: { hand: ['黑桃3', '黑桃4'] } });
    g.cheatRemove(0, 1, uidOf(g, 1, 'hand', '黑桃3'));
    g.cheatAdd(0, 0, '黑桃9');
    g.cheatRemove(0, 0, uidOf(g, 0, 'hand', '黑桃9'));
    expect(names(g, 1, 'hand')).toEqual(['黑桃4']);
    expect(names(g, 0, 'hand')).toEqual(['黑桃1', '黑桃2']);
    expect(names(g, 1, 'discard')).toEqual([]);
    expect(g.state.log.filter((l) => l.includes('【作弊】'))).toHaveLength(3);
  });

  it('不在手牌的卡被拒絕', () => {
    const g = scenario({ p0: { hand: ['黑桃1', '黑桃6'], exp: ['黑桃2'] } });
    expect(() => g.cheatRemove(0, 0, uidOf(g, 0, 'exp', '黑桃2'))).toThrow('手牌');
    expect(() => g.cheatRemove(0, 0, 99999)).toThrow('手牌');
  });
});

describe('作弊：調整牌區順序', () => {
  it('牌組、怒氣區、棄牌區、經驗區都能重排', () => {
    const g = scenario({
      p0: { hand: ['黑桃1', '黑桃6'], deck: ['黑桃2', '黑桃3', '黑桃4'], rage: ['黑桃5', '黑桃6'], discard: ['黑桃7', '黑桃8'], exp: ['黑桃9', '黑桃10'] },
      p1: { hand: [] },
    });
    for (const z of ['deck', 'rage', 'discard', 'exp'] as const) {
      const uids = Z(g, 0, z).map((c) => c.uid).reverse();
      g.cheatReorder(0, 0, z, uids);
      expect(Z(g, 0, z).map((c) => c.uid)).toEqual(uids);
    }
    expect(names(g, 0, 'deck')).toEqual(['黑桃4', '黑桃3', '黑桃2']);
    expect(g.state.log.filter((l) => l.includes('【作弊】'))).toHaveLength(4);
  });

  it('也能重排對方的牌區', () => {
    const g = scenario({ p0: { hand: ['黑桃1', '黑桃6'] }, p1: { hand: [], deck: ['黑桃2', '黑桃3'] } });
    g.cheatReorder(0, 1, 'deck', Z(g, 1, 'deck').map((c) => c.uid).reverse());
    expect(names(g, 1, 'deck')).toEqual(['黑桃3', '黑桃2']);
  });

  it('經驗區的順序影響蓋X：移到最前面的先被蓋', () => {
    const g = scenario({
      chars: ['法師', '勇者'],
      p0: { hand: ['冰霜護甲', '黑桃2'], exp: ['黑桃3', '黑桃4', '黑桃5'], rage: Array(5).fill('黑桃1') },
      p1: { hand: [] },
    });
    const [a, b, c] = Z(g, 0, 'exp').map((x) => x.uid);
    g.cheatReorder(0, 0, 'exp', [c, a, b]);
    pick(g, '冰霜護甲');
    pick(g, '發動');
    // 蓋2 蓋到最前面的兩張（黑桃5、黑桃3），只有這兩張被捨棄
    expect(names(g, 0, 'discard').sort()).toEqual(['黑桃3', '黑桃5']);
    expect(names(g, 0, 'exp')).toContain('黑桃4');
  });

  it('不是這個區的卡、重複或缺少的卡被拒絕，順序不變', () => {
    const g = scenario({ p0: { hand: ['黑桃1', '黑桃6'], deck: ['黑桃2', '黑桃3'] }, p1: { hand: [] } });
    const [a, b] = Z(g, 0, 'deck').map((c) => c.uid);
    expect(() => g.cheatReorder(0, 0, 'deck', [a])).toThrow('內容');
    expect(() => g.cheatReorder(0, 0, 'deck', [a, a])).toThrow('內容');
    expect(() => g.cheatReorder(0, 0, 'deck', [a, 99999])).toThrow('內容');
    expect(() => g.cheatReorder(0, 0, 'moves' as never, [])).toThrow('牌區不合法');
    expect(() => g.cheatReorder(0, 0, 'hand' as never, [])).toThrow('不能調整順序');
    expect(Z(g, 0, 'deck').map((c) => c.uid)).toEqual([a, b]);
  });
});

describe('作弊：刪除牌區的卡', () => {
  it('牌組、怒氣區、棄牌區、經驗區的卡都能移出遊戲，其他卡的順序不變，並寫進紀錄', () => {
    const g = scenario({
      p0: { hand: ['黑桃1', '黑桃6'], deck: ['黑桃2', '黑桃3', '黑桃4'], rage: ['黑桃5', '黑桃6'], discard: ['黑桃7', '黑桃8'], exp: ['黑桃9', '~黑桃1'] },
      p1: { hand: [] },
    });
    g.cheatDelete(0, 0, 'deck', uidOf(g, 0, 'deck', '黑桃3'));
    g.cheatDelete(0, 0, 'rage', uidOf(g, 0, 'rage', '黑桃5'));
    g.cheatDelete(0, 0, 'discard', uidOf(g, 0, 'discard', '黑桃8'));
    g.cheatDelete(0, 0, 'exp', uidOf(g, 0, 'exp', '黑桃1'));
    expect(names(g, 0, 'deck')).toEqual(['黑桃2', '黑桃4']);
    expect(names(g, 0, 'rage')).toEqual(['黑桃6']);
    expect(names(g, 0, 'discard')).toEqual(['黑桃7']);
    expect(names(g, 0, 'exp')).toEqual(['黑桃9']);
    expect(g.state.log.filter((l) => l.includes('【作弊】'))).toHaveLength(4);
  });

  it('也能刪對方的卡；不在那個牌區的卡與不合法的牌區被拒絕，內容不變', () => {
    const g = scenario({ p0: { hand: ['黑桃1', '黑桃6'], deck: ['黑桃2'] }, p1: { hand: [], deck: ['黑桃3', '黑桃4'] } });
    g.cheatDelete(0, 1, 'deck', uidOf(g, 1, 'deck', '黑桃3'));
    expect(names(g, 1, 'deck')).toEqual(['黑桃4']);
    expect(() => g.cheatDelete(0, 0, 'discard', uidOf(g, 0, 'deck', '黑桃2'))).toThrow('已經不在');
    expect(() => g.cheatDelete(0, 0, 'deck', 99999)).toThrow('已經不在');
    expect(() => g.cheatDelete(0, 0, 'hand' as never, uidOf(g, 0, 'hand', '黑桃1'))).toThrow('不能');
    expect(() => g.cheatDelete(0, 0, 'moves' as never, 1)).toThrow('牌區不合法');
    expect(names(g, 0, 'deck')).toEqual(['黑桃2']);
  });
});

describe('作弊：加卡到牌區', () => {
  it('新卡放在該區的第一格，四個牌區都可以；經驗區的新卡是表側', () => {
    const g = scenario({
      p0: { hand: ['黑桃1', '黑桃6'], deck: ['黑桃2'], rage: ['黑桃3'], discard: ['黑桃4'], exp: ['~黑桃5'] },
      p1: { hand: [] },
    });
    for (const z of ['deck', 'rage', 'discard', 'exp'] as const) g.cheatInsert(0, 0, z, '熔岩之擊');
    expect(names(g, 0, 'deck')).toEqual(['熔岩之擊', '黑桃2']);
    expect(names(g, 0, 'rage')).toEqual(['熔岩之擊', '黑桃3']);
    expect(names(g, 0, 'discard')).toEqual(['熔岩之擊', '黑桃4']);
    expect(names(g, 0, 'exp')).toEqual(['熔岩之擊', '黑桃5']);
    expect(Z(g, 0, 'exp').map((c) => c.covered)).toEqual([false, true]);
    expect(g.state.log.filter((l) => l.includes('【作弊】'))).toHaveLength(4);
  });

  it('也能加到對方的牌區；新卡有獨立的編號，之後可以刪', () => {
    const g = scenario({ p0: { hand: ['黑桃1', '黑桃6'] }, p1: { hand: [], deck: ['黑桃2'] } });
    g.cheatInsert(0, 1, 'deck', '黑桃9');
    const added = Z(g, 1, 'deck')[0];
    expect(new Set(Z(g, 1, 'deck').map((c) => c.uid)).size).toBe(2);
    g.cheatDelete(0, 1, 'deck', added.uid);
    expect(names(g, 1, 'deck')).toEqual(['黑桃2']);
  });

  it('Ex 卡、不存在的卡與手牌等不能排序的牌區被拒絕，內容不變', () => {
    const g = scenario({ p0: { hand: ['黑桃1', '黑桃6'], deck: ['黑桃2'] }, p1: { hand: [] } });
    expect(() => g.cheatInsert(0, 0, 'deck', 'Ex卡-中毒')).toThrow('Ex');
    expect(() => g.cheatInsert(0, 0, 'deck', '不存在的卡')).toThrow('不存在');
    expect(() => g.cheatInsert(0, 0, 'hand' as never, '黑桃5')).toThrow('不能');
    expect(() => g.cheatInsert(0, 0, 'moves' as never, '黑桃5')).toThrow('牌區不合法');
    expect(names(g, 0, 'deck')).toEqual(['黑桃2']);
    expect(names(g, 0, 'hand')).toEqual(['黑桃1', '黑桃6']);
  });
});

describe('作弊：翻面經驗卡', () => {
  it('表側與裏側互換，不觸發被蓋成裏側的反應，並寫進紀錄', () => {
    const g = scenario({
      chars: ['商人', '勇者'],
      p0: { hand: ['黑桃1', '黑桃6'], exp: ['低價買進', '~黑桃2'], rage: ['黑桃3'] },
      p1: { hand: [] },
    });
    g.cheatFlip(0, 0, uidOf(g, 0, 'exp', '低價買進'));
    g.cheatFlip(0, 0, uidOf(g, 0, 'exp', '黑桃2'));
    expect(Z(g, 0, 'exp').map((c) => [c.id, c.covered])).toEqual([['低價買進', true], ['黑桃2', false]]);
    // 低價買進被蓋時會回復 3，作弊翻面不算
    expect(names(g, 0, 'rage')).toEqual(['黑桃3']);
    expect(g.state.log.filter((l) => l.includes('【作弊】'))).toHaveLength(2);
  });

  it('可以翻對方的經驗卡；不在經驗區的卡被拒絕，狀態不變', () => {
    const g = scenario({ p0: { hand: ['黑桃1', '黑桃6'], deck: ['黑桃2'] }, p1: { hand: [], exp: ['黑桃3'] } });
    g.cheatFlip(0, 1, uidOf(g, 1, 'exp', '黑桃3'));
    expect(Z(g, 1, 'exp')[0].covered).toBe(true);
    expect(() => g.cheatFlip(0, 0, uidOf(g, 0, 'deck', '黑桃2'))).toThrow('經驗區');
    expect(() => g.cheatFlip(0, 0, 99999)).toThrow('經驗區');
  });

  it('提示選項裡的經驗卡不能翻面', () => {
    const g = scenario({
      chars: ['法師', '勇者'],
      p0: { hand: ['冰霜護甲', '黑桃2'], exp: ['黑桃3', '黑桃4', '~黑桃5', '~黑桃6'], rage: Array(5).fill('黑桃1') },
      p1: { hand: [] },
    });
    pick(g, '冰霜護甲');
    pick(g, '發動');
    expect(() => g.cheatFlip(0, 0, uidOf(g, 0, 'exp', '黑桃5'))).toThrow('提示');
    expect(Z(g, 0, 'exp')[2].covered).toBe(true);
  });
});

describe('作弊：不合法的參數一律拒絕', () => {
  it('玩家編號、卡名、順序的型別不對時，說明原因而不是執行期錯誤', () => {
    const g = scenario({ p0: { hand: ['黑桃1', '黑桃6'], deck: ['黑桃2', '黑桃3'] }, p1: { hand: [] } });
    expect(() => g.cheatAdd(0, 2 as never, '黑桃5')).toThrow('玩家');
    expect(() => g.cheatRemove(undefined as never, 0, 1)).toThrow('玩家');
    expect(() => g.cheatAdd(0, 0, undefined as never)).toThrow('卡名');
    expect(() => g.cheatReorder(0, 0, 'deck', 'abc' as never)).toThrow('順序');
    expect(names(g, 0, 'hand')).toEqual(['黑桃1', '黑桃6']);
  });
});

describe('作弊：不能動目前提示引用的卡', () => {
  it('提示選項裡的手牌不能移除，說明原因；沒被引用的卡可以', () => {
    const g = scenario({ p0: { hand: ['黑桃1', '黑桃2'] }, p1: { hand: [] } });
    expect(() => g.cheatRemove(0, 0, uidOf(g, 0, 'hand', '黑桃2'))).toThrow('提示');
    expect(names(g, 0, 'hand')).toEqual(['黑桃1', '黑桃2']);
    g.cheatAdd(0, 0, '黑桃9'); // 新加入的卡不在目前的選項裡
    g.cheatRemove(0, 0, uidOf(g, 0, 'hand', '黑桃9'));
    expect(names(g, 0, 'hand')).toEqual(['黑桃1', '黑桃2']);
  });

  it('提示選項裡的經驗卡不能被挪動位置；其他牌區仍可調整', () => {
    const g = scenario({
      chars: ['法師', '勇者'],
      p0: { hand: ['冰霜護甲', '黑桃2'], exp: ['黑桃3', '黑桃4', '~黑桃5', '~黑桃6'], rage: Array(5).fill('黑桃1'), deck: ['黑桃7', '黑桃8', '黑桃9'] },
      p1: { hand: [] },
    });
    pick(g, '冰霜護甲');
    pick(g, '發動');
    const exp = Z(g, 0, 'exp').map((c) => c.uid);
    expect(() => g.cheatReorder(0, 0, 'exp', [...exp].reverse())).toThrow('提示');
    expect(Z(g, 0, 'exp').map((c) => c.uid)).toEqual(exp);
    const deck = Z(g, 0, 'deck').map((c) => c.uid).reverse();
    g.cheatReorder(0, 0, 'deck', deck);
    expect(Z(g, 0, 'deck').map((c) => c.uid)).toEqual(deck);
    // 提示仍然有效，照常回應
    pick(g, '黑桃5', '黑桃6', '黑桃4');
    expect(names(g, 0, 'discard').sort()).toEqual(['黑桃4', '黑桃5', '黑桃6']);
  });
});

describe('作弊：勝負與動畫', () => {
  it('操作後重新檢查勝負', () => {
    const g = scenario({ p0: { hand: ['黑桃1', '黑桃6'] }, p1: { hand: [] } });
    Z(g, 1, 'deck').length = 0; // 模擬牌組被清空後才做作弊操作
    g.cheatAdd(0, 0, '黑桃5');
    expect(g.over).toBe(true);
    expect(g.state.winner).toBe(0);
    expect(g.pending).toBeNull();
  });

  it('遊戲結束後不能再作弊', () => {
    const g = scenario({ p0: { hand: ['黑桃1', '黑桃6'] }, p1: { hand: [] } });
    g.forfeit(1, '測試');
    expect(() => g.cheatAdd(0, 0, '黑桃5')).toThrow('結束');
  });

  it('作弊不產生動畫影格，之後的動畫也不會把作弊的變化演一遍', () => {
    const g = scenario({ animate: true, p0: { hand: ['黑桃1', '黑桃6'] }, p1: { hand: ['黑桃2'] } });
    g.drainFrames();
    g.cheatAdd(0, 1, '黑桃5');
    g.cheatRemove(0, 1, uidOf(g, 1, 'hand', '黑桃2'));
    expect(g.drainFrames()).toHaveLength(0);
    pick(g, '黑桃1');
    // 下一批影格裡，對方手牌從 1 張（黑桃5）開始，不會出現加入的那張卡飛進手牌
    const flights = g.drainFrames().filter((f) => f.fx.type === 'play');
    expect(flights.length).toBeGreaterThan(0);
  });
});

describe('作弊：檢視', () => {
  it('看得到雙方全部牌區，含對方手牌、牌組與雙方裏側卡', () => {
    const g = scenario({
      p0: { hand: ['黑桃1', '黑桃6'], deck: ['黑桃2'], exp: ['黑桃3', '~黑桃4'] },
      p1: { hand: ['黑桃5'], deck: ['黑桃6', '黑桃7'], rage: ['黑桃8'], exp: ['~黑桃9'] },
    });
    const snap = g.cheatSnapshot();
    expect(snap[1].hand.map((c) => c.id)).toEqual(['黑桃5']);
    expect(snap[1].deck.map((c) => c.id)).toEqual(['黑桃6', '黑桃7']);
    expect(snap[1].rage.map((c) => c.id)).toEqual(['黑桃8']);
    expect(snap[1].exp.map((c) => [c.id, c.covered])).toEqual([['黑桃9', true]]);
    expect(snap[0].exp.map((c) => [c.id, c.covered])).toEqual([['黑桃3', false], ['黑桃4', true]]);
    expect(snap[0].discard).toEqual([]);
  });
});
