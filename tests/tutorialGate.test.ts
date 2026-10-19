import { describe, expect, it } from 'vitest';
import type { Request } from '../src/engine/types';
import { gatePrompt } from '../src/tutorial/gate';
import type { TutorialProgress } from '../src/tutorial/script';

const prompt: Request = {
  player: 0, title: '反擊步驟：選擇 1 張招式出招，或收招', min: 1, max: 1, dropZone: 'moves',
  options: [
    { key: 'c1', label: '黑桃1', uid: 1, cardId: '黑桃1' },
    { key: 'c2', label: '梅花7', uid: 2, cardId: '梅花7' },
    { key: 'c3', label: '梅花7', uid: 3, cardId: '梅花7' },
    { key: 'pass', label: '收招' },
  ],
};
const progress = (awaiting: TutorialProgress['awaiting']): TutorialProgress => ({ text: 'x', highlight: [], awaiting, finished: false, ending: null });

describe('教學的操作封鎖：玩家看得到的提示', () => {
  it('不是教學：提示原樣給玩家', () => {
    expect(gatePrompt(null, prompt)).toBe(prompt);
  });

  it('沒有提示就沒有提示', () => {
    expect(gatePrompt(progress({ play: '黑桃1' }), null)).toBeNull();
  });

  it('等點擊或腳本走完：玩家不能選任何東西', () => {
    expect(gatePrompt(progress('click'), prompt)).toBeNull();
    expect(gatePrompt(progress(null), prompt)).toBeNull();
  });

  it('要求出牌：只留下指定的牌，其他牌與收招都拿掉，提示的其他內容不變', () => {
    const gated = gatePrompt(progress({ play: '梅花7' }), prompt)!;
    expect(gated.options.map((o) => o.key)).toEqual(['c2', 'c3']);
    expect(gated.dropZone).toBe('moves');
    expect(gated.title).toBe(prompt.title);
  });

  it('指定的牌不在選項裡：沒有可選的', () => {
    expect(gatePrompt(progress({ play: '紅心2' }), prompt)).toBeNull();
  });
});
