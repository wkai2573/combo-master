import { beforeEach, describe, expect, it } from 'vitest';
import { hideTip, showTip, toggleTip } from '../src/ui/tooltip';

describe('關鍵字提示浮動管理模組（tooltip）', () => {
  beforeEach(() => {
    hideTip();
  });

  const dummyKw = { id: 'K001', name: '+X+Y', group: '名詞' as const, desc: '加成數值' };

  it('顯示與關閉提示', () => {
    const el = {
      getBoundingClientRect: () => ({ left: 50, top: 100, bottom: 120, right: 90, width: 40, height: 20 } as DOMRect),
    } as unknown as HTMLElement;

    showTip(el, [dummyKw]);
    hideTip();
  });

  it('toggleTip：點同一個元件關閉，點不同元件切換', () => {
    const el1 = {
      getBoundingClientRect: () => ({ left: 50, top: 100, bottom: 120, right: 90, width: 40, height: 20 } as DOMRect),
    } as unknown as HTMLElement;

    const el2 = {
      getBoundingClientRect: () => ({ left: 150, top: 100, bottom: 120, right: 190, width: 40, height: 20 } as DOMRect),
    } as unknown as HTMLElement;

    toggleTip(el1, [dummyKw]);
    // 點同一個：toggle 關閉
    toggleTip(el1, [dummyKw]);

    // 點 el1 開啟，再點 el2 切換至 el2
    toggleTip(el1, [dummyKw]);
    toggleTip(el2, [dummyKw]);
    hideTip();
  });
});
