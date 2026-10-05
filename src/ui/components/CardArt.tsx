import type { ReactNode } from 'react';
import { getCard } from '../../data/cards';

/**
 * 簡易卡面插圖：所有圖形都畫在 100×60 的座標內，顏色取自卡片職業色（currentColor）。
 * 共用花色招式＝花色＋數字；特殊卡依特徵挑圖示，少數卡有專屬圖示。
 */

const W = '#e8ecf5';

const sword = (
  <g strokeLinecap="round">
    <path d="M36 46 L72 10" stroke={W} strokeWidth="7" />
    <path d="M28 36 L46 54" stroke="currentColor" strokeWidth="7" />
    <path d="M32 50 L24 58" stroke="currentColor" strokeWidth="5" />
  </g>
);
const shield = (
  <path d="M50 6 L76 15 V31 C76 44 64 52 50 57 C36 52 24 44 24 31 V15 Z" fill="currentColor" stroke={W} strokeWidth="3" />
);
const burst = (
  <polygon
    points="50,3 58,21 79,14 67,31 88,40 65,44 70,58 50,48 30,58 35,44 12,40 33,31 21,14 42,21"
    fill="currentColor" stroke={W} strokeWidth="2.5" strokeLinejoin="round"
  />
);
const crosshair = (
  <g fill="none" stroke={W} strokeWidth="4" strokeLinecap="round">
    <circle cx="50" cy="30" r="19" />
    <circle cx="50" cy="30" r="4" fill="currentColor" />
    <path d="M50 4 V16 M50 44 V56 M24 30 H36 M64 30 H76" />
  </g>
);
const swap = (
  <g fill="none" stroke={W} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M24 22 H72 M62 11 L74 22 L62 33" />
    <path d="M76 42 H28 M38 31 L26 42 L38 53" stroke="currentColor" />
  </g>
);
const rune = (
  <g fill="none" stroke={W} strokeWidth="3.5" strokeLinejoin="round">
    <circle cx="50" cy="30" r="24" />
    <path d="M50 10 L68 40 L32 40 Z" stroke="currentColor" strokeWidth="5" />
    <circle cx="50" cy="32" r="4" fill={W} />
  </g>
);

const GLYPHS: Record<string, ReactNode> = {
  戒備打擊: <>{shield}<g transform="translate(26 6) scale(.6)">{sword}</g></>,
  狙擊印記: <>{crosshair}<g transform="translate(60 30) scale(.4)">{rune}</g></>,
  力量爆破: burst,
};

const TRAIT_GLYPH: Record<string, ReactNode> = {
  攻擊: sword, 法術: burst, 變化: swap, 印記: rune,
};

const SUITS: Record<string, { ch: string; color: string }> = {
  黑桃: { ch: '♠', color: '#cfd6ea' },
  紅心: { ch: '♥', color: '#ef6a6a' },
  梅花: { ch: '♣', color: '#cfd6ea' },
  方塊: { ch: '♦', color: '#ef6a6a' },
};

function glyphFor(id: string): ReactNode {
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
  return GLYPHS[id] ?? c.traits.map((t) => TRAIT_GLYPH[t]).find(Boolean) ?? sword;
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
