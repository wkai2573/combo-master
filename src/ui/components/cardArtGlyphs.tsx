import type { ReactNode } from 'react';

/**
 * 效果卡與 Ex 卡的專屬卡圖：每張卡一個，全部畫在 100×60 的座標內，鍵是卡的內部 id。
 * 主色是 currentColor（卡種色），白色當輪廓與高光；毒、血、火、冰、電這類本身有顏色語意的，另加一個點綴色。
 * 卡在小卡上只有 34px 高，所以用粗輪廓與大色塊，不畫細節。
 * 白板卡（花色加數字）不在這裡，見 CardArt.tsx。
 */

const W = '#e8ecf5';
const K = '#0b0e16';
const STEEL = '#cfd6ea';
const FIRE = '#ff8a3d';
const FIRE2 = '#ffd166';
const ICE = '#8fd8ff';
const ELEC = '#ffe066';
const POISON = '#6fdc5a';
const BLOOD = '#e5484d';
const GOLD = '#f0c040';
const WOOD = '#a9743f';

const OUT = { stroke: W, strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;

/** 匕首：刀尖朝上，原點在刀柄底部中間的上方，方便旋轉擺放 */
const dagger = (blade: string = W) => (
  <g strokeLinejoin="round" strokeLinecap="round">
    <path d="M50 3 L56 26 H44 Z" fill={blade} stroke={K} strokeWidth="1.5" />
    <rect x="40" y="26" width="20" height="5" rx="2" fill="currentColor" stroke={W} strokeWidth="2" />
    <rect x="46.5" y="31" width="7" height="14" rx="2" fill={WOOD} stroke={K} strokeWidth="1.5" />
    <circle cx="50" cy="47" r="3.5" fill="currentColor" stroke={W} strokeWidth="2" />
  </g>
);

const arrowHead = (x: number, y: number) => <path d={`M${x} ${y} l-9 -6 v12 z`} fill={W} stroke={W} strokeWidth="2" strokeLinejoin="round" />;

const heart = (cx: number, cy: number, s: number, fill: string) => (
  <path
    transform={`translate(${cx} ${cy}) scale(${s})`}
    d="M0 9 C-14 -1 -9 -12 0 -5 C9 -12 14 -1 0 9 Z"
    fill={fill} stroke={W} strokeWidth={3 / s} strokeLinejoin="round"
  />
);

const coin = (cx: number, cy: number, r = 7) => (
  <g>
    <circle cx={cx} cy={cy} r={r} fill={GOLD} stroke={W} strokeWidth="2.5" />
    <circle cx={cx} cy={cy} r={r * 0.5} fill="none" stroke="#a37a10" strokeWidth="2" />
  </g>
);

const bolt = (x: number, y: number, s: number) => (
  <path transform={`translate(${x} ${y}) scale(${s})`} d="M6 -10 L-5 2 H1 L-3 12 L8 -1 H2 Z" fill={ELEC} stroke={W} strokeWidth={1.8 / s} strokeLinejoin="round" />
);

const snowflake = (x: number, y: number, s: number) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} stroke={ICE} strokeWidth={2.4 / s} strokeLinecap="round" fill="none">
    <path d="M0 -9 V9 M-8 -4.5 L8 4.5 M-8 4.5 L8 -4.5" />
    <path d="M-3 -9 L0 -6 L3 -9 M-3 9 L0 6 L3 9" />
  </g>
);

const flame = (x: number, y: number, s: number) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} strokeLinejoin="round">
    <path d="M0 -11 C4 -5 9 -2 8 4 C7 10 -7 10 -8 4 C-9 -1 -3 -4 0 -11 Z" fill={FIRE} stroke={W} strokeWidth={1.8 / s} />
    <path d="M0 -1 C3 2 4 4 3 6 C2 8 -2 8 -3 6 C-4 4 -1 2 0 -1 Z" fill={FIRE2} />
  </g>
);

const GLYPHS: Record<string, ReactNode> = {
  // ───────── 劍士 ─────────
  戒備打擊: (
    <>
      <path d="M50 2 L58 9 V34 H42 V9 Z" fill={W} stroke={K} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M50 6 V30" stroke={STEEL} strokeWidth="2" />
      <rect x="36" y="32" width="28" height="5" rx="2" fill="currentColor" stroke={W} strokeWidth="2" />
      <path d="M50 26 L74 33 V43 C74 52 62 56 50 58 C38 56 26 52 26 43 V33 Z" fill="currentColor" {...OUT} />
      <path d="M50 33 V54 M34 42 H66" stroke={W} strokeWidth="2.5" opacity=".55" />
    </>
  ),
  復仇之嚎: (
    <>
      <path
        d="M24 58 L31 38 L28 24 L36 8 L47 23 L55 21 L74 7 L79 12 L65 28 L81 29 L84 36 L66 38 L60 58 Z"
        fill="currentColor" {...OUT}
      />
      <path d="M50 29 L58 32" stroke={W} strokeWidth="3" strokeLinecap="round" />
      <path d="M86 14 Q94 22 88 31 M90 8 Q100 20 92 34" fill="none" stroke={W} strokeWidth="2.5" strokeLinecap="round" opacity=".85" />
    </>
  ),
  盾擊: (
    <>
      <polygon
        points="50,1 57,17 74,9 67,25 88,28 69,37 80,52 62,46 56,59 46,45 30,56 33,40 12,34 31,26 22,10 40,18"
        fill={FIRE2} stroke={FIRE} strokeWidth="2.5" strokeLinejoin="round"
      />
      <g transform="rotate(-14 50 32)">
        <path d="M50 11 L70 18 V32 C70 43 60 49 50 53 C40 49 30 43 30 32 V18 Z" fill="currentColor" {...OUT} />
        <path d="M50 18 V46" stroke={W} strokeWidth="3" opacity=".6" />
      </g>
    </>
  ),
  凡骨的意志: (
    <>
      <path d="M44 12 L74 18 L44 28 Z" fill="currentColor" {...OUT} />
      <path d="M40 14 V52" stroke={W} strokeWidth="8" strokeLinecap="round" />
      <circle cx="35" cy="13" r="5" fill={W} />
      <circle cx="45" cy="13" r="5" fill={W} />
      <circle cx="35" cy="53" r="5" fill={W} />
      <circle cx="45" cy="53" r="5" fill={W} />
      <path d="M16 57 H64" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  熔岩之擊: (
    <>
      <path d="M16 52 L74 8" stroke={W} strokeWidth="10" strokeLinecap="round" />
      <path d="M20 49 L70 11" stroke={FIRE} strokeWidth="4.5" strokeLinecap="round" />
      <path d="M22 40 L36 54" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      <path d="M62 30 C60 34 58 36 58 39 A4 4 0 0 0 66 39 C66 36 64 34 62 30 Z" fill={FIRE} stroke={W} strokeWidth="1.5" />
      <path d="M46 42 C44 46 42 48 42 51 A4 4 0 0 0 50 51 C50 48 48 46 46 42 Z" fill={FIRE2} stroke={W} strokeWidth="1.5" />
      <path d="M62 56 Q74 48 88 56" fill="none" stroke={FIRE} strokeWidth="4" strokeLinecap="round" />
    </>
  ),
  嘲諷: (
    <>
      <path d="M12 8 H88 V40 H56 L38 54 L40 40 H12 Z" fill="currentColor" {...OUT} />
      <path d="M36 14 V30" stroke={W} strokeWidth="6" strokeLinecap="round" />
      <circle cx="36" cy="36" r="3.2" fill={W} />
      <path d="M58 14 V30" stroke={W} strokeWidth="6" strokeLinecap="round" />
      <circle cx="58" cy="36" r="3.2" fill={W} />
    </>
  ),
  家族相片: (
    <>
      <rect x="20" y="5" width="60" height="50" rx="3" fill={K} stroke={WOOD} strokeWidth="6" />
      <rect x="24" y="9" width="52" height="42" fill="currentColor" opacity=".55" />
      <circle cx="38" cy="25" r="6" fill={W} />
      <path d="M27 46 Q38 28 49 46 Z" fill={W} />
      <circle cx="62" cy="25" r="6" fill={W} />
      <path d="M51 46 Q62 28 73 46 Z" fill={W} />
      <circle cx="50" cy="31" r="4.5" fill={STEEL} />
      <path d="M42 46 Q50 34 58 46 Z" fill={STEEL} />
    </>
  ),

  // ───────── 盜賊 ─────────
  伏擊: (
    <>
      <path d="M8 24 Q24 6 40 24 Q24 34 8 24 Z" fill={W} stroke={K} strokeWidth="1.5" />
      <path d="M60 24 Q76 6 92 24 Q76 34 60 24 Z" fill={W} stroke={K} strokeWidth="1.5" />
      <ellipse cx="24" cy="23" rx="4" ry="6" fill="currentColor" />
      <ellipse cx="76" cy="23" rx="4" ry="6" fill="currentColor" />
      <g transform="translate(25 22) scale(.6)">
        <g transform="rotate(180 50 28)">{dagger()}</g>
      </g>
    </>
  ),
  二刀連擊: (
    <>
      <g transform="translate(-9 -6) scale(1.18) rotate(-38 50 30)">{dagger()}</g>
      <g transform="translate(-9 -6) scale(1.18) rotate(38 50 30)">{dagger(STEEL)}</g>
    </>
  ),
  順手牽羊: (
    <>
      <path d="M30 18 Q22 28 22 40 Q22 56 44 56 Q66 56 66 40 Q66 28 58 18 Z" fill="currentColor" {...OUT} />
      <path d="M28 18 H60 L56 11 H32 Z" fill="currentColor" stroke={W} strokeWidth="3" strokeLinejoin="round" />
      <path d="M32 18 Q44 25 56 18" fill="none" stroke={W} strokeWidth="3" strokeLinecap="round" />
      {coin(44, 42, 8)}
      <path d="M94 20 H82 Q76 20 76 26 V34 Q76 40 82 40 H94" fill={STEEL} stroke={K} strokeWidth="2" strokeLinejoin="round" />
      <path d="M76 24 L66 25 M76 30 L64 30 M76 36 L66 35" stroke={STEEL} strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="62" cy="14" r="3" fill={GOLD} stroke={W} strokeWidth="1.5" />
    </>
  ),
  卸除鎧甲: (
    <>
      <g transform="translate(-4 0) rotate(-6 50 30)">
        <path d="M50 8 L32 6 L20 14 L22 30 L30 34 L34 54 L46 56 L48 40 L44 30 L52 22 Z" fill="currentColor" {...OUT} />
      </g>
      <g transform="translate(4 0) rotate(6 50 30)">
        <path d="M52 22 L56 34 L52 42 L54 56 L66 54 L70 34 L78 30 L80 14 L68 6 L50 8 Z" fill="currentColor" {...OUT} />
      </g>
      <path d="M50 4 L45 20 L54 30 L47 44 L52 58" fill="none" stroke={K} strokeWidth="2.5" />
    </>
  ),
  塗毒: (
    <>
      <g transform="translate(8 -2) translate(50 26) scale(1.15) rotate(225) translate(-50 -26)">
        <path d="M50 3 L56 26 H44 Z" fill={W} stroke={K} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M50 3 L53.5 15 H46.5 Z" fill={POISON} />
        <rect x="40" y="26" width="20" height="5" rx="2" fill="currentColor" stroke={W} strokeWidth="2" />
        <rect x="46.5" y="31" width="7" height="14" rx="2" fill={WOOD} stroke={K} strokeWidth="1.5" />
        <circle cx="50" cy="47" r="3.5" fill="currentColor" stroke={W} strokeWidth="2" />
      </g>
      <path d="M22 38 C19 44 16 47 16 51 A6 6 0 0 0 28 51 C28 47 25 44 22 38 Z" fill={POISON} stroke={W} strokeWidth="2" />
      <path d="M40 46 C38 50 36 52 36 55 A4.5 4.5 0 0 0 45 55 C45 52 43 50 40 46 Z" fill={POISON} stroke={W} strokeWidth="1.8" />
      <circle cx="80" cy="46" r="4" fill="none" stroke={POISON} strokeWidth="2.5" />
      <circle cx="88" cy="36" r="2.5" fill="none" stroke={POISON} strokeWidth="2" />
    </>
  ),
  幸運兔腳: (
    <>
      <path d="M30 6 V16" stroke={STEEL} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="30" cy="8" r="4" fill="none" stroke={STEEL} strokeWidth="2.5" />
      <g transform="translate(2 4) rotate(-12 32 36)">
        <path d="M24 18 Q24 14 32 14 Q40 14 40 18 L42 34 Q44 50 36 56 Q32 58 28 56 Q20 50 22 34 Z" fill="currentColor" {...OUT} />
        <circle cx="26" cy="12" r="3.6" fill={W} />
        <circle cx="32" cy="10" r="3.6" fill={W} />
        <circle cx="38" cy="12" r="3.6" fill={W} />
      </g>
      <g fill={POISON} stroke={W} strokeWidth="1.8">
        <circle cx="68" cy="30" r="7.5" />
        <circle cx="82" cy="30" r="7.5" />
        <circle cx="75" cy="22" r="7.5" />
        <circle cx="75" cy="38" r="7.5" />
      </g>
      <path d="M75 30 L80 56" stroke={POISON} strokeWidth="3" strokeLinecap="round" />
    </>
  ),

  // ───────── 商人 ─────────
  低價買進: (
    <>
      <path d="M12 30 L28 12 H58 V48 H28 Z" fill="currentColor" {...OUT} />
      <circle cx="26" cy="30" r="4" fill={K} stroke={W} strokeWidth="2" />
      <path d="M40 24 H52 M40 32 H52" stroke={W} strokeWidth="3" strokeLinecap="round" opacity=".7" />
      <path d="M78 8 V42" stroke={POISON} strokeWidth="9" strokeLinecap="round" />
      <path d="M64 36 L78 54 L92 36 Z" fill={POISON} stroke={W} strokeWidth="2.5" strokeLinejoin="round" />
    </>
  ),
  高價賣出: (
    <>
      <ellipse cx="40" cy="48" rx="22" ry="7" fill={GOLD} stroke={W} strokeWidth="2.5" />
      <ellipse cx="40" cy="40" rx="22" ry="7" fill={GOLD} stroke={W} strokeWidth="2.5" />
      <ellipse cx="40" cy="32" rx="22" ry="7" fill={GOLD} stroke={W} strokeWidth="2.5" />
      <ellipse cx="40" cy="32" rx="12" ry="3.5" fill="none" stroke="#a37a10" strokeWidth="2" />
      <path d="M78 54 V22" stroke={BLOOD} strokeWidth="9" strokeLinecap="round" />
      <path d="M64 26 L78 6 L92 26 Z" fill={BLOOD} stroke={W} strokeWidth="2.5" strokeLinejoin="round" />
    </>
  ),
  交涉: (
    <>
      <path d="M2 20 L22 16 L30 22 L26 44 L2 44 Z" fill="currentColor" {...OUT} />
      <path d="M98 20 L78 16 L70 22 L74 44 L98 44 Z" fill={STEEL} stroke={K} strokeWidth="2" strokeLinejoin="round" />
      <path d="M26 24 L46 18 L62 20 L74 28 L72 38 L56 46 L38 44 L28 36 Z" fill={W} stroke={K} strokeWidth="2" strokeLinejoin="round" />
      <path d="M38 26 L44 36 M48 24 L54 36 M58 26 L63 34" stroke={K} strokeWidth="2.5" strokeLinecap="round" opacity=".6" />
    </>
  ),
  即時停損: (
    <>
      <path d="M6 10 L22 18 L30 12 L42 30" fill="none" stroke={BLOOD} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M60 40 L70 48 L78 44 L94 54" fill="none" stroke={BLOOD} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity=".5" strokeDasharray="1 7" />
      <path d="M54 24 L58 6" stroke={W} strokeWidth="2.5" strokeDasharray="3 4" opacity=".6" />
      <g transform="translate(44 30) rotate(-20)">
        <path d="M-20 -10 L20 14" stroke={W} strokeWidth="5" strokeLinecap="round" />
        <path d="M-20 14 L20 -10" stroke={STEEL} strokeWidth="5" strokeLinecap="round" />
        <circle cx="-22" cy="-12" r="7" fill="none" stroke="currentColor" strokeWidth="4" />
        <circle cx="-22" cy="16" r="7" fill="none" stroke="currentColor" strokeWidth="4" />
      </g>
    </>
  ),
  高利貸: (
    <>
      <path d="M26 4 H64 L74 14 V56 H26 Z" fill={W} stroke={K} strokeWidth="2" strokeLinejoin="round" />
      <path d="M64 4 V14 H74" fill={STEEL} stroke={K} strokeWidth="2" strokeLinejoin="round" />
      <rect x="32" y="12" width="26" height="9" fill="currentColor" />
      <path d="M32 28 H68 M32 35 H68 M32 42 H56" stroke={K} strokeWidth="3" strokeLinecap="round" opacity=".7" />
      <rect x="32" y="47" width="14" height="5" fill={K} opacity=".7" />
      <circle cx="78" cy="42" r="8" fill="none" stroke={W} strokeWidth="3.5" />
      <path d="M84 48 L92 56" stroke={W} strokeWidth="4.5" strokeLinecap="round" />
    </>
  ),
  投資: (
    <>
      <rect x="10" y="10" width="54" height="46" rx="5" fill="currentColor" {...OUT} />
      <rect x="17" y="17" width="40" height="32" rx="3" fill="none" stroke={W} strokeWidth="2" opacity=".6" />
      <circle cx="37" cy="33" r="9" fill={K} stroke={W} strokeWidth="2.5" />
      <path d="M37 26 V33 L42 36" stroke={W} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <rect x="20" y="54" width="8" height="4" fill={W} />
      <rect x="46" y="54" width="8" height="4" fill={W} />
      <ellipse cx="80" cy="50" rx="11" ry="4.5" fill={GOLD} stroke={W} strokeWidth="2" />
      <ellipse cx="80" cy="44" rx="11" ry="4.5" fill={GOLD} stroke={W} strokeWidth="2" />
      <ellipse cx="80" cy="38" rx="11" ry="4.5" fill={GOLD} stroke={W} strokeWidth="2" />
    </>
  ),
  招財貓: (
    <>
      <path d="M26 24 L22 4 L40 14 Z" fill={W} stroke={K} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M74 24 L78 4 L60 14 Z" fill={W} stroke={K} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M26 56 Q22 40 28 30 Q50 22 72 30 Q78 40 74 56 Z" fill={W} stroke={K} strokeWidth="1.5" />
      <ellipse cx="50" cy="28" rx="26" ry="16" fill={W} stroke={K} strokeWidth="1.5" />
      <circle cx="40" cy="26" r="2.6" fill={K} />
      <circle cx="60" cy="26" r="2.6" fill={K} />
      <path d="M47 32 L50 35 L53 32 Z" fill="currentColor" />
      <path d="M20 30 H32 M20 36 H32 M68 30 H80 M68 36 H80" stroke={K} strokeWidth="1.5" opacity=".6" />
      <rect x="80" y="16" width="10" height="20" rx="5" fill={W} stroke={K} strokeWidth="1.5" transform="rotate(14 85 26)" />
      <circle cx="50" cy="46" r="7" fill={GOLD} stroke={K} strokeWidth="1.5" />
      <path d="M50 42 V50" stroke="#a37a10" strokeWidth="2" />
    </>
  ),

  // ───────── 弓箭手 ─────────
  魅影射擊: (
    <>
      <g opacity=".22" transform="translate(-22 0)">
        <path d="M14 30 H70" stroke={W} strokeWidth="4" strokeLinecap="round" />
        {arrowHead(80, 30)}
      </g>
      <g opacity=".45" transform="translate(-11 0)">
        <path d="M14 30 H70" stroke={W} strokeWidth="4" strokeLinecap="round" />
        {arrowHead(80, 30)}
      </g>
      <path d="M14 30 H74" stroke={W} strokeWidth="4.5" strokeLinecap="round" />
      <path d="M14 30 l-6 -7 M14 30 l-6 7 M22 30 l-6 -7 M22 30 l-6 7" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M92 30 l-14 -9 v18 z" fill="currentColor" stroke={W} strokeWidth="2.5" strokeLinejoin="round" />
    </>
  ),
  地雷陷阱: (
    <>
      <path d="M8 54 H92" stroke={WOOD} strokeWidth="4" strokeLinecap="round" />
      <path d="M38 24 V14 M50 22 V10 M62 24 V14" stroke={STEEL} strokeWidth="4" strokeLinecap="round" />
      <path d="M16 44 Q16 26 50 24 Q84 26 84 44 Z" fill="currentColor" {...OUT} />
      <rect x="10" y="44" width="80" height="9" rx="4" fill={STEEL} stroke={K} strokeWidth="2" />
      <circle cx="50" cy="34" r="6" fill={BLOOD} stroke={W} strokeWidth="2.5" />
      <path d="M22 36 Q24 30 32 28 M78 36 Q76 30 68 28" fill="none" stroke={W} strokeWidth="2.5" strokeLinecap="round" opacity=".6" />
      <path d="M14 14 L22 20 M86 14 L78 20" stroke={FIRE2} strokeWidth="3.5" strokeLinecap="round" />
    </>
  ),
  狙擊印記: (
    <>
      <path d="M14 20 V12 H22 M86 20 V12 H78 M14 40 V48 H22 M86 40 V48 H78" fill="none" stroke={W} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M50 14 L66 30 L50 46 L34 30 Z" fill={BLOOD} stroke={W} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="50" cy="30" r="4.5" fill={W} />
      <path d="M50 4 V12 M50 48 V56 M24 30 H30 M70 30 H76" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </>
  ),
  二連矢: (
    <>
      <g transform="translate(5 6) scale(.88) rotate(-24 50 30)">
        <path d="M12 22 H78" stroke={W} strokeWidth="4" strokeLinecap="round" />
        <path d="M12 22 l-6 -6 M12 22 l-6 6 M20 22 l-6 -6 M20 22 l-6 6" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M94 22 l-14 -8 v16 z" fill="currentColor" stroke={W} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M6 40 H72" stroke={W} strokeWidth="4" strokeLinecap="round" />
        <path d="M6 40 l-6 -6 M6 40 l-6 6 M14 40 l-6 -6 M14 40 l-6 6" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M88 40 l-14 -8 v16 z" fill="currentColor" stroke={W} strokeWidth="2.5" strokeLinejoin="round" />
      </g>
    </>
  ),
  狙擊蓄力: (
    <>
      <path d="M30 4 Q4 30 30 56" fill="none" stroke={WOOD} strokeWidth="6" strokeLinecap="round" />
      <path d="M30 4 L52 30 L30 56" fill="none" stroke={W} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M52 30 H88" stroke={W} strokeWidth="4.5" strokeLinecap="round" />
      <path d="M96 30 l-14 -8 v16 z" fill="currentColor" stroke={W} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M62 12 L66 20 M72 8 L74 18 M62 48 L66 40 M72 52 L74 42" stroke={FIRE2} strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  生命偷取: (
    <>
      {heart(62, 30, 2.1, BLOOD)}
      <path d="M8 50 L64 12" stroke={W} strokeWidth="4.5" strokeLinecap="round" />
      <path d="M8 50 l2 -8 M8 50 l8 -2 M16 44 l1 -8 M16 44 l8 -1" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M90 6 l-14 5 l6 9 z" fill="currentColor" stroke={W} strokeWidth="2.5" strokeLinejoin="round" />
      {heart(26, 14, 0.8, BLOOD)}
      {heart(88, 50, 0.7, BLOOD)}
    </>
  ),
  瞄準器: (
    <>
      <path d="M4 22 L20 18 V42 L4 38 Z" fill="currentColor" {...OUT} />
      <rect x="20" y="22" width="52" height="16" fill={STEEL} stroke={K} strokeWidth="2" />
      <rect x="40" y="16" width="14" height="28" rx="2" fill="currentColor" {...OUT} />
      <path d="M72 14 L94 8 V52 L72 46 Z" fill="currentColor" {...OUT} />
      <ellipse cx="90" cy="30" rx="4" ry="16" fill={ICE} opacity=".85" />
      <path d="M87 20 L90 24" stroke={W} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M24 22 V38 M32 22 V38" stroke={K} strokeWidth="2" opacity=".5" />
    </>
  ),

  // ───────── 法師 ─────────
  力量爆破: (
    <>
      <path d="M50 2 V12 M50 48 V58 M10 30 H20 M80 30 H90 M22 8 L28 15 M78 8 L72 15 M22 52 L28 45 M78 52 L72 45" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <circle cx="50" cy="30" r="25" fill="none" stroke={W} strokeWidth="3" strokeDasharray="6 5" opacity=".7" />
      <circle cx="50" cy="30" r="15" fill="currentColor" {...OUT} />
      <circle cx="50" cy="30" r="6" fill={W} />
    </>
  ),
  電弧: (
    <>
      <rect x="6" y="24" width="12" height="30" rx="3" fill="currentColor" {...OUT} />
      <rect x="82" y="24" width="12" height="30" rx="3" fill="currentColor" {...OUT} />
      <circle cx="12" cy="20" r="5" fill={ELEC} stroke={W} strokeWidth="2" />
      <circle cx="88" cy="20" r="5" fill={ELEC} stroke={W} strokeWidth="2" />
      <path d="M16 19 L28 8 L34 22 L46 6 L54 24 L66 8 L72 22 L84 19" fill="none" stroke={W} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity=".5" />
      <path d="M16 19 L28 8 L34 22 L46 6 L54 24 L66 8 L72 22 L84 19" fill="none" stroke={ELEC} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  冰霜護甲: (
    <>
      <path d="M50 3 L78 12 V32 C78 46 66 54 50 58 C34 54 22 46 22 32 V12 Z" fill={ICE} stroke={W} strokeWidth="3" strokeLinejoin="round" />
      <path d="M50 3 V58 M22 12 L50 30 L78 12 M22 32 L50 30 L78 32" fill="none" stroke="currentColor" strokeWidth="2.5" opacity=".75" />
      <path d="M50 30 L34 50 M50 30 L66 50" fill="none" stroke="currentColor" strokeWidth="2.5" opacity=".75" />
      <path d="M50 18 L56 30 L50 42 L44 30 Z" fill={W} opacity=".85" />
    </>
  ),
  火球: (
    <>
      <path d="M4 40 C14 38 20 30 30 28 C24 22 30 12 40 8 C38 16 44 18 50 18 C60 8 78 14 84 28 C90 42 78 56 62 56 C48 56 40 48 30 48 C20 48 12 46 4 40 Z" fill={FIRE} stroke={W} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="64" cy="34" r="17" fill={FIRE2} />
      <circle cx="64" cy="34" r="9" fill={W} opacity=".9" />
      <path d="M10 22 Q20 20 26 14 M8 52 Q20 52 28 56" fill="none" stroke={FIRE} strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  'Explosion!': (
    <g transform="translate(0 3)">
      <ellipse cx="50" cy="55" rx="40" ry="5" fill={FIRE} stroke={W} strokeWidth="2" />
      <path d="M42 54 L46 32 H54 L58 54 Z" fill={FIRE} stroke={W} strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="30" cy="26" r="13" fill={FIRE} stroke={W} strokeWidth="2.5" />
      <circle cx="70" cy="26" r="13" fill={FIRE} stroke={W} strokeWidth="2.5" />
      <circle cx="50" cy="18" r="16" fill={FIRE2} stroke={W} strokeWidth="2.5" />
      <circle cx="50" cy="20" r="8" fill={W} opacity=".9" />
      <path d="M8 14 L16 20 M92 14 L84 20 M14 4 L20 10 M86 4 L80 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </g>
  ),
  冰與雷之曲: (
    <>
      <path d="M22 54 V8 Q22 4 30 8 L78 52" fill="none" stroke={W} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M22 54 H80" stroke={W} strokeWidth="4" strokeLinecap="round" />
      <path d="M32 54 V16 M42 54 V25 M52 54 V34 M62 54 V43" stroke={ICE} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M42 54 V25 M62 54 V43" stroke={ELEC} strokeWidth="3.5" strokeLinecap="round" />
      <ellipse cx="78" cy="22" rx="6" ry="4.5" fill="currentColor" stroke={W} strokeWidth="2.5" transform="rotate(-18 78 22)" />
      <path d="M83 20 V4 L92 8" fill="none" stroke={W} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {snowflake(66, 10, 0.7)}
      {bolt(90, 40, 0.9)}
    </>
  ),
  星界法典: (
    <>
      <path d="M50 54 Q28 46 6 50 V26 Q28 22 50 30 Q72 22 94 26 V50 Q72 46 50 54 Z" fill={W} stroke={K} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M50 30 V54" stroke="currentColor" strokeWidth="4" />
      <path d="M12 34 Q28 31 44 38 M12 42 Q28 39 44 46 M56 38 Q72 31 88 34 M56 46 Q72 39 88 42" fill="none" stroke={K} strokeWidth="2" opacity=".35" />
      {flame(24, 12, 1)}
      {snowflake(50, 12, 0.9)}
      {bolt(76, 12, 1.1)}
    </>
  ),

  // ───────── 共用 ─────────
  生命藥水: (
    <>
      <rect x="42" y="2" width="16" height="9" rx="2" fill={WOOD} stroke={K} strokeWidth="1.5" />
      <path d="M44 11 H56 V22 C70 26 76 36 76 44 C76 54 66 58 50 58 C34 58 24 54 24 44 C24 36 30 26 44 22 Z" fill={W} fillOpacity=".25" stroke={W} strokeWidth="3" strokeLinejoin="round" />
      <path d="M27 38 H73 C75 41 76 43 76 45 C76 54 66 58 50 58 C34 58 24 54 24 45 C24 43 25 41 27 38 Z" fill={BLOOD} />
      <path d="M34 44 Q36 52 44 54" fill="none" stroke={W} strokeWidth="3" strokeLinecap="round" opacity=".8" />
      <path d="M62 34 H74 M68 28 V40" stroke={W} strokeWidth="3" strokeLinecap="round" opacity="0" />
      <path d="M86 12 V24 M80 18 H92" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </>
  ),
  皮甲: (
    <>
      <path d="M34 6 Q50 18 66 6 L90 16 L82 32 L72 28 V56 H28 V28 L18 32 L10 16 Z" fill="currentColor" {...OUT} />
      <path d="M34 6 Q50 18 66 6" fill="none" stroke={W} strokeWidth="3" />
      <path d="M50 17 V54" stroke={W} strokeWidth="2.5" strokeDasharray="3 4" opacity=".8" />
      <path d="M44 20 L56 24 M44 28 L56 32" stroke={W} strokeWidth="2.5" strokeLinecap="round" opacity=".8" />
      <path d="M30 50 H70" stroke={K} strokeWidth="2.5" opacity=".35" />
    </>
  ),
  木棍: (
    <>
      <path d="M16 56 L24 46 L70 12 Q82 6 88 14 Q92 24 80 32 L34 54 Z" fill={WOOD} stroke={K} strokeWidth="2" strokeLinejoin="round" />
      <path d="M32 44 L74 16" stroke="#d9a468" strokeWidth="3" strokeLinecap="round" opacity=".8" />
      <path d="M60 22 L56 30 M72 16 L68 24" stroke={K} strokeWidth="2.5" strokeLinecap="round" opacity=".5" />
      <ellipse cx="52" cy="40" rx="3.5" ry="2.5" fill={K} opacity=".45" />
      <path d="M10 56 H30" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </>
  ),

  // ───────── Ex 卡 ─────────
  'Ex-中毒': (
    <>
      <path d="M50 4 C28 4 20 18 22 30 C23 36 28 38 30 40 V48 H70 V40 C72 38 77 36 78 30 C80 18 72 4 50 4 Z" fill={W} stroke={K} strokeWidth="2" strokeLinejoin="round" />
      <ellipse cx="38" cy="28" rx="7" ry="8" fill={K} />
      <ellipse cx="62" cy="28" rx="7" ry="8" fill={K} />
      <path d="M50 34 L46 42 H54 Z" fill={K} />
      <path d="M38 48 V54 M46 48 V54 M54 48 V54 M62 48 V54" stroke={K} strokeWidth="2.5" />
      <path d="M20 44 C18 50 16 52 16 55 A5 5 0 0 0 26 55 C26 52 24 50 20 44 Z" fill={POISON} stroke={W} strokeWidth="1.8" />
      <path d="M80 36 C78 42 76 44 76 47 A5 5 0 0 0 86 47 C86 44 84 42 80 36 Z" fill={POISON} stroke={W} strokeWidth="1.8" />
    </>
  ),
  'Ex-流血': (
    <>
      <path d="M50 3 C42 18 30 28 30 40 A20 20 0 0 0 70 40 C70 28 58 18 50 3 Z" fill={BLOOD} stroke={W} strokeWidth="3" strokeLinejoin="round" />
      <path d="M40 40 Q40 48 46 52" fill="none" stroke={W} strokeWidth="3.5" strokeLinecap="round" opacity=".8" />
      <path d="M16 30 C14 36 12 38 12 41 A4.5 4.5 0 0 0 21 41 C21 38 19 36 16 30 Z" fill={BLOOD} stroke={W} strokeWidth="1.8" />
      <path d="M84 18 C82 24 80 26 80 29 A4.5 4.5 0 0 0 89 29 C89 26 87 24 84 18 Z" fill={BLOOD} stroke={W} strokeWidth="1.8" />
    </>
  ),
};

/** 開放的效果卡與 Ex 卡的專屬卡圖，鍵是卡的內部 id */
export const CARD_ART: Record<string, ReactNode> = GLYPHS;

export const hasOwnArt = (id: string): boolean => Object.hasOwn(CARD_ART, id);
