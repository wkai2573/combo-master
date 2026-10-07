import { useLayoutEffect, useRef, useState } from 'react';
import { getCard } from '../../data/cards';
import { ACTIVATE_HOLD_MS, FLY, SPOTLIGHT_HOLD_MS } from '../../engine/flights';
import type { FrameFx } from '../../engine/types';
import { CardFace } from './CardFace';
import { KeywordText } from './KeywordText';

const EASE = 'cubic-bezier(.25, .8, .3, 1)';

/** 從牌背翻成正面 */
function flipIn(el: HTMLElement, dur: number, anims: Animation[]) {
  const flip = el.querySelector<HTMLElement>('.flip');
  if (flip) anims.push(flip.animate([{ transform: 'rotateY(180deg)' }, { transform: 'rotateY(0deg)' }], { duration: dur, easing: 'ease-in-out' }));
}

/**
 * 中央放大：桌面壓暗，一張牌放大在畫面中央並顯示說明。
 * - 追擊翻牌：牌從牌組飛到中央、翻成正面；結果影格停一下，之後由飛行圖層接手飛向去處
 * - 效果發動：牌從它所在的位置放大到中央，顯示效果說明，停一下再縮回原位
 */
export function Spotlight({ fx, caption, n, scale }: { fx?: FrameFx; caption?: string; n: number; scale: number }) {
  const on = fx?.type === 'flip' || fx?.type === 'flipResult' || fx?.type === 'activate';
  const [released, setReleased] = useState(false);
  const inner = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  useLayoutEffect(() => {
    if (!fx || (fx.type !== 'flip' && fx.type !== 'flipResult' && fx.type !== 'activate')) return;
    const el = inner.current;
    const slot = document.querySelector<HTMLElement>('[data-spotlight]');
    const anims: Animation[] = [];
    const timers: number[] = [];
    const sc = scaleRef.current;
    setReleased(false);

    // 從某個矩形（牌堆或牌原本的位置）到中央的位移
    const from = (r: DOMRect, b: DOMRect) => ({
      transform: `translate(${r.left + r.width / 2 - (b.left + b.width / 2)}px, ${r.top + r.height / 2 - (b.top + b.height / 2)}px) scale(${r.width / b.width})`,
    });

    if (fx.type === 'flip') {
      // 從該玩家的牌組堆飛到中央，並從牌背翻成正面
      const pile = document.querySelector<HTMLElement>(`[data-pile="${fx.player}-deck"]`);
      if (el && slot && pile) {
        const dur = FLY.ms * 1.2 * sc;
        anims.push(el.animate([from(pile.getBoundingClientRect(), slot.getBoundingClientRect()), { transform: 'none' }], { duration: dur, easing: EASE }));
        flipIn(el, dur, anims);
      }
    } else if (fx.type === 'flipResult') {
      // 牌留在中央顯示結果，時間到就放手（接著由飛行圖層飛向去處）
      timers.push(window.setTimeout(() => setReleased(true), SPOTLIGHT_HOLD_MS * sc));
    } else {
      // 效果發動：從牌所在的位置放大到中央，停一下，再縮回去
      const origin = document.querySelector<HTMLElement>(`[data-uid="${fx.uid}"]`);
      const dur = FLY.ms * sc;
      const back = Math.round(FLY.ms * 0.6 * sc);
      if (el && slot) {
        const r = origin?.getBoundingClientRect();
        if (origin && r && r.width > 0) {
          anims.push(el.animate([from(r, slot.getBoundingClientRect()), { transform: 'none' }], { duration: dur, easing: EASE }));
          // 原本是牌背（對手覆蓋的經驗卡等）就翻成正面
          if (origin.classList.contains('back')) {
            flipIn(el, dur, anims);
          }
          timers.push(window.setTimeout(() => {
            anims.push(el.animate([{ transform: 'none', opacity: 1 }, { ...from(r, slot.getBoundingClientRect()), opacity: 0.2 }], { duration: back, easing: 'ease-in', fill: 'forwards' }));
          }, ACTIVATE_HOLD_MS * sc));
        } else {
          anims.push(el.animate([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: dur, easing: EASE }));
        }
      }
      timers.push(window.setTimeout(() => setReleased(true), ACTIVATE_HOLD_MS * sc + back));
    }
    return () => {
      for (const a of anims) a.cancel();
      for (const t of timers) window.clearTimeout(t);
    };
  }, [fx, n]);

  if (!on || !fx) return null;
  const label = fx.type === 'flip' ? '追擊判定' : fx.type === 'activate' ? '效果發動' : fx.ok ? '追擊成功！' : '追擊失敗';
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
        {fx.type === 'activate' && (
          <div className="spottext">
            <div className="spotcaption">{caption}</div>
            <KeywordText text={getCard(fx.cardId).text} />
          </div>
        )}
      </div>
    </div>
  );
}
