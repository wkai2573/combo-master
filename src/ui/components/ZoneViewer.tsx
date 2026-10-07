import type { CardView } from '../../engine/view';
import { placePopover } from '../popoverPlacement';
import { CardFace } from './CardFace';

export const ZONE_POP_W = 720;
export const ZONE_POP_H = 360;

/** 就地展開的牌區：貼著該區出現、不推擠其他區域；點面板外面關閉（Esc 由對戰頁處理） */
export function ZoneViewer({ title, cards, anchor, onClose }: { title: string; cards: CardView[]; anchor: DOMRect; onClose: () => void }) {
  const w = Math.min(ZONE_POP_W, window.innerWidth - 16);
  const pl = placePopover(anchor, { w, h: ZONE_POP_H }, { w: window.innerWidth, h: window.innerHeight });
  return (
    <>
      <div className="zoneback" onClick={onClose} />
      <div
        className="zonepop"
        style={{ left: pl.left, width: w, maxHeight: ZONE_POP_H, ...(pl.side === 'below' ? { top: pl.edge } : { bottom: pl.edge }) }}
      >
        <div className="zonepophead">
          <b>{title}（{cards.length}）</b>
          <button onClick={onClose}>關閉</button>
        </div>
        <div className="cardrow">
          {cards.map((c) => <CardFace key={c.uid} id={c.id} size="sm" covered={c.covered} />)}
          {cards.length === 0 && <span className="muted">（空）</span>}
        </div>
      </div>
    </>
  );
}
