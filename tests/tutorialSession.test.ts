import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCard } from '../src/data/cards';
import { TutorialSession, type Session } from '../src/net/session';
import type { BattleRecord } from '../src/stats/records';
import type { RecordReporter } from '../src/stats/reporter';

// 戰績交給 reporter 依賴注入；測試傳入自己的接收器，直接看交出去了什麼
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

const handNames = (s: TutorialSession, p: 0 | 1) =>
  s.getState().view!.players[p].hand.map((c) => (c.id ? getCard(c.id).name : '?')).sort();

describe('新手教學：開局', () => {
  it('我是玩家 A，直接進入對手（玩家 B）先攻的第 1 回合戰鬥階段', () => {
    const v = start().getState().view!;
    expect(start().me).toBe(0);
    expect(v.me).toBe(0);
    expect(v.first).toBe(1);
    expect(v.openingFirst).toBe(1);
    expect(v.turn).toBe(1);
    expect(v.phase).toBe('先手');
    expect(v.waitingFor).toBe(1);
    expect(v.prompt).toBeNull();
  });

  it('角色是見習生與教官', () => {
    const v = start().getState().view!;
    expect(v.players[0].charId).toBe('見習生');
    expect(v.players[1].charId).toBe('教官');
  });

  it('雙方手牌與牌組照牌面配置', () => {
    const s = start();
    const v = s.getState().view!;
    expect(handNames(s, 0)).toEqual(['方塊6', '梅花7', '梅花7', '梅花7', '梅花9', '紅心2', '黑桃1'].sort());
    expect(v.players[1].hand).toHaveLength(4);
    expect(v.players[0].deckCount).toBe(10);
    expect(v.players[1].deckCount).toBe(10);
    for (const p of [0, 1] as const) {
      const pv = v.players[p];
      expect([pv.moves, pv.pursuit, pv.discard, pv.rage, pv.exp, pv.gear, pv.buff].flat()).toEqual([]);
    }
  });

  it('畫面直接從戰鬥階段開始：不播洗牌與抽起始手牌，每一格的手牌都已是牌面配置', () => {
    const st = start().getState();
    expect(st.batch.frames.length).toBeGreaterThan(0);
    for (const f of st.batch.frames) {
      expect(['shuffle', 'deal']).not.toContain(f.fx.type);
      expect(f.view.players[0].hand).toHaveLength(7);
      expect(f.view.players[1].hand).toHaveLength(4);
    }
  });

  it('不送出戰績，狀態是進行中', () => {
    const s = start();
    expect(s.getState().status).toBe('playing');
    s.leave();
    expect(captured).toEqual([]);
  });
});

describe('新手教學：說明依序出現', () => {
  it('第一段說明：範圍內，等點擊、沒有高亮', () => {
    const t = start().getState().tutorial!;
    expect(t.text).toContain('雙方輪流在可出招的“範圍內”打出招式。');
    expect(t.text).toContain('點擊畫面進入下一步。');
    expect(t.awaiting).toBe('click');
    expect(t.highlight).toEqual([]);
  });

  it('說明用換行分行，不留腳本裡的「｜」，也不叫對方「AI」', () => {
    const s = start();
    for (let i = 0; i < 2; i++) {
      const { text } = s.getState().tutorial!;
      expect(text).toContain('\n');
      expect(text).not.toContain('｜');
      expect(text).not.toContain('AI');
      s.advance();
    }
  });

  it('進入下一步：換成第二段說明，高亮雙方戰鬥區，桌面不變', () => {
    const s = start();
    const before = s.getState();
    s.advance();
    const st = s.getState();
    expect(st.tutorial!.text).toContain('由對手先攻，在雙方只要有一方戰鬥區沒招式，出牌都是沒限制的。');
    expect(st.tutorial!.awaiting).toBe('click');
    expect(st.tutorial!.highlight).toEqual([{ kind: 'combat-zones' }]);
    expect(st.view).toBe(before.view);
    expect(st.batch.id).toBe(before.batch.id);
  });

  it('目前的腳本走完就停在最後一步', () => {
    const s = start();
    s.advance();
    const last = s.getState().tutorial!;
    s.advance();
    s.advance();
    expect(s.getState().tutorial).toEqual(last);
  });

  it('進入下一步會通知訂閱者；取消訂閱後不再通知', () => {
    const s = start();
    const cb = vi.fn();
    const off = s.subscribe(cb);
    s.advance();
    expect(cb).toHaveBeenCalledTimes(1);
    off();
    s.advance();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('離開後不再進入下一步', () => {
    const s = start();
    s.leave();
    const before = s.getState().tutorial;
    s.advance();
    expect(s.getState().tutorial).toBe(before);
  });
});

describe('新手教學：操作被拒絕', () => {
  it('在等點擊時出牌：顯示原因，桌面與影格都不變', () => {
    const s = start();
    const before = s.getState();
    s.submit(['c1']);
    const st = s.getState();
    expect(st.message).not.toBe('');
    expect(st.view).toBe(before.view);
    expect(st.batch.id).toBe(before.batch.id);
    expect(st.tutorial).toBe(before.tutorial);
  });

  it('進入下一步會清掉先前被拒絕的訊息', () => {
    const s = start();
    s.submit(['c1']);
    s.advance();
    expect(s.getState().message).toBe('');
  });

  it('沒有作弊介面', () => {
    const s: Session = start();
    expect(s.cheat).toBeUndefined();
  });
});
