import type { ReactNode } from 'react';
import { getCard } from '../../data/cards';
import type { CardData } from '../../data/types';
import { CARD_ART, hasOwnArt } from './cardArtGlyphs';
import { moveCardFaces } from '../moveCardFaces';
import { gameFaceFor, imageFor } from '../../cardLayout/gameFaces';

/**
 * 沒有成品卡圖時，使用 100×60 的 SVG 插圖。
 * 白板卡顯示花色與數字，效果卡與 Ex 卡使用各自的圖示。
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

function glyphFor(id: string, card?: CardData): ReactNode {
  if (hasOwnArt(id)) return CARD_ART[id];
  const c = card ?? getCard(id);
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

export function CardArt({ id, card }: { id: string; card?: CardData }) {
  const layered = gameFaceFor(id);
  const artLayer = layered?.template.layers.find((layer) => layer.kind === 'image' && layer.source === 'art' && !layer.hidden);
  const portrait = layered && artLayer?.kind === 'image' && imageFor(artLayer, layered.uid, card ?? getCard(id), layered.content);
  const face = layered ? undefined : moveCardFaces.get(id);
  return (
    <div className="art">
      {portrait ? <img className="portrait-preview" src={portrait} alt="" draggable={false} /> : face ? (
        <img className="face-preview" src={face} alt="" draggable={false} />
      ) : (
        <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          {glyphFor(id, card)}
        </svg>
      )}
    </div>
  );
}
