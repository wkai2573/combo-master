import type { ReactNode } from 'react';
import { getCard } from '../../data/cards';

/**
 * 簡易卡面插圖：所有圖形都畫在 100×60 的座標內，顏色取自卡片職業色（currentColor）。
 * 共用花色招式＝花色＋數字；特殊卡每張一個圖示，讓玩家能一眼分辨。
 */

const W = '#e8ecf5';

const sword = (
  <g strokeLinecap="round">
    <path d="M36 46 L72 10" stroke={W} strokeWidth="7" />
    <path d="M28 36 L46 54" stroke="currentColor" strokeWidth="7" />
    <path d="M32 50 L24 58" stroke="currentColor" strokeWidth="5" />
  </g>
);
const slashes = (
  <g stroke={W} strokeWidth="6" strokeLinecap="round">
    <path d="M26 50 L44 10" /><path d="M42 50 L60 10" /><path d="M58 50 L76 10" />
  </g>
);
const shield = (
  <path d="M50 6 L76 15 V31 C76 44 64 52 50 57 C36 52 24 44 24 31 V15 Z" fill="currentColor" stroke={W} strokeWidth="3" />
);
const drop = (
  <path d="M50 6 C60 22 72 30 72 40 A22 20 0 0 1 28 40 C28 30 40 22 50 6 Z" fill="#d94a5a" stroke={W} strokeWidth="3" />
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
const plus = (
  <g>
    <rect x="42" y="8" width="16" height="44" rx="4" fill="#4fc98b" stroke={W} strokeWidth="2.5" />
    <rect x="28" y="22" width="44" height="16" rx="4" fill="#4fc98b" stroke={W} strokeWidth="2.5" />
  </g>
);
const swap = (
  <g fill="none" stroke={W} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M24 22 H72 M62 11 L74 22 L62 33" />
    <path d="M76 42 H28 M38 31 L26 42 L38 53" stroke="currentColor" />
  </g>
);
const skull = (
  <g>
    <path d="M26 30 C26 12 74 12 74 30 C74 38 68 40 66 42 V50 H34 V42 C32 40 26 38 26 30 Z" fill={W} />
    <circle cx="39" cy="31" r="6" fill="#1a1d29" /><circle cx="61" cy="31" r="6" fill="#1a1d29" />
    <path d="M50 36 L46 44 H54 Z" fill="#1a1d29" />
    <path d="M42 50 V44 M50 50 V46 M58 50 V44" stroke="#1a1d29" strokeWidth="2.5" />
  </g>
);
const rune = (
  <g fill="none" stroke={W} strokeWidth="3.5" strokeLinejoin="round">
    <circle cx="50" cy="30" r="24" />
    <path d="M50 10 L68 40 L32 40 Z" stroke="currentColor" strokeWidth="5" />
    <circle cx="50" cy="32" r="4" fill={W} />
  </g>
);
const totem = (
  <g stroke={W} strokeWidth="2.5">
    <rect x="36" y="4" width="28" height="15" rx="3" fill="currentColor" />
    <rect x="32" y="21" width="36" height="17" rx="3" fill="#3a4262" />
    <rect x="36" y="40" width="28" height="16" rx="3" fill="currentColor" />
    <circle cx="44" cy="12" r="2.5" fill={W} /><circle cx="56" cy="12" r="2.5" fill={W} />
    <path d="M42 30 H58" />
  </g>
);
const jaws = (
  <g fill="none" stroke={W} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
    <path d="M16 42 Q50 -2 84 42" stroke="currentColor" strokeWidth="6" />
    <path d="M16 42 L25 28 L34 42 L43 28 L52 42 L61 28 L70 42 L79 28 L84 42" />
    <path d="M10 50 H90" stroke="currentColor" strokeWidth="5" />
  </g>
);
const cave = (
  <g stroke={W} strokeWidth="3.5" strokeLinejoin="round">
    <path d="M12 56 V30 C12 6 88 6 88 30 V56 Z" fill="#3a4262" />
    <path d="M26 56 V36 C26 22 74 22 74 36 V56 Z" fill="#0f1219" />
    <path d="M30 36 L36 46 L42 34 L50 46 L58 34 L64 46 L70 36" fill="none" stroke="currentColor" />
  </g>
);
const loop = (
  <g fill="none" stroke={W} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M72 22 A24 20 0 1 0 74 38" />
    <path d="M74 8 V24 H58" stroke="currentColor" />
  </g>
);
const heart = (
  <path d="M50 54 C14 30 22 6 40 12 C46 14 50 20 50 20 C50 20 54 14 60 12 C78 6 86 30 50 54 Z" fill="#e0587a" stroke={W} strokeWidth="3" />
);
const ring = (
  <g>
    <ellipse cx="50" cy="34" rx="26" ry="18" fill="none" stroke="#f0c040" strokeWidth="9" />
    <ellipse cx="50" cy="34" rx="26" ry="18" fill="none" stroke={W} strokeWidth="1.5" opacity=".6" />
    <circle cx="50" cy="14" r="7" fill="#5ab8ff" stroke={W} strokeWidth="2" />
  </g>
);
const moonSword = (
  <g>
    <path d="M62 8 A22 22 0 1 0 62 52 A16 18 0 1 1 62 8 Z" fill="#f0e6a0" />
    <path d="M40 48 L78 12" stroke={W} strokeWidth="6" strokeLinecap="round" />
    <path d="M44 38 L58 52" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
  </g>
);
const foot = (
  <g stroke={W} strokeWidth="2.5">
    <path d="M18 8 Q50 -2 82 8" fill="none" strokeDasharray="4 4" />
    <ellipse cx="50" cy="40" rx="15" ry="13" fill="#d9c7a8" />
    <ellipse cx="36" cy="22" rx="5" ry="8" fill="#d9c7a8" />
    <ellipse cx="50" cy="18" rx="5" ry="9" fill="#d9c7a8" />
    <ellipse cx="64" cy="22" rx="5" ry="8" fill="#d9c7a8" />
  </g>
);
const doll = (
  <g stroke={W} strokeWidth="2.5">
    <g opacity=".45"><circle cx="66" cy="16" r="9" fill="currentColor" /><rect x="56" y="27" width="20" height="26" rx="6" fill="currentColor" /></g>
    <circle cx="42" cy="16" r="10" fill="#d9b88c" />
    <rect x="30" y="28" width="24" height="26" rx="7" fill="currentColor" />
    <path d="M38 14 L40 14 M46 14 L48 14" strokeWidth="3" />
  </g>
);
const flask = (
  <g stroke={W} strokeWidth="3" strokeLinejoin="round">
    <path d="M42 6 H58 V22 L76 50 Q80 56 72 56 H28 Q20 56 24 50 L42 22 Z" fill="#2a3350" />
    <path d="M32 42 H68 L76 52 Q78 54 74 54 H26 Q22 54 24 52 Z" fill="currentColor" stroke="none" />
    <circle cx="48" cy="46" r="3" fill={W} stroke="none" /><circle cx="58" cy="40" r="2.5" fill={W} stroke="none" />
  </g>
);
const grid = (
  <g stroke={W} strokeWidth="2">
    {[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => (
      <rect key={`${r}${c}`} x={26 + c * 17} y={6 + r * 16} width="15" height="14" rx="2"
        fill={(r + c) % 2 === 0 ? 'currentColor' : '#2a3350'} />
    )))}
  </g>
);
const downArrows = (
  <g fill="none" stroke={W} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M30 10 L50 28 L70 10" /><path d="M30 32 L50 50 L70 32" stroke="currentColor" />
  </g>
);
const bigX = (
  <g stroke={W} strokeWidth="4" strokeLinecap="round" opacity=".75">
    <path d="M24 8 L76 52 M76 8 L24 52" />
  </g>
);

const text = (t: string, size = 30, x = 50, y = 44, fill: string = W) => (
  <text x={x} y={y} textAnchor="middle" fontSize={size} fontWeight="800" fill={fill} stroke="#0008" strokeWidth="1">{t}</text>
);

/** 在圖示角落疊上小標記 */
const badge = (t: string, fill = '#f0b93a') => (
  <g>
    <circle cx="80" cy="46" r="11" fill={fill} stroke="#0008" strokeWidth="1.5" />
    <text x="80" y="52" textAnchor="middle" fontSize="16" fontWeight="800" fill="#1b1405">{t}</text>
  </g>
);

const trapWith = (extra: ReactNode) => (<>{jaws}{extra}</>);

const GLYPHS: Record<string, ReactNode> = {
  // 劍士
  吸血打擊: <>{sword}<g transform="translate(22 -2) scale(.6)">{drop}</g></>,
  戒備打擊: <>{shield}<g transform="translate(26 6) scale(.6)">{sword}</g></>,
  必殺一擊: <>{burst}<g transform="translate(14 2) scale(.7)">{sword}</g></>,
  '3連擊': <>{slashes}{badge('3')}</>,
  先祖圖騰: <>{totem}{badge('祖', '#e0583f')}</>,
  不變應萬變: loop,
  // 盜賊
  陷阱3: trapWith(badge('3')),
  陷阱4: trapWith(badge('4')),
  陷阱5: trapWith(badge('5')),
  陷阱6: trapWith(badge('6')),
  陷阱7: trapWith(badge('7')),
  陷阱投擲: trapWith(<path d="M60 14 H88 M80 6 L90 14 L80 22" fill="none" stroke={W} strokeWidth="5" strokeLinecap="round" />),
  陷阱回收: trapWith(<g transform="translate(46 -4) scale(.55)">{loop}</g>),
  驚嚇陷阱: trapWith(badge('!', '#ef6a6a')),
  陷阱變換: trapWith(<g transform="translate(50 -6) scale(.5)">{swap}</g>),
  陷阱窟: cave,
  狙擊印記: <>{crosshair}<g transform="translate(60 30) scale(.4)">{rune}</g></>,
  誘餌圖騰: <>{totem}{badge('餌', '#a56ae0')}</>,
  // 商人
  布局: grid,
  煉金印記: flask,
  精準追擊: crosshair,
  式不過3: <>{bigX}{text('3', 36, 50, 46, '#f0b93a')}</>,
  '777': text('777', 34, 50, 44, '#f0c040'),
  // 法師
  力量爆破: burst,
  黑暗詛咒: skull,
  降級詛咒: <>{downArrows}</>,
  // 共用
  快速治療: plus,
  // 裝備／增益
  金手鐲: ring,
  月光劍: moonSword,
  兔腳項鍊: foot,
  慢速治癒: heart,
  替身: doll,
};

const TRAIT_GLYPH: Record<string, ReactNode> = {
  攻擊: sword, 法術: burst, 變化: swap, 詛咒: skull, 印記: rune, 圖騰: totem, 陷阱: jaws,
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
