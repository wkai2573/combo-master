import { useLayoutEffect, useRef, useState } from 'react';
import { coverChanges, diffFlights, FLY, flightTiming, type Flight } from '../../engine/flights';
import type { GameView } from '../../engine/view';
import { CardFace } from './CardFace';

/** 牌堆（沒有逐張畫出卡片）的區域：飛行以牌堆元件當起訖點 */
const PILE_ZONES = new Set(['deck', 'discard', 'rage']);

interface Placed {
  key: string;
  flight: Flight;
  /** 起點相對終點的位移與縮放 */
  dx: number;
  dy: number;
  sx: number;
  sy: number;
  /** 終點的位置與大小（飛行卡就放在終點上，再從起點動畫過來） */
  to: { left: number; top: number; width: number; height: number };
  /** 飛行複製品的卡片尺寸，與終點的真實卡片一致 */
  size: 'sm' | 'md';
  /** 開始飛行前的延遲與飛行時間（毫秒，標準速度） */
  delay: number;
  ms: number;
  /** 終點是棄牌堆時，堆頂的牌先藏起來，等整批飛完才顯示新的頂牌 */
  pileTop: HTMLElement | null;
  /** 終點上的真實卡片，飛行期間先藏起來 */
  hide: HTMLElement | null;
}

const center = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

function captureRects(): Map<number, DOMRect> {
  const out = new Map<number, DOMRect>();
  document.querySelectorAll<HTMLElement>('[data-uid]').forEach((el) => {
    out.set(Number(el.dataset.uid), el.getBoundingClientRect());
  });
  return out;
}

const pileRect = (owner: number, zone: string): DOMRect | undefined =>
  document.querySelector<HTMLElement>(`[data-pile="${owner}-${zone}"]`)?.getBoundingClientRect();

/**
 * 蓋滿畫面的圖層：播放動畫時，比對上一個顯示的桌面與目前影格的桌面，
 * 讓移動過的卡片從原區域飛到新區域。scale 為播放速度倍率（0 以外）。
 */
export function FlightLayer({ view, playing, n, scale }: {
  view: GameView | null; playing: boolean; n: number; scale: number;
}) {
  const [flights, setFlights] = useState<Placed[]>([]);
  const prev = useRef<{ view: GameView; rects: Map<number, DOMRect> } | null>(null);
  const active = useRef<Animation[]>([]);
  const hidden = useRef<HTMLElement[]>([]);
  // 每個棄牌堆頂還有幾張牌沒落地
  const holds = useRef(new Map<HTMLElement, number>());
  // 這個影格裡原地翻成覆蓋（或翻開）的牌
  const turnRef = useRef<HTMLElement[]>([]);
  // 播放速度中途改變時，不重播進行中的飛行
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  const stopAll = () => {
    for (const a of active.current) a.cancel();
    active.current = [];
    for (const el of hidden.current) el.style.visibility = '';
    hidden.current = [];
  };

  // 影格換了（或播放結束）時：先收掉上一輪，再依新舊桌面算出這一輪的飛行
  useLayoutEffect(() => {
    stopAll();
    const before = prev.current;
    let placed: Placed[] = [];
    const changed = playing && view && before && before.view !== view;
    if (changed) {
      const flies = diffFlights(before.view, view);
      const timing = flightTiming(Math.max(0, ...flies.map((f) => f.order)));
      for (const f of flies) {
        const destEl = PILE_ZONES.has(f.to) ? null : document.querySelector<HTMLElement>(`[data-uid="${f.uid}"]`);
        const dest = destEl ? destEl.getBoundingClientRect() : PILE_ZONES.has(f.to) ? pileRect(f.owner, f.to) : undefined;
        const src = PILE_ZONES.has(f.from) ? pileRect(f.owner, f.from) : before.rects.get(f.uid);
        if (!dest || !src) continue;
        const a = center(src);
        const b = center(dest);
        placed.push({
          key: `${n}-${f.uid}`, flight: f,
          dx: a.x - b.x, dy: a.y - b.y, sx: src.width / dest.width, sy: src.height / dest.height,
          to: { left: dest.left, top: dest.top, width: dest.width, height: dest.height },
          size: destEl?.classList.contains('md') ? 'md' : 'sm',
          delay: f.order * timing.stagger,
          ms: timing.ms,
          pileTop: f.to === 'discard' ? document.querySelector<HTMLElement>(`[data-pile="${f.owner}-discard"] .card`) : null,
          hide: destEl,
        });
      }
    }
    // 留在原地、只是翻成覆蓋（或翻開）的牌：原地翻面一下
    const turned: HTMLElement[] = [];
    if (changed) {
      for (const uid of coverChanges(before.view, view)) {
        const el = document.querySelector<HTMLElement>(`[data-uid="${uid}"]`);
        if (el) turned.push(el);
      }
    }
    turnRef.current = turned;
    holds.current = new Map();
    for (const pl of placed) {
      if (pl.pileTop) {
        pl.pileTop.style.visibility = 'hidden';
        holds.current.set(pl.pileTop, (holds.current.get(pl.pileTop) ?? 0) + 1);
        if (!hidden.current.includes(pl.pileTop)) hidden.current.push(pl.pileTop);
      }
      if (pl.hide) {
        pl.hide.style.visibility = 'hidden';
        // 這張牌由飛行負責進場，不再另外淡入
        pl.hide.style.animation = 'none';
        hidden.current.push(pl.hide);
      }
    }
    setFlights(placed);
    if (view) prev.current = { view, rects: captureRects() };
    return stopAll;
    // 只在影格換了或播放狀態變了時重算（影格換了 n 一定跟著變）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, playing]);

  // 圖層元素掛上後開始播放各張卡的飛行動畫
  const refs = useRef(new Map<string, HTMLDivElement>());
  useLayoutEffect(() => {
    const scale = scaleRef.current;
    const turnMs = FLY.ms * scale;
    const ease = getComputedStyle(document.documentElement).getPropertyValue('--ease-fly').trim() || 'ease-out';
    // 翻成覆蓋的牌原地翻面（turnRef 由上一個 effect 在 setFlights 之前備好）
    for (const el of turnRef.current) {
      active.current.push(el.animate([{ transform: 'rotateY(90deg) scale(.9)' }, { transform: 'none' }], { duration: turnMs, easing: ease }));
    }
    for (const pl of flights) {
      const el = refs.current.get(pl.key);
      if (!el) continue;
      const flip = pl.flight.faceUpFrom !== pl.flight.faceUpTo;
      const fly = el.animate(
        [
          { transform: `translate(${pl.dx}px, ${pl.dy}px) scale(${pl.sx}, ${pl.sy})`, opacity: 1 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: pl.ms * scale, delay: pl.delay * scale, easing: ease, fill: 'both' },
      );
      active.current.push(fly);
      const inner = el.querySelector<HTMLElement>('.flip');
      if (flip && inner) {
        active.current.push(
          inner.animate(
            [{ transform: `rotateY(${pl.flight.faceUpFrom ? 0 : 180}deg)` }, { transform: `rotateY(${pl.flight.faceUpTo ? 0 : 180}deg)` }],
            { duration: pl.ms * scale, delay: pl.delay * scale, easing: 'ease-in-out', fill: 'both' },
          ),
        );
      }
      fly.onfinish = () => {
        // 落地：把真實卡片顯示出來，飛行的複製品消失
        if (pl.hide) pl.hide.style.visibility = '';
        if (pl.pileTop) {
          const left = (holds.current.get(pl.pileTop) ?? 1) - 1;
          holds.current.set(pl.pileTop, left);
          if (left <= 0) pl.pileTop.style.visibility = '';
        }
        el.style.visibility = 'hidden';
      };
    }
  }, [flights]);

  if (flights.length === 0) return null;
  return (
    <div className="flightlayer" aria-hidden>
      {flights.map((pl) => {
        const f = pl.flight;
        const size = pl.size;
        // 起點是背面時，飛行的複製品先顯示背面；翻面動畫在 .flip 上做
        const startFront = f.faceUpFrom;
        return (
          <div
            key={pl.key}
            className="flycard"
            ref={(el) => {
              if (el) refs.current.set(pl.key, el);
              else refs.current.delete(pl.key);
            }}
            style={{ left: pl.to.left, top: pl.to.top, width: pl.to.width, height: pl.to.height, opacity: 0 }}
          >
            <div className="flip" style={{ transform: `rotateY(${startFront ? 0 : 180}deg)` }}>
              <div className="side front">{f.id ? <CardFace id={f.id} size={size} /> : <CardFace id={null} size={size} />}</div>
              <div className="side back"><CardFace id={null} size={size} /></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
