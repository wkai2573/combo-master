import { createContext, useContext } from 'react';
import { getCard } from '../../data/cards';
import type { CardData, ClassName } from '../../data/types';
import { CardArt } from './CardArt';

export const CLASS_COLOR: Record<ClassName, string> = {
  共用: '#8a93a8',
  劍士: '#e0583f',
  盜賊: '#a56ae0',
  商人: '#e0b03f',
  法師: '#3f8fe0',
  弓箭手: '#4fc98b',
};

/** 滑鼠移到卡片上時，把卡片 id 交給側欄的說明區 */
export const InspectContext = createContext<(id: string | null) => void>(() => {});

export interface CardFaceProps {
  /** null 表示看不到內容（顯示牌背） */
  id: string | null;
  covered?: boolean;
  size?: 'sm' | 'md';
  selected?: boolean;
  glow?: boolean;
  dim?: boolean;
  counters?: number;
  badge?: string | number;
  onClick?: () => void;
}

export function kindLabel(c: CardData): string {
  if (c.kind === 'equip') return `裝備・${c.slot}`;
  if (c.kind === 'buff') return '增益';
  return c.traits.join('・') || '招式';
}

export function CardFace({ id, covered, size = 'md', selected, glow, dim, counters, badge, onClick }: CardFaceProps) {
  const inspect = useContext(InspectContext);
  const cls = ['card', size];
  if (selected) cls.push('selected');
  if (glow) cls.push('glow');
  if (dim) cls.push('dim');
  if (onClick) cls.push('clickable');

  if (id === null) {
    return <div className={[...cls, 'back'].join(' ')} onClick={onClick}>{covered ? '覆蓋' : '?'}</div>;
  }
  const c = getCard(id);
  if (covered) cls.push('covered');
  const isMove = c.kind === 'move';
  return (
    <div
      className={cls.join(' ')}
      style={{ ['--cc' as string]: CLASS_COLOR[c.cls] }}
      onClick={onClick}
      onMouseEnter={() => inspect(id)}
      title={`${c.name}\n${c.text}`}
    >
      <div className="nm">{c.name}</div>
      <div className="tag">{c.cls}・{kindLabel(c)}</div>
      <CardArt id={id} />
      <div className="stats">
        {isMove ? (
          <>
            <span className="stat atk">{c.atk}</span>
            <span className="stat def">{c.def}</span>
            <span className="stat combo">{c.combo}</span>
          </>
        ) : (
          <span className="stat gray">
            {c.kind === 'buff' ? `持續${c.duration ?? '-'}` : '裝備'}・經驗{c.expReq}
          </span>
        )}
      </div>
      <div className="tx">{c.text}</div>
      {counters ? <span className="ctr">⏳{counters}</span> : null}
      {badge !== undefined ? <span className="badge">{badge}</span> : null}
    </div>
  );
}

/** 側欄的卡片完整說明 */
export function InspectPanel({ id }: { id: string | null }) {
  if (!id) return <div className="inspect muted">把滑鼠移到卡片上可以看到完整說明。</div>;
  const c = getCard(id);
  return (
    <div className="inspect">
      <div className="nm">{c.name}</div>
      <div className="muted">{c.cls}・{kindLabel(c)}</div>
      <div className="st">
        {c.kind === 'move'
          ? `攻擊 ${c.atk}　防禦 ${c.def}　連擊值 ${c.combo}`
          : `經驗需求 ${c.expReq}${c.kind === 'buff' ? `　持續時間 ${c.duration}` : ''}`}
      </div>
      <div className="tx">{c.text || '（無效果）'}</div>
    </div>
  );
}
