import { useEffect } from 'react';
import type { CardView } from '../../engine/view';
import { placePopover } from '../popoverPlacement';
import { expEffectActive } from '../expEffect';
import { CardFace } from './CardFace';

export const ZONE_POP_W = 720;
export const ZONE_POP_H = 360;

/** 就地展開的牌區：貼著該區出現、不推擠其他區域；點面板外面關閉（Esc 由對戰頁處理） */
export function ZoneViewer({ title, cards, exp, anchor, onClose }: { title: string; cards: CardView[]; /** 是經驗區：顯示經驗效果提示 */ exp: boolean; anchor: DOMRect; onClose: () => void }) {
  // 面板是貼著錨點定位的快照：視窗改變大小或頁面捲動後錨點會移位，直接關閉（只看整頁的捲動，紀錄欄自己的捲動不算）
  useEffect(() => {
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onClose);
    return () => {
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onClose);
    };
  }, [onClose]);
  const w = Math.min(ZONE_POP_W, window.innerWidth - 16);
  const pl = placePopover(anchor, { w, h: ZONE_POP_H }, { w: window.innerWidth, h: window.innerHeight });
  return (
    <>
      <div className="zoneback" onClick={onClose} />
      <div
        className="zonepop"
        style={{ left: pl.left, width: w, maxHeight: Math.min(ZONE_POP_H, pl.maxH), ...(pl.side === 'below' ? { top: pl.edge } : { bottom: pl.edge }) }}
      >
        <div className="zonepophead">
          <b>{title}（{cards.length}）</b>
          <button onClick={onClose}>關閉</button>
        </div>
        <div className="cardrow">
          {cards.map((c) => <CardFace key={c.uid} id={c.id} size="sm" covered={c.covered} expEffect={exp && expEffectActive(c)} />)}
          {cards.length === 0 && <span className="muted">（空）</span>}
        </div>
      </div>
    </>
  );
}
