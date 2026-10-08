import { describe, expect, it } from 'vitest';
import { Z } from '../src/engine/ops';
import { viewFor } from '../src/engine/view';
import { CheatHub } from '../src/net/cheatHub';
import { names, pick, scenario } from './helpers';

// 訪客是玩家 B（編號 1），房主是玩家 A（編號 0）；先攻方的第一個提示是出招，手牌至少 2 張才不會自動出招
const setup = () => {
  const g = scenario({ p0: { hand: ['黑桃1', '黑桃2'], deck: ['黑桃3', '黑桃4', '黑桃5'] }, p1: { hand: ['黑桃6', '黑桃7'] } });
  return { g, hub: new CheatHub(g) };
};
const uid = (g: ReturnType<typeof scenario>, p: 0 | 1, name: string) => Z(g, p, 'hand').find((c) => c.id === name)!.uid;

describe('作弊中樞：開關', () => {
  it('預設雙方都關閉；開關寫進紀錄，狀態沒變不重複寫', () => {
    const { g, hub } = setup();
    expect(hub.on).toEqual([false, false]);
    hub.setOn(1, true);
    hub.setOn(1, true);
    expect(hub.on).toEqual([false, true]);
    hub.setOn(1, false);
    const log = g.state.log.filter((l) => l.includes('作弊模式'));
    expect(log).toHaveLength(2);
    expect(log[0]).toContain('玩家B');
    expect(log[0]).toContain('開啟');
    expect(log[1]).toContain('關閉');
  });

  it('每一局重新建立就是關閉的狀態', () => {
    const { hub } = setup();
    hub.setOn(0, true);
    expect(new CheatHub(scenario()).on).toEqual([false, false]);
  });
});

describe('作弊中樞：訪客的操作', () => {
  it('沒開作弊模式就拒絕，桌面不變', () => {
    const { g, hub } = setup();
    expect(hub.apply(1, { k: 'add', target: 0, cardId: '黑桃9' })).toContain('沒有開啟');
    expect(names(g, 0, 'hand')).toEqual(['黑桃1', '黑桃2']);
  });

  it('開啟後可以操作雙方牌區，紀錄寫明是誰做的', () => {
    const { g, hub } = setup();
    hub.setOn(1, true);
    expect(hub.apply(1, { k: 'add', target: 0, cardId: '黑桃9' })).toBeNull();
    expect(hub.apply(1, { k: 'remove', target: 1, uid: uid(g, 1, '黑桃7') })).toBeNull();
    const deck = Z(g, 0, 'deck').map((c) => c.uid).reverse();
    expect(hub.apply(1, { k: 'reorder', target: 0, zone: 'deck', uids: deck })).toBeNull();
    expect(names(g, 0, 'hand')).toEqual(['黑桃1', '黑桃2', '黑桃9']);
    expect(names(g, 1, 'hand')).toEqual(['黑桃6']);
    expect(names(g, 0, 'deck')).toEqual(['黑桃5', '黑桃4', '黑桃3']);
    const ops = g.state.log.filter((l) => l.includes('【作弊】') && !l.includes('作弊模式'));
    expect(ops).toHaveLength(3);
    expect(ops.every((l) => l.includes('玩家B'))).toBe(true);
  });

  it('訪客也能刪除牌區的卡、加卡到牌區、翻面經驗卡，紀錄寫明是誰做的', () => {
    const { g, hub } = setup();
    hub.setOn(1, true);
    const before = g.state.log.length;
    const top = Z(g, 0, 'deck')[0].uid;
    expect(hub.apply(1, { k: 'delete', target: 0, zone: 'deck', uid: top })).toBeNull();
    expect(hub.apply(1, { k: 'insert', target: 0, zone: 'deck', cardId: '黑桃9' })).toBeNull();
    expect(names(g, 0, 'deck')).toEqual(['黑桃9', '黑桃4', '黑桃5']);
    expect(hub.apply(1, { k: 'insert', target: 1, zone: 'exp', cardId: '黑桃8' })).toBeNull();
    expect(hub.apply(1, { k: 'flip', target: 1, uid: Z(g, 1, 'exp')[0].uid })).toBeNull();
    expect(Z(g, 1, 'exp')[0].covered).toBe(true);
    const ops = g.state.log.slice(before);
    expect(ops).toHaveLength(4);
    expect(ops.every((l) => l.includes('【作弊】') && l.includes('玩家B'))).toBe(true);
  });

  it('新操作被拒絕時說明原因，桌面不變', () => {
    const { g, hub } = setup();
    hub.setOn(1, true);
    expect(hub.apply(1, { k: 'delete', target: 0, zone: 'deck', uid: 99999 })).toContain('已經不在');
    expect(hub.apply(1, { k: 'insert', target: 0, zone: 'hand' as never, cardId: '黑桃9' })).toContain('不能');
    expect(hub.apply(1, { k: 'flip', target: 0, uid: 99999 })).toContain('經驗區');
    expect(names(g, 0, 'deck')).toEqual(['黑桃3', '黑桃4', '黑桃5']);
  });

  it('房主與訪客各自開關：房主沒開就不能操作，不受訪客的開關影響', () => {
    const { hub } = setup();
    hub.setOn(1, true);
    expect(hub.apply(0, { k: 'add', target: 0, cardId: '黑桃9' })).toContain('沒有開啟');
    hub.setOn(0, true);
    expect(hub.apply(0, { k: 'add', target: 1, cardId: '黑桃9' })).toBeNull();
  });

  it('提示正引用的卡、過期的畫面、不合法的訊息都被拒絕並說明原因，桌面不變', () => {
    const { g, hub } = setup();
    hub.setOn(1, true);
    // 目前提示是房主出招，選項是房主的手牌
    expect(hub.apply(1, { k: 'remove', target: 0, uid: uid(g, 0, '黑桃1') })).toContain('提示');
    expect(hub.apply(1, { k: 'remove', target: 0, uid: 99999 })).toContain('手牌');
    expect(hub.apply(1, { k: 'reorder', target: 0, zone: 'deck', uids: [1] })).toContain('內容');
    expect(hub.apply(1, { k: 'add', target: 0, cardId: 'Ex卡-中毒' })).toContain('Ex');
    expect(hub.apply(1, { k: 'add', target: 7 as never, cardId: '黑桃9' })).toContain('玩家');
    expect(hub.apply(1, { k: 'nope' } as never)).toContain('不合法');
    expect(hub.apply(1, undefined as never)).toContain('不合法');
    expect(names(g, 0, 'hand')).toEqual(['黑桃1', '黑桃2']);
  });

  it('操作之後遊戲照常進行', () => {
    const { g, hub } = setup();
    hub.setOn(1, true);
    hub.apply(1, { k: 'add', target: 1, cardId: '黑桃9' });
    pick(g, '黑桃1');
    expect(g.pending!.player).toBe(1);
    pick(g, '黑桃9');
    expect(names(g, 1, 'combat')).toEqual(['黑桃9']);
  });
});

describe('作弊中樞：視角', () => {
  it('作弊檢視只給開啟的那一方，另一方的視角不變', () => {
    const { g, hub } = setup();
    expect(hub.snapshotFor(0)).toBeNull();
    expect(hub.snapshotFor(1)).toBeNull();
    hub.setOn(1, true);
    expect(hub.snapshotFor(0)).toBeNull();
    const snap = hub.snapshotFor(1)!;
    expect(snap[0].hand.map((c) => c.id)).toEqual(['黑桃1', '黑桃2']); // 房主的手牌，訪客看得到
    expect(snap[0].deck).toHaveLength(3);
    // 房主的一般視角：看不到訪客的手牌，不因訪客開作弊而改變
    expect(viewFor(g, 0).players[1].hand.every((c) => c.id === null)).toBe(true);
    // 訪客的一般視角同樣照舊：看不到房主的手牌
    expect(viewFor(g, 1).players[0].hand.every((c) => c.id === null)).toBe(true);
  });

  it('關閉作弊模式後不再給檢視', () => {
    const { hub } = setup();
    hub.setOn(1, true);
    hub.setOn(1, false);
    expect(hub.snapshotFor(1)).toBeNull();
  });
});
