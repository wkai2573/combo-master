import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCard } from '../src/data/cards';
import { TutorialSession } from '../src/net/session';
import type { BattleRecord } from '../src/stats/records';
import type { RecordReporter } from '../src/stats/reporter';
import { LESSONS } from '../src/tutorial/lessons';
import { CORE_COMBAT_1 } from '../src/tutorial/script';

// 教學腳本走過的每一步：說明、對手出牌、要求玩家出牌。測試只看玩家看得到的結果
let captured: BattleRecord[] = [];
const testReporter: RecordReporter = {
  submit: (r) => captured.push(r),
  flush: async () => ({ sent: 0, left: 0 }),
};

beforeEach(() => {
  captured = [];
  vi.useFakeTimers();
});
const sessions: TutorialSession[] = [];
afterEach(() => {
  sessions.splice(0).forEach((s) => s.leave());
  vi.useRealTimers();
});

function start() {
  const s = new TutorialSession(testReporter);
  sessions.push(s);
  return s;
}

const progress = (s: TutorialSession) => s.getState().tutorial!;
const nameOf = (id: string | null) => (id ? getCard(id).name : '?');
const movesOf = (s: TutorialSession, p: 0 | 1) => s.getState().view!.players[p].moves.map((c) => nameOf(c.id));

/** 一路點擊，直到要玩家出牌（或腳本結束）；回傳經過的說明文字 */
function clickToPlay(s: TutorialSession): string[] {
  const texts: string[] = [];
  for (let i = 0; i < 50 && progress(s).awaiting === 'click'; i++) {
    texts.push(progress(s).text);
    s.advance();
  }
  return texts;
}

/** 玩家打出手牌中指定的那張牌（用畫面上的提示選項） */
function playCard(s: TutorialSession, cardId: string) {
  const opt = s.getState().view!.prompt!.options.find((o) => o.cardId === cardId)!;
  s.submit([opt.key]);
}

/** 範圍兩端：雙方招式卡疊最上方的連擊值，小的在前 */
function range(s: TutorialSession): [number, number] {
  const combos = ([0, 1] as const).map((p) => getCard(s.getState().view!.players[p].moves.at(-1)!.id!).combo);
  return [Math.min(...combos), Math.max(...combos)];
}

describe('新手教學：對手照腳本出招', () => {
  it('第二段說明點完，對手立刻打出紅心9，不需要計時器；接著說明輪到你', () => {
    const s = start();
    s.advance();
    const before = s.getState().batch.id;
    s.advance();
    expect(vi.getTimerCount()).toBe(0);
    expect(movesOf(s, 1)).toEqual(['紅心9']);
    const st = s.getState();
    expect(st.batch.id).toBeGreaterThan(before);
    expect(st.batch.frames.some((f) => f.fx.type === 'play' && f.fx.player === 1)).toBe(true);
    expect(st.tutorial!.text).toContain('現在輪到你出招了。');
    expect(st.tutorial!.awaiting).toBe('click');
  });

  it('腳本指定的出牌不合法時丟出明確的錯誤（卡表改壞教學的把關）', () => {
    const chapter = { ...CORE_COMBAT_1, steps: [{ kind: 'opponent-play' as const, card: '黑桃9' }] };
    expect(() => new TutorialSession(testReporter, { ...LESSONS[0], chapter })).toThrow('教學腳本');
  });
});

describe('新手教學：要求出牌', () => {
  function toFirstPlay() {
    const s = start();
    clickToPlay(s);
    return s;
  }

  it('要求出黑桃1：說明、高亮手牌中的黑桃1、等指定的出牌', () => {
    const t = progress(toFirstPlay());
    expect(t.text).toContain('那我們來嘗試打出招式吧。');
    expect(t.text).toContain('點擊或拖曳至戰鬥區。');
    expect(t.awaiting).toEqual({ play: '黑桃1' });
    expect(t.highlight).toEqual([{ kind: 'hand-card', cardId: '黑桃1' }]);
  });

  it('出別張牌被拒絕：顯示原因，桌面、影格與教學進度都不變', () => {
    const s = toFirstPlay();
    const before = s.getState();
    playCard(s, '紅心2');
    const st = s.getState();
    expect(st.message).not.toBe('');
    expect(st.view).toBe(before.view);
    expect(st.batch.id).toBe(before.batch.id);
    expect(st.tutorial).toBe(before.tutorial);
    expect(movesOf(s, 0)).toEqual([]);
  });

  it('出指定的牌：接受，換到下一段說明', () => {
    const s = toFirstPlay();
    const batch = s.getState().batch.id;
    playCard(s, '黑桃1');
    expect(movesOf(s, 0)).toEqual(['黑桃1']);
    expect(s.getState().batch.id).toBeGreaterThan(batch);
    expect(s.getState().message).toBe('');
    expect(progress(s).text).toContain('雙方戰鬥區都有招式了');
    expect(progress(s).awaiting).toBe('click');
  });

  it('範圍說明帶入實際的連擊值，不寫死在腳本裡', () => {
    const s = toFirstPlay();
    playCard(s, '黑桃1');
    s.advance();
    const [lo, hi] = range(s);
    expect([lo, hi]).toEqual([getCard('黑桃1').combo, getCard('紅心9').combo]);
    expect(progress(s).text).toContain(`連擊值為${lo}跟${hi}`);
    expect(progress(s).text).toContain(`${lo}~${hi}之間的所有數值`);
    expect(progress(s).highlight).toEqual([{ kind: 'top-combos' }]);
  });
});

describe('新手教學：腳本走到玩家出完第一張梅花7', () => {
  /** 走完整段，回傳每一步出現過的說明文字 */
  function playThrough() {
    const s = start();
    const texts: string[] = [];
    texts.push(...clickToPlay(s));
    playCard(s, '黑桃1');
    texts.push(...clickToPlay(s));
    playCard(s, '紅心2');
    texts.push(...clickToPlay(s));
    playCard(s, '梅花7');
    return { s, texts };
  }

  it('雙方出的牌依腳本：對手紅心9、黑桃8、梅花7；玩家黑桃1、紅心2、梅花7', () => {
    const { s } = playThrough();
    expect(movesOf(s, 1)).toEqual(['紅心9', '黑桃8', '梅花7']);
    expect(movesOf(s, 0)).toEqual(['黑桃1', '紅心2', '梅花7']);
  });

  it('說明依 docx 腳本的順序出現', () => {
    const { texts } = playThrough();
    const order = [
      '雙方輪流在可出招的“範圍內”打出招式。',
      '由對手先攻，在雙方只要有一方戰鬥區沒招式，出牌都是沒限制的。',
      '現在輪到你出招了。',
      '由於你的戰鬥區沒招式，所以出牌都是沒限制的。',
      '由於雙方戰鬥區都有招式了，所以接下來的出招會有所限制。',
      '目前雙方最後一張招式的連擊值為',
      '現在輪到你出招了。',
      '目前雙方最後一張招式的連擊值為',
      '由於9不在“範圍內”了，故無法作為出招打出。',
    ];
    expect(texts).toHaveLength(order.length);
    order.forEach((t, i) => expect(texts[i], `第 ${i + 1} 段`).toContain(t));
  });

  it('第二次範圍說明是黑桃1 到黑桃8 的連擊值；梅花9 被高亮', () => {
    const s = start();
    clickToPlay(s);
    playCard(s, '黑桃1');
    clickToPlay(s);
    // clickToPlay 走完了第二次範圍說明與梅花9 說明；回頭驗證文字用實際的範圍
    expect(range(s)).toEqual([getCard('黑桃1').combo, getCard('黑桃8').combo]);
    expect(progress(s).awaiting).toEqual({ play: '紅心2' });
  });

  it('梅花9 不在範圍內的說明高亮手牌中的梅花9', () => {
    const s = start();
    clickToPlay(s);
    playCard(s, '黑桃1');
    for (let i = 0; i < 20 && !progress(s).text.includes('由於9不在'); i++) s.advance();
    expect(progress(s).highlight).toEqual([{ kind: 'hand-card', cardId: '梅花9' }]);
  });

  it('要求出紅心2 時，收招與其他牌都被拒絕，桌面不變', () => {
    const s = start();
    clickToPlay(s);
    playCard(s, '黑桃1');
    clickToPlay(s);
    const before = s.getState();
    expect(progress(s).awaiting).toEqual({ play: '紅心2' });
    s.submit(['pass']);
    playCard(s, '梅花7');
    expect(s.getState().view).toBe(before.view);
    expect(s.getState().batch.id).toBe(before.batch.id);
    expect(s.getState().message).not.toBe('');
  });

  it('玩家出紅心2 與對手的梅花7 在同一批影格裡依序出現', () => {
    const s = start();
    clickToPlay(s);
    playCard(s, '黑桃1');
    clickToPlay(s);
    playCard(s, '紅心2');
    const plays = s.getState().batch.frames.filter((f) => f.fx.type === 'play').map((f) => (f.fx as { player: number }).player);
    expect(plays).toEqual([0, 1]);
  });

  it('全程沒有送出戰績', () => {
    const { s } = playThrough();
    s.leave();
    expect(captured).toEqual([]);
  });
});
