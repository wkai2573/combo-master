import type { ReactNode } from 'react';
import { getCard } from '../../data/cards';
import { CARD_ART, hasOwnArt } from './cardArtGlyphs';

/**
 * 卡面插圖：所有圖形都畫在 100×60 的座標內，顏色取自卡種色（currentColor）。
 * 白板卡＝花色加數字；效果卡與 Ex 卡各有專屬的圖（cardArtGlyphs.tsx），測試保證每張都有而且互不相同。
 */

const W = '#e8ecf5';

const SUITS: Record<string, { ch: string; color: string }> = {
  黑桃: { ch: '♠', color: '#cfd6ea' },
  紅心: { ch: '♥', color: '#ef6a6a' },
  梅花: { ch: '♣', color: '#cfd6ea' },
  方塊: { ch: '♦', color: '#ef6a6a' },
};

/** 還沒有專屬卡圖的卡（新卡尚未開放時）：一個問號 */
const placeholder = (
  <text x="50" y="46" textAnchor="middle" fontSize="44" fontWeight="800" fill={W} opacity=".7">?</text>
);

function glyphFor(id: string): ReactNode {
  if (hasOwnArt(id)) return CARD_ART[id];
  const c = getCard(id);
  const suit = SUITS[id.slice(0, 2)];
  if (c.kind === 'move' && suit && c.traits.length === 0) {
    const n = id.slice(2);
    return (
      <>
        <text x="30" y="46" textAnchor="middle" fontSize="44" fill={suit.color}>{suit.ch}</text>
        <text x="70" y="47" textAnchor="middle" fontSize="42" fontWeight="800" fill={W} stroke="#0008" strokeWidth="1">{n}</text>
      </>
    );
  }
  return placeholder;
}

export function CardArt({ id }: { id: string }) {
  return (
    <div className="art">
      <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        {glyphFor(id)}
      </svg>
    </div>
  );
}
