import { describe, expect, it } from 'vitest';
import type { Opt } from '../src/engine/types';
import { confirmButton, orderPromptButtons } from '../src/ui/promptButtons';

const o = (key: string, label: string): Opt => ({ key, label });

// 提示按鈕：放棄類（不發動、收招、略過）排左邊用一般色，其他排右邊用強調色
describe('提示按鈕的排列與強調色', () => {
  it('發動與不發動：不發動在左、一般色，發動在右、強調色', () => {
    const r = orderPromptButtons([o('yes', '發動'), o('no', '不發動')]);
    expect(r.map((b) => b.opt.label)).toEqual(['不發動', '發動']);
    expect(r.map((b) => b.primary)).toEqual([false, true]);
  });

  it('選項本來就是不發動在前：順序不變', () => {
    const r = orderPromptButtons([o('no', '不發動'), o('yes', '發動')]);
    expect(r.map((b) => b.opt.label)).toEqual(['不發動', '發動']);
  });

  it('蓋 X 的選擇：不發動在最左，其餘維持原順序、都是強調色', () => {
    const r = orderPromptButtons([o('1', '蓋1'), o('0', '不發動'), o('2', '蓋2')]);
    expect(r.map((b) => b.opt.label)).toEqual(['不發動', '蓋1', '蓋2']);
    expect(r.map((b) => b.primary)).toEqual([false, true, true]);
  });

  it('使用與不使用：不使用在左、一般色，使用在右、強調色', () => {
    const r = orderPromptButtons([o('use', '使用'), o('skip', '不使用')]);
    expect(r.map((b) => b.opt.label)).toEqual(['不使用', '使用']);
    expect(r.map((b) => b.primary)).toEqual([false, true]);
  });

  it('只有收招：一般色', () => {
    const r = orderPromptButtons([o('pass', '收招')]);
    expect(r).toEqual([{ opt: o('pass', '收招'), primary: false }]);
  });

  it('沒有放棄類的選項：全部強調色，順序不變', () => {
    const r = orderPromptButtons([o('a', '效果甲'), o('b', '效果乙')]);
    expect(r.map((b) => b.opt.label)).toEqual(['效果甲', '效果乙']);
    expect(r.every((b) => b.primary)).toBe(true);
  });
});

// 多選提示的確定鈕：沒選牌的略過是放棄類，用一般色；選了牌的確定才用強調色
describe('多選提示的確定鈕', () => {
  it('可以不選、一張都沒選：略過，一般色', () => {
    expect(confirmButton(0, 0, 2)).toEqual({ label: '略過', primary: false });
  });

  it('完全不能選、只能按略過繼續（看完牌）：略過是唯一的前進鈕，用強調色', () => {
    expect(confirmButton(0, 0, 0)).toEqual({ label: '略過', primary: true });
  });

  it('選了牌：確定與張數，強調色', () => {
    expect(confirmButton(2, 0, 2)).toEqual({ label: '確定（2）', primary: true });
  });

  it('至少要選 1 張、還沒選：仍是確定（會停用），強調色', () => {
    expect(confirmButton(0, 1, 2)).toEqual({ label: '確定（0）', primary: true });
  });
});
