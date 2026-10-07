import { useLayoutEffect, useRef, useState } from 'react';
import { FLY, SPOTLIGHT_HOLD_MS } from '../../engine/flights';
import type { FrameFx } from '../../engine/types';
import { CardFace } from './CardFace';

/**
 * 中央放大：桌面壓暗，一張牌從牌組飛到畫面中央、翻成正面放大，並顯示說明。
 * 目前用在追擊判定（翻牌影格與結果影格）；結果影格停一下之後，牌由飛行圖層接手飛向它的去處。
 */
export function Spotlight({ fx, n, scale }: { fx?: FrameFx; n: number; scale: number }) {
  const on = fx?.type === 'flip' || fx?.type === 'flipResult';
  const [released, setReleased] = useState(false);
  const inner = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  useLayoutEffect(() => {
    if (!fx || (fx.type !== 'flip' && fx.type !== 'flipResult')) return;
    setReleased(false);
    if (fx.type === 'flip') {
      // 從該玩家的牌組堆飛到中央，並從牌背翻成正面
      const el = inner.current;
      const slot = document.querySelector<HTMLElement>('[data-spotlight]');
      const pile = document.querySelector<HTMLElement>(`[data-pile="${fx.player}-deck"]`);
      if (el && slot && pile) {
        const a = pile.getBoundingClientRect();
        const b = slot.getBoundingClientRect();
        const dur = FLY.ms * 1.2 * scaleRef.current;
        const dx = a.left + a.width / 2 - (b.left + b.width / 2);
        const dy = a.top + a.height / 2 - (b.top + b.height / 2);
        el.animate(
          [{ transform: `translate(${dx}px, ${dy}px) scale(${a.width / b.width})` }, { transform: 'none' }],
          { duration: dur, easing: 'cubic-bezier(.25, .8, .3, 1)' },
        );
        el.querySelector<HTMLElement>('.flip')?.animate(
          [{ transform: 'rotateY(180deg)' }, { transform: 'rotateY(0deg)' }],
          { duration: dur, easing: 'ease-in-out' },
        );
      }
      return;
    }
    // 結果影格：牌留在中央顯示結果，時間到就放手（接著由飛行圖層飛向去處）
    const t = window.setTimeout(() => setReleased(true), SPOTLIGHT_HOLD_MS * scaleRef.current);
    return () => window.clearTimeout(t);
  }, [fx, n]);

  if (!on || !fx) return null;
  const label = fx.type === 'flip' ? '追擊判定' : fx.ok ? '追擊成功！' : '追擊失敗';
  const tone = fx.type === 'flipResult' ? (fx.ok ? ' ok' : ' fail') : '';
  return (
    <div className={`spotlight${released ? ' out' : ''}`} aria-hidden>
      <div className="spotstack">
        <div className={`spotlabel${tone}`}>{label}</div>
        <div className="spotslot" data-spotlight>
          <div className="spotinner" ref={inner}>
            <div className="spotcard">
              <div className="flip">
                <div className="side front"><CardFace id={fx.cardId} size="md" /></div>
                <div className="side back"><CardFace id={null} size="md" /></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
