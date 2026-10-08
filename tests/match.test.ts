import { describe, expect, it } from 'vitest';
import { Match } from '../src/net/match';
import { presetDeck } from '../src/data/presetDecks';
import { matchScenario } from './helpers';

// 先攻方的第一個提示是出招；手牌至少 2 張才不會自動出招
const setup = () => matchScenario({
  p0: { hand: ['黑桃1', '黑桃2'], deck: ['黑桃3', '黑桃4', '黑桃5'] },
  p1: { hand: ['黑桃6', '黑桃7'] },
});
const keyOf = (m: Match, label: string) => m.pending!.options.find((o) => o.label === label)!.key;

describe('對局：更新', () => {
  it('開局用 flush 取走首批影格，兩位玩家各拿到自己視角的版本，第二次沒有影格', () => {
    const m = new Match(
      [{ charId: '勇者', cards: presetDeck('勇者') }, { charId: '刺客', cards: presetDeck('刺客') }],
    );
    const [a, b] = m.flush();
    expect(a.frames.length).toBeGreaterThan(0);
    expect(b.frames).toHaveLength(a.frames.length);
    expect(a.view.me).toBe(0);
    expect(b.view.me).toBe(1);
    expect(a.frames.every((f) => f.view.me === 0)).toBe(true);
    expect(b.frames.every((f) => f.view.me === 1)).toBe(true);
    const [a2, b2] = m.flush();
    expect(a2.frames).toEqual([]);
    expect(b2.frames).toEqual([]);
  });

  it('snapshot 帶現況視角，不帶影格，也不取走尚未取走的影格', () => {
    const m = setup();
    const [a, b] = m.snapshot();
    expect(a.frames).toEqual([]);
    expect(b.frames).toEqual([]);
    expect(a.view.prompt).not.toBeNull(); // 先攻的房主有提示
    expect(b.view.prompt).toBeNull();
    expect(m.flush()[0].frames.length).toBeGreaterThan(0);
  });

  it('提交成功：兩位玩家同時拿到影格，輪到對手的提示', () => {
    const m = setup();
    m.flush();
    const r = m.submit(0, [keyOf(m, '黑桃1')]);
    expect(r.error).toBeNull();
    const [a, b] = r.update;
    expect(a.frames.length).toBeGreaterThan(0);
    expect(b.frames).toHaveLength(a.frames.length);
    expect(a.view.prompt).toBeNull();
    expect(b.view.prompt).not.toBeNull();
    expect(m.pending!.player).toBe(1);
  });
});

describe('對局：不合法的提交', () => {
  it('還沒輪到、選項不合法都被拒絕並說明，桌面不變，影格不被取走', () => {
    const m = setup();
    const before = JSON.stringify(m.snapshot()[0].view);
    const early = m.submit(1, [keyOf(m, '黑桃1')]);
    expect(early.error).toContain('還沒輪到');
    const bad = m.submit(0, ['不存在的選項']);
    expect(bad.error).toContain('選項不合法');
    expect(JSON.stringify(bad.update[0].view)).toBe(before);
    expect(bad.update[0].frames).toEqual([]);
    expect(bad.update[1].frames).toEqual([]);
    // 開局的影格還在
    expect(m.flush()[0].frames.length).toBeGreaterThan(0);
  });

  it('遊戲結束後再提交被拒絕', () => {
    const m = setup();
    m.forfeit(0, '認輸');
    expect(m.submit(0, []).error).toContain('沒有待回應');
  });
});

describe('對局：認輸', () => {
  it('對手獲勝，兩位玩家的更新都帶勝負', () => {
    const m = setup();
    m.flush();
    const [a, b] = m.forfeit(1, '對手離線');
    expect(m.over).toBe(true);
    expect(m.pending).toBeNull();
    expect(a.view.winner).toBe(0);
    expect(b.view.winner).toBe(0);
    expect(a.frames.length).toBeGreaterThan(0);
  });
});

describe('對局：作弊', () => {
  it('預設雙方關閉；開關寫進紀錄並同時反映在雙方更新，下一局重新建立就重置', () => {
    const m = setup();
    expect(m.snapshot()[0].cheatOn).toEqual([false, false]);
    const [a, b] = m.cheatSwitch(1, true);
    expect(a.cheatOn).toEqual([false, true]);
    expect(b.cheatOn).toEqual([false, true]);
    expect(a.view.log.some((l) => l.includes('作弊模式') && l.includes('玩家B'))).toBe(true);
    expect(setup().snapshot()[0].cheatOn).toEqual([false, false]);
  });

  it('沒開作弊模式的操作被拒絕，桌面不變', () => {
    const m = setup();
    const r = m.cheat(1, { k: 'add', target: 0, cardId: '黑桃9' });
    expect(r.error).toContain('沒有開啟');
    expect(r.update[0].view.players[0].hand).toHaveLength(2);
  });

  it('操作者以參數為準：開啟的人才能操作，紀錄寫明是誰', () => {
    const m = setup();
    m.cheatSwitch(1, true);
    expect(m.cheat(0, { k: 'add', target: 0, cardId: '黑桃9' }).error).toContain('沒有開啟');
    const r = m.cheat(1, { k: 'add', target: 0, cardId: '黑桃9' });
    expect(r.error).toBeNull();
    expect(r.update[0].view.players[0].hand).toHaveLength(3);
    const line = r.update[1].view.log.find((l) => l.includes('將【黑桃9】加入'))!;
    expect(line).toContain('玩家B');
  });

  it('被拒絕時回現況：帶作弊的開關與檢視，不取走影格', () => {
    const m = setup();
    m.cheatSwitch(1, true);
    const r = m.cheat(1, { k: 'remove', target: 0, uid: 99999 });
    expect(r.error).toContain('手牌');
    expect(r.update[1].cheatOn).toEqual([false, true]);
    expect(r.update[1].cheatSnap).not.toBeNull();
    expect(r.update[1].frames).toEqual([]);
  });

  it('不合法的操作被拒絕並說明', () => {
    const m = setup();
    m.cheatSwitch(1, true);
    expect(m.cheat(1, { k: 'nope' } as never).error).toContain('不合法');
    expect(m.cheat(1, { k: 'reorder', target: 0, zone: '__proto__', uids: [] } as never).error).toBe('牌區不合法');
  });

  it('作弊檢視只給開啟的那一方，cheatSnapshot 每次即時讀取', () => {
    const m = setup();
    expect(m.cheatSnapshot(1)).toBeNull();
    const [a, b] = m.cheatSwitch(1, true);
    expect(a.cheatSnap).toBeNull();
    expect(b.cheatSnap![0].hand.map((c) => c.id)).toEqual(['黑桃1', '黑桃2']);
    m.cheat(1, { k: 'add', target: 0, cardId: '黑桃9' });
    expect(m.cheatSnapshot(1)![0].hand.map((c) => c.id)).toEqual(['黑桃1', '黑桃2', '黑桃9']);
    expect(m.cheatSnapshot(0)).toBeNull();
  });
});

describe('對局：隱藏資訊', () => {
  it('對手的手牌不出現在視角，自己的看得到', () => {
    const [a, b] = setup().snapshot();
    expect(a.view.players[0].hand.map((c) => c.id)).toEqual(['黑桃1', '黑桃2']);
    expect(a.view.players[1].hand.every((c) => c.id === null)).toBe(true);
    expect(b.view.players[1].hand.map((c) => c.id)).toEqual(['黑桃6', '黑桃7']);
    expect(b.view.players[0].hand.every((c) => c.id === null)).toBe(true);
  });

  it('裏側經驗：對手只有牌背，自己看得到牌面', () => {
    const m = matchScenario({
      p0: { hand: ['黑桃1', '黑桃2'], exp: ['~黑桃8'] },
      p1: { hand: ['黑桃6', '黑桃7'] },
    });
    const [a, b] = m.snapshot();
    expect(a.view.players[0].exp.map((c) => c.id)).toEqual(['黑桃8']);
    expect(b.view.players[0].exp.map((c) => c.id)).toEqual([null]);
  });

  it('影格裡也不洩漏對手的手牌', () => {
    const [a, b] = setup().flush();
    expect(a.frames.every((f) => f.view.players[1].hand.every((c) => c.id === null))).toBe(true);
    expect(b.frames.every((f) => f.view.players[0].hand.every((c) => c.id === null))).toBe(true);
  });
});
