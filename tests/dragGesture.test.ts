import { describe, expect, it } from 'vitest';
import type { Request } from '../src/engine/types';
import { classifyMove, dragZone, dropTarget, MOUSE_SLOP, TOUCH_DRAG_UP } from '../src/ui/dragGesture';
import { tapCard } from '../src/ui/touchTap';

const at = (x: number, y: number) => ({ x, y });

describe('手勢判斷：滑鼠', () => {
  it('移動不到門檻仍是點擊', () => {
    expect(classifyMove(at(100, 100), at(100 + MOUSE_SLOP - 1, 100), false)).toBe('pending');
  });
  it('移動超過門檻就是拖曳，任何方向都算', () => {
    expect(classifyMove(at(100, 100), at(100, 100 + MOUSE_SLOP), false)).toBe('drag');
    expect(classifyMove(at(100, 100), at(90, 105), false)).toBe('drag');
  });
});

describe('手勢判斷：觸控', () => {
  it('還沒移動夠遠時先不決定', () => {
    expect(classifyMove(at(100, 100), at(103, 96), true)).toBe('pending');
  });
  it('往上超過門檻立即開始拖曳', () => {
    expect(classifyMove(at(100, 100), at(100, 100 - TOUCH_DRAG_UP), true)).toBe('drag');
    expect(classifyMove(at(100, 100), at(104, 80), true)).toBe('drag');
  });
  it('橫向為主就是捲動手牌列', () => {
    expect(classifyMove(at(100, 100), at(120, 98), true)).toBe('scroll');
    expect(classifyMove(at(100, 100), at(70, 95), true)).toBe('scroll');
  });
  it('往下移動當成捲動，不開始拖曳', () => {
    expect(classifyMove(at(100, 100), at(100, 120), true)).toBe('scroll');
  });
  it('手牌列不能橫向捲動時，往上有分量就算拖曳，橫向再多也沒關係', () => {
    expect(classifyMove(at(100, 100), at(160, 90), true, false)).toBe('drag');
    expect(classifyMove(at(100, 100), at(180, 92), true, false)).toBe('drag');
  });
  it('手牌列不能捲動時，沒有往上就先等，移動夠遠才放棄', () => {
    expect(classifyMove(at(100, 100), at(115, 100), true, false)).toBe('pending');
    expect(classifyMove(at(100, 100), at(130, 100), true, false)).toBe('scroll');
    expect(classifyMove(at(100, 100), at(100, 125), true, false)).toBe('scroll');
  });
  it('斜向時上下分量不小於橫向分量才算拖曳', () => {
    expect(classifyMove(at(100, 100), at(110, 88), true)).toBe('drag');
    expect(classifyMove(at(100, 100), at(120, 90), true)).toBe('scroll');
  });
});

describe('放置區落點', () => {
  const zones = [
    { zone: 'moves' as const, box: { left: 0, top: 100, right: 200, bottom: 300 } },
    { zone: 'exp' as const, box: { left: 210, top: 400, right: 260, bottom: 460 } },
  ];
  it('放開的位置在放置區內就回傳那個放置區', () => {
    expect(dropTarget(at(100, 200), zones)).toBe('moves');
    expect(dropTarget(at(230, 430), zones)).toBe('exp');
  });
  it('不在任何放置區就回傳 null', () => {
    expect(dropTarget(at(100, 350), zones)).toBeNull();
  });
  it('可以放寬判定範圍', () => {
    expect(dropTarget(at(205, 430), zones)).toBeNull();
    expect(dropTarget(at(205, 430), zones, 8)).toBe('exp');
  });
});

describe('哪些牌能拖曳', () => {
  const base: Request = {
    player: 0, title: '爆發階段', min: 0, max: 1, dropZone: 'exp',
    options: [{ key: 'c1', label: 'a', uid: 1, cardId: '黑桃1' }, { key: 'c2', label: 'b', uid: 2, cardId: '黑桃2' }],
  };
  it('指定了放置區的單選提示，選項上的牌可以拖到那個放置區', () => {
    expect(dragZone(base, 'c1')).toBe('exp');
    expect(dragZone({ ...base, min: 1, max: 1, dropZone: 'moves' }, 'c2')).toBe('moves');
  });
  it('不是選項的牌不能拖', () => {
    expect(dragZone(base, 'c9')).toBeNull();
  });
  it('沒有放置區、多選、排序、沒有提示都不能拖', () => {
    expect(dragZone({ ...base, dropZone: undefined }, 'c1')).toBeNull();
    expect(dragZone({ ...base, max: 2 }, 'c1')).toBeNull();
    expect(dragZone({ ...base, ordered: true }, 'c1')).toBeNull();
    expect(dragZone(null, 'c1')).toBeNull();
  });
});

describe('觸控兩段點擊', () => {
  it('第一下只預覽，不送出', () => {
    expect(tapCard(null, 5, true)).toEqual({ preview: 5, submit: false });
  });
  it('同一張再點一下才送出', () => {
    expect(tapCard(5, 5, true)).toEqual({ preview: null, submit: true });
  });
  it('點別張改成預覽那一張', () => {
    expect(tapCard(5, 7, true)).toEqual({ preview: 7, submit: false });
  });
  it('不能送出的牌再點一下只是取消預覽', () => {
    expect(tapCard(5, 5, false)).toEqual({ preview: null, submit: false });
  });
});
