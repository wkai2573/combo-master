import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCard } from '../src/data/cards';
import { TutorialSession } from '../src/net/session';
import type { BattleRecord } from '../src/stats/records';
import type { RecordReporter } from '../src/stats/reporter';

// 教學腳本的後半：停在影格、追擊、傷害計算、勝負。整場走完的測試就是 ADR 0008 的把關：
// 卡表改了白板卡的數值，讓教學打不贏或某一步不合法，這裡會失敗
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

function clickToPlay(s: TutorialSession) {
  for (let i = 0; i < 50 && progress(s).awaiting === 'click'; i++) s.advance();
}

function playCard(s: TutorialSession, cardId: string) {
  const opt = s.getState().view!.prompt!.options.find((o) => o.cardId === cardId)!;
  s.submit([opt.key]);
}

/** 範圍兩端：雙方招式卡疊最上方的連擊值，小的在前 */
function range(s: TutorialSession): [number, number] {
  const combos = ([0, 1] as const).map((p) => getCard(s.getState().view!.players[p].moves.at(-1)!.id!).combo);
  return [Math.min(...combos), Math.max(...combos)];
}

/** 從頭走到玩家出完第一張梅花7：停在對手收招那一格 */
function toSecondSeven(): TutorialSession {
  const s = start();
  clickToPlay(s);
  playCard(s, '黑桃1');
  clickToPlay(s);
  playCard(s, '紅心2');
  clickToPlay(s);
  playCard(s, '梅花7');
  return s;
}

const lastFx = (s: TutorialSession) => s.getState().batch.frames.at(-1)!.fx;
const fxTypes = (s: TutorialSession) => s.getState().batch.frames.map((f) => f.fx.type);

/** 點擊進入下一步，直到說明裡出現指定的文字 */
function advanceTo(s: TutorialSession, text: string) {
  for (let i = 0; i < 30 && !progress(s).text.includes(text); i++) s.advance();
  expect(progress(s).text, `沒有走到「${text}」`).toContain(text);
}

describe('新手教學：停在影格', () => {
  it('對手收招：送出的最後一格就是對手的收招，桌面是那一格的桌面；點擊後才換到要求出牌', () => {
    const s = toSecondSeven();
    expect(progress(s).text).toContain('看來對手沒牌能出招了，所以只能選擇收招。');
    expect(progress(s).awaiting).toBe('click');
    expect(lastFx(s)).toEqual({ type: 'pass', player: 1 });
    expect(s.getState().batch.hold).toBe(true);
    expect(s.getState().view!.players[1].passed).toBe(true);
    expect(s.getState().view!.prompt).toBeNull();

    s.advance();
    expect(progress(s).awaiting).toEqual({ play: '梅花7' });
    expect(progress(s).text).toContain('輪到你出招了。');
    expect(progress(s).highlight).toEqual([{ kind: 'hand-card', cardId: '梅花7' }]);
    expect(s.getState().batch.hold).toBeFalsy();
    expect(s.getState().view!.prompt).not.toBeNull();
  });

  it('停在影格時，後面的影格先扣著：點擊前桌面不會往後走', () => {
    const s = toSecondSeven();
    s.advance();
    playCard(s, '梅花7');
    // 我也沒牌可出：自動收招，在這一格停下；引擎其實已經往後跑完，但畫面還在這一格
    expect(progress(s).text).toContain('怎麼自動收招了呢？');
    expect(lastFx(s)).toEqual({ type: 'pass', player: 0 });
    expect(progress(s).highlight).toEqual([{ kind: 'pass-text', owner: 'me' }]);
    const v = s.getState().view!;
    expect(v.players[0].passed).toBe(true);
    expect(v.players[0].pursuit).toHaveLength(0);
    expect(v.phase).toBe('反擊');
    expect(v.winner).toBeNull();
    expect(s.getState().status).toBe('playing');
  });

  it('同一個停點的第二段說明：不送新影格，桌面不變，再點才繼續播放', () => {
    const s = toSecondSeven();
    s.advance();
    playCard(s, '梅花7');
    const before = s.getState();
    s.advance();
    expect(progress(s).text).toContain('每回合自己的招式卡疊只能重複一次連擊值');
    expect(progress(s).text).toContain('你已經出了兩張 7，手中的 7 不能再出；6 和 9 又不在範圍 7~7 內，只好收招。');
    expect(progress(s).highlight).toEqual([{ kind: 'combat-cards', owner: 'me', cardId: '梅花7' }]);
    expect(s.getState().batch.id).toBe(before.batch.id);
    expect(s.getState().view).toBe(before.view);

    s.advance();
    expect(progress(s).text).toContain('當雙方都收招後，會有一次追擊。');
    expect(s.getState().batch.id).toBeGreaterThan(before.batch.id);
    expect(lastFx(s)).toEqual({ type: 'banner', kind: 'phase', name: '追擊階段' });
    expect(fxTypes(s)).not.toContain('flip');
    expect(progress(s).highlight).toEqual([{ kind: 'pursuit-step' }]);
  });
});

describe('新手教學：追擊與傷害計算', () => {
  /** 走到追擊階段那一格的停點 */
  function toPursuit() {
    const s = toSecondSeven();
    s.advance();
    playCard(s, '梅花7');
    s.advance();
    s.advance();
    return s;
  }

  it('先攻方（對手）先翻出追擊判定卡：高亮牌組數量與判定卡', () => {
    const s = toPursuit();
    s.advance();
    expect(progress(s).text).toContain('追擊判定卡會由牌組頂端翻出1張，並由先攻方先翻出追擊判定卡。');
    expect(lastFx(s)).toMatchObject({ type: 'flip', player: 1 });
    expect(progress(s).highlight).toEqual([{ kind: 'deck-count', owner: 'opp' }, { kind: 'judge-card' }]);
  });

  it('追擊失敗：說明帶入實際的範圍與翻出的連擊值，高亮失敗文字、連擊值', () => {
    const s = toPursuit();
    s.advance();
    s.advance();
    const fx = lastFx(s);
    expect(fx).toMatchObject({ type: 'flipResult', player: 1, ok: false });
    const [lo, hi] = range(s);
    const combo = getCard((fx as { cardId: string }).cardId).combo;
    expect(progress(s).text).toContain('不在“範圍內”的才會成功');
    expect(progress(s).text).toContain(`目前範圍是${lo}~${hi}，而翻出來的連擊值剛好是${combo}，所以失敗了。`);
    expect(progress(s).highlight).toEqual([
      { kind: 'result-text', ok: false }, { kind: 'top-combos' }, { kind: 'judge-card', parts: ['combo'] },
    ]);
  });

  it('失敗的卡加入手中：同一個停點的第二段說明，高亮對手的手牌數量', () => {
    const s = toPursuit();
    s.advance();
    s.advance();
    const batch = s.getState().batch.id;
    s.advance();
    expect(progress(s).text).toContain('追擊判定失敗的卡會加入手中');
    expect(progress(s).highlight).toEqual([{ kind: 'hand-count', owner: 'opp' }]);
    expect(s.getState().batch.id).toBe(batch);
    expect(s.getState().view!.players[1].hand).toHaveLength(2);
  });

  it('換玩家翻牌，追擊成功：高亮成功文字，說明連擊值在範圍之外', () => {
    const s = toPursuit();
    advanceTo(s, '現在換到後攻方判定。');
    expect(lastFx(s)).toMatchObject({ type: 'flip', player: 0 });
    s.advance();
    expect(lastFx(s)).toMatchObject({ type: 'flipResult', player: 0, ok: true });
    const [lo, hi] = range(s);
    expect(progress(s).text).toContain(`目前範圍是${lo}~${hi}`);
    expect(progress(s).text).toContain('在這之外，所以成功了。');
    expect(progress(s).highlight).toEqual([
      { kind: 'result-text', ok: true }, { kind: 'top-combos' }, { kind: 'judge-card', parts: ['combo'] },
    ]);
  });

  it('追擊卡進追擊卡疊：高亮追擊卡的攻防與雙方總攻擊、總防禦', () => {
    const s = toPursuit();
    advanceTo(s, '現在換到後攻方判定。');
    s.advance();
    const batch = s.getState().batch.id;
    s.advance();
    expect(progress(s).text).toContain('追擊判定成功的卡會放入戰鬥區並將攻擊力計算到總攻擊力中，防禦力不會計算。');
    expect(progress(s).highlight).toEqual([
      { kind: 'pursuit-card', owner: 'me', parts: ['atk', 'def'] }, { kind: 'total', stat: 'atk' }, { kind: 'total', stat: 'def' },
    ]);
    expect(s.getState().batch.id).toBe(batch);
    expect(s.getState().view!.players[0].pursuit).toHaveLength(1);
  });

  it('傷害計算：說明帶入這一局實際的總攻擊、總防禦與傷害', () => {
    const s = toPursuit();
    advanceTo(s, '你的總攻擊');
    const fx = lastFx(s);
    expect(fx.type).toBe('calc');
    const { atk, def, dmg } = fx as { atk: [number, number]; def: [number, number]; dmg: [number, number] };
    const t = progress(s).text;
    expect(t).toContain(`你的總攻擊 ${atk[0]} − 對手總防禦 ${def[1]} = 對手受到 ${dmg[1]} 點傷害`);
    expect(t).toContain(`對手的總攻擊 ${atk[1]} − 你的總防禦 ${def[0]} = 你受到 ${dmg[0]} 點傷害`);
    expect(dmg[1]).toBeGreaterThan(0);
    expect(dmg[0]).toBe(0);
  });

  it('勝負影格：停在這一格，勝負已定但還沒結束；高亮對手牌組', () => {
    const s = toPursuit();
    advanceTo(s, '牌組就是生命');
    expect(lastFx(s)).toEqual({ type: 'gameEnd', winner: 0 });
    const t = progress(s).text;
    expect(t).toContain('牌組就是生命，當牌組歸0時就輸了！');
    expect(t).toContain('恭喜你勝利了！');
    expect(progress(s).highlight).toEqual([{ kind: 'deck', owner: 'opp' }]);
    expect(s.getState().view!.winner).toBe(0);
    expect(s.getState().status).toBe('playing');
  });
});

describe('新手教學：整場走完（ADR 0008 的把關）', () => {
  /** 一路點擊與出牌，直到腳本走完 */
  function playToEnd() {
    const s = start();
    const texts: string[] = [];
    for (let i = 0; i < 200 && progress(s).awaiting !== null; i++) {
      const a = progress(s).awaiting;
      if (a === 'click') {
        texts.push(progress(s).text);
        s.advance();
      } else if (a) {
        playCard(s, a.play);
      }
    }
    return { s, texts };
  }

  it('照腳本從頭走到尾：最後玩家獲勝、對手牌組 0 張、玩家沒受傷害', () => {
    const { s } = playToEnd();
    const st = s.getState();
    expect(progress(s).awaiting).toBeNull();
    expect(st.status).toBe('over');
    expect(st.view!.winner).toBe(0);
    expect(st.view!.players[1].deckCount).toBe(0);
    expect(st.view!.players[0].rage).toHaveLength(0);
    expect(st.view!.players[0].deckCount).toBeGreaterThan(0);
  });

  it('沒有送出任何戰績，整場也沒有用到計時器', () => {
    const { s } = playToEnd();
    s.leave();
    expect(captured).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('所有說明用「對手」稱呼對方，不含「AI」與「｜」；走完之後出牌一律被拒絕', () => {
    const { s, texts } = playToEnd();
    expect(texts.length).toBeGreaterThan(20);
    for (const t of texts) {
      expect(t).not.toContain('AI');
      expect(t).not.toContain('｜');
      expect(t).not.toContain('對方');
    }
    const before = s.getState();
    s.advance();
    s.submit(['c1']);
    expect(s.getState().view).toBe(before.view);
    expect(s.getState().batch.id).toBe(before.batch.id);
  });

  it('點完勝負那一步，才送出最後的影格、狀態才變成結束', () => {
    const s = toSecondSeven();
    s.advance();
    playCard(s, '梅花7');
    advanceTo(s, '牌組就是生命');
    const id = s.getState().batch.id;
    s.advance();
    expect(s.getState().status).toBe('over');
    expect(s.getState().batch.id).toBeGreaterThan(id);
    expect(progress(s).awaiting).toBeNull();
  });
});
