import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '../src/data/cards';
import { isExCardId } from '../src/data/exCards';
import { isCardEnabled, isVanilla } from '../src/data/enabledCards';
import { CARD_ART, hasOwnArt } from '../src/ui/components/cardArtGlyphs';

// 白板卡是花色加數字，不在這裡；開放的效果卡與 Ex 卡每張都要有自己的圖
const needArt = ALL_CARDS.filter((c) => !isVanilla(c) && (isCardEnabled(c) || isExCardId(c.id)));

describe('效果卡的卡圖', () => {
  it('每張開放的效果卡與 Ex 卡都有專屬卡圖', () => {
    expect(needArt.length).toBeGreaterThanOrEqual(39);
    const missing = needArt.filter((c) => !hasOwnArt(c.id)).map((c) => c.name);
    expect(missing).toEqual([]);
  });

  it('每張卡圖都不一樣：不會有兩張卡共用同一個圖', () => {
    const seen = new Map<string, string>();
    const dup: string[] = [];
    for (const c of needArt) {
      const svg = renderToStaticMarkup(CARD_ART[c.id]);
      const other = seen.get(svg);
      if (other) dup.push(`${c.name} 與 ${other}`);
      seen.set(svg, c.name);
    }
    expect(dup).toEqual([]);
  });

  it('沒有多餘的圖：圖的鍵都對得上一張卡', () => {
    const ids = new Set(ALL_CARDS.map((c) => c.id));
    expect(Object.keys(CARD_ART).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('卡圖不是空的', () => {
    for (const c of needArt) expect(renderToStaticMarkup(CARD_ART[c.id]).length, c.name).toBeGreaterThan(80);
  });
});
