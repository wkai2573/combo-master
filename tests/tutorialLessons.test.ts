import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCard } from '../src/data/cards';
import { TutorialSession } from '../src/net/session';
import { isLessonDone } from '../src/tutorial/completion';
import { getLesson, LESSONS } from '../src/tutorial/lessons';
import type { BattleRecord } from '../src/stats/records';
import type { RecordReporter } from '../src/stats/reporter';

// 第 2 課以後的教學課程：每課從頭走到尾的測試，就是 ADR 0008 的把關。
// 卡表改了白板卡的數值、或某一課用到的卡，讓某一步走不通，這裡會失敗，要調整該課的牌面配置，不是把卡表數值改回來
let captured: BattleRecord[] = [];
const testReporter: RecordReporter = {
  submit: (r) => captured.push(r),
  flush: async () => ({ sent: 0, left: 0 }),
};

let stored: Map<string, string>;
beforeEach(() => {
  captured = [];
  vi.useFakeTimers();
  stored = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => stored.get(k) ?? null,
    setItem: (k: string, v: string) => void stored.set(k, v),
    removeItem: (k: string) => void stored.delete(k),
  });
});
const sessions: TutorialSession[] = [];
afterEach(() => {
  sessions.splice(0).forEach((s) => s.leave());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function start(no: number) {
  const s = new TutorialSession(testReporter, getLesson(no));
  sessions.push(s);
  return s;
}

const progress = (s: TutorialSession) => s.getState().tutorial!;
const view = (s: TutorialSession) => s.getState().view!;
const names = (cards: Array<{ id: string | null }>) => cards.map((c) => (c.id ? getCard(c.id).name : '?'));

/** 玩家選指定的手牌（用畫面上的提示選項） */
function choose(s: TutorialSession, cardId: string) {
  const opt = view(s).prompt!.options.find((o) => o.cardId === cardId)!;
  s.submit([opt.key]);
}

/** 一路點擊，直到要玩家操作（或腳本結束）；回傳經過的說明文字 */
function clickToAction(s: TutorialSession): string[] {
  const texts: string[] = [];
  for (let i = 0; i < 60 && progress(s).awaiting === 'click'; i++) {
    texts.push(progress(s).text);
    s.advance();
  }
  return texts;
}

describe('課程清單', () => {
  it('編號從 1 起連續，每課都有課名、說明、預估時間與結束畫面總結', () => {
    expect(LESSONS.map((l) => l.no)).toEqual(LESSONS.map((_, i) => i + 1));
    for (const l of LESSONS) {
      expect(l.title).not.toBe('');
      expect(l.blurb).not.toBe('');
      expect(l.summary).not.toBe('');
      expect(l.minutes).toBeGreaterThan(0);
    }
  });

  it('說明文字一律稱呼對方為「對手」', () => {
    for (const l of LESSONS) {
      const s = start(l.no);
      for (let i = 0; i < 100 && progress(s).awaiting !== null; i++) {
        const t = progress(s).text;
        expect(t).not.toContain('AI');
        expect(t).not.toContain('對方');
        const a = progress(s).awaiting;
        if (a === 'click') s.advance();
        else if (a) choose(s, a.play);
      }
    }
  });
});

describe('第 2 課：爆發與經驗區', () => {
  it('一開局就在爆發階段，輪到我；角色是修行者與教官', () => {
    const v = view(start(2));
    expect(v.phase).toBe('爆發');
    expect(v.waitingFor).toBe(0);
    expect(v.players[0].charId).toBe('修行者');
    expect(v.players[1].charId).toBe('教官');
  });

  it('預設的經驗區有 2 張表側，其他區域是空的；預設的牌不計入牌組，牌組夠抽', () => {
    const v = view(start(2));
    expect(v.players[0].exp).toHaveLength(2);
    expect(v.players[0].exp.every((c) => !c.covered)).toBe(true);
    expect(v.players[1].exp).toHaveLength(0);
    for (const p of [0, 1] as const) {
      const pv = v.players[p];
      expect([pv.moves, pv.pursuit, pv.discard, pv.rage, pv.gear, pv.buff].flat()).toEqual([]);
      expect(pv.deckCount).toBeGreaterThanOrEqual(10);
    }
  });

  it('手牌裡有可以爆發的指定牌；提示是爆發階段，玩家可以選它', () => {
    const s = start(2);
    clickToAction(s);
    const a = progress(s).awaiting;
    expect(a).toEqual({ play: '梅花9' });
    expect(progress(s).highlight).toEqual([{ kind: 'hand-card', cardId: '梅花9' }]);
    expect(view(s).prompt!.title).toContain('爆發階段');
    expect(view(s).prompt!.options.some((o) => o.cardId === '梅花9')).toBe(true);
  });

  it('說明依序出現，經驗張數是實際的數字，用「經驗區」高亮', () => {
    const s = start(2);
    expect(progress(s).text).toContain('爆發階段');
    expect(progress(s).highlight).toEqual([]);
    s.advance();
    expect(progress(s).text).toContain('目前有 2 張卡');
    expect(progress(s).highlight).toEqual([{ kind: 'exp-zone', owner: 'me' }]);
  });

  it('選別張、略過、其他操作都被拒絕，桌面、影格與進度都不變', () => {
    const s = start(2);
    clickToAction(s);
    const before = s.getState();
    choose(s, '黑桃1');
    s.submit([]);
    s.submit(['pass']);
    s.submit(['c1', 'c2']);
    const st = s.getState();
    expect(st.message).not.toBe('');
    expect(st.view).toBe(before.view);
    expect(st.batch.id).toBe(before.batch.id);
    expect(st.tutorial).toBe(before.tutorial);
    expect(view(s).players[0].exp).toHaveLength(2);
  });

  it('放進指定的牌：經驗區加 1、手牌抽 2，停在爆發完成那一格，說明帶入實際張數', () => {
    const s = start(2);
    clickToAction(s);
    const hand = view(s).players[0].hand.length;
    choose(s, '梅花9');
    const v = view(s);
    expect(v.players[0].exp).toHaveLength(3);
    expect(names(v.players[0].exp).at(-1)).toBe('梅花9');
    expect(v.players[0].hand).toHaveLength(hand - 1 + 2);
    expect(names(v.players[0].hand)).not.toContain('梅花9');
    expect(s.getState().batch.frames.at(-1)!.fx).toEqual({ type: 'burst', player: 0 });
    expect(s.getState().batch.hold).toBe(true);
    expect(progress(s).text).toContain('你的經驗區現在有 3 張卡');
    expect(progress(s).highlight).toEqual([{ kind: 'exp-zone', owner: 'me' }, { kind: 'hand-count', owner: 'me' }]);
  });

  it('表側說明與其他來源（歸還、增益到期）都有提到', () => {
    const s = start(2);
    clickToAction(s);
    choose(s, '梅花9');
    const texts = clickToAction(s);
    const all = texts.join('\n');
    expect(all).toContain('表側');
    expect(all).toContain('支付費用');
    expect(all).toContain('歸還');
    expect(all).toContain('增益');
  });

  it('從頭走到尾：到結束畫面，寫入第 2 課的完成紀錄（第 1 課不受影響），不送戰績', () => {
    const s = start(2);
    expect(isLessonDone(2)).toBe(false);
    clickToAction(s);
    choose(s, '梅花9');
    clickToAction(s);
    expect(progress(s).finished).toBe(true);
    expect(progress(s).awaiting).toBeNull();
    expect(progress(s).ending).toEqual({
      heading: '第 2 課完成！',
      summary: getLesson(2).summary,
      next: { kind: 'practice', label: '開始單機練習' },
    });
    expect(isLessonDone(2)).toBe(true);
    expect(isLessonDone(1)).toBe(false);
    s.leave();
    expect(captured).toEqual([]);
  });

  it('中途離開不算完成', () => {
    const s = start(2);
    clickToAction(s);
    choose(s, '梅花9');
    s.leave();
    s.advance();
    expect(isLessonDone(2)).toBe(false);
  });

  it('重來本課：回到爆發階段的初始狀態，不寫完成紀錄', () => {
    const initial = start(2).getState();
    const s = start(2);
    clickToAction(s);
    choose(s, '梅花9');
    s.restart();
    expect(s.getState().view).toEqual(initial.view);
    expect(progress(s)).toEqual(initial.tutorial);
    expect(isLessonDone(2)).toBe(false);
  });
});

describe('第 1 課的結束畫面接第 2 課', () => {
  it('第 1 課後面有第 2 課，按鈕是「下一課」', () => {
    const s = start(1);
    for (let i = 0; i < 200 && progress(s).awaiting !== null; i++) {
      const a = progress(s).awaiting;
      if (a === 'click') s.advance();
      else if (a) choose(s, a.play);
    }
    expect(progress(s).ending).toEqual({
      heading: '第 1 課完成！',
      summary: getLesson(1).summary,
      next: { kind: 'lesson', no: 2, label: '下一課' },
    });
  });
});
