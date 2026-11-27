import { createContext, useContext, useState } from 'react';
import { getCard } from '../../data/cards';
import type { CardData } from '../../data/types';
import { isExCardId } from '../../data/exCards';
import { hasExpEffect } from '../../engine/effects';
import type { CardView } from '../../engine/view';
import { keywordsIn } from '../../data/keywords';
import { CardArt } from './CardArt';
import { Delta } from './Delta';
import { CardText } from './CardText';
import { cardBorderColor, cardColor } from '../cardColor';
import { gameFaceFor } from '../../cardLayout/gameFaces';
import { GameLayeredFace } from '../../cardLayout/LayeredFace';

/** 滑鼠移到卡片上時，把卡片 id 交給側欄的說明區 */
export const InspectContext = createContext<(id: string | null, expActive?: boolean) => void>(() => {});

/** 右鍵（或點一下不能操作的卡）固定側欄的說明：再點同一張就取消 */
export const PinContext = createContext<(id: string, expActive?: boolean) => void>(() => {});

export interface CardFaceProps {
  /** null 表示看不到內容（顯示牌背） */
  id: string | null;
  /** 卡表可提供本機草稿的預覽資料 */
  card?: CardData;
  size?: 'sm' | 'md';
  /** 有成品卡圖時顯示完整卡面 */
  fullFace?: boolean;
  selected?: boolean;
  glow?: boolean;
  dim?: boolean;
  /** 追擊卡（戰鬥區內以白色內線標示） */
  pursuit?: boolean;
  /** 剛打出的牌：短暫發光 */
  fresh?: boolean;
  /** 經驗區裡經驗效果生效中：加專屬色外框與小 [經] 標記 */
  expEffect?: boolean;
  /** 經驗區裡的裏側卡（擁有者看得到牌面）：加半透明黑色遮罩 */
  covered?: boolean;
  /** 矮卡（經驗區兩列時）：只露出攻／連擊／守與卡圖 */
  short?: boolean;
  counters?: number;
  badge?: string | number;
  /** 卡片實體編號：讓飛行圖層找得到這張卡在畫面上的位置 */
  uid?: number;
  /** 持續時間指示物的變動量（deltaKey 變動時重播） */
  counterDelta?: number;
  deltaKey?: number;
  onClick?: () => void;
  /** 牌堆的頂牌：點擊交給外層的牌堆處理（開列表），不單獨開卡片說明；右鍵仍可固定說明 */
  inert?: boolean;
}

/**
 * 增益區的卡顯示剩餘持續回合：有持續回合的卡顯示「持續回合 − 指示物」，指示物 +1 時剩餘 −1。
 * 沒有持續回合的卡照舊顯示指示物
 */
export function buffCounter(id: string | null, counters: number, delta?: number): { counters: number; counterDelta?: number } {
  const duration = id === null ? undefined : getCard(id).duration;
  if (duration === undefined) return { counters, counterDelta: delta };
  return { counters: Math.max(0, duration - counters), counterDelta: delta ? -delta : undefined };
}

export function kindLabel(c: CardData): string {
  if (c.kind === 'equip') return `裝備・${c.slot}`;
  if (c.kind === 'buff') return '增益';
  return c.traits.join('・') || '招式';
}

/** 經驗區裡的這張卡，其經驗效果目前是否生效中：看得到牌面、表側、且有經驗效果。裏側的牌經驗效果無效，不提示 */
export function expEffectActive(c: Pick<CardView, 'id' | 'covered'>): boolean {
  return c.id !== null && !c.covered && hasExpEffect(c.id);
}

export function CardFace({ id, card, size = 'md', fullFace = true, selected, glow, dim, pursuit, fresh, short, expEffect, covered, counters, badge, uid, counterDelta, deltaKey, onClick, inert }: CardFaceProps) {
  const inspect = useContext(InspectContext);
  const pin = useContext(PinContext);
  const cls = ['card', size];
  if (pursuit) cls.push('pursuit');
  if (fresh) cls.push('fresh');
  if (short) cls.push('short');
  if (expEffect) cls.push('expfx');
  if (covered) cls.push('facedown');
  if (selected) cls.push('selected');
  if (glow) cls.push('glow');
  if (dim) cls.push('dim');
  if (onClick) cls.push('clickable');
  else if (!inert) cls.push('inspectable');

  if (id === null) {
    return <div className={[...cls, 'back'].join(' ')} data-uid={uid} onClick={onClick}>?</div>;
  }
  const c = card ?? getCard(id);
  const layered = fullFace ? gameFaceFor(id) : undefined;
  const showFullFace = Boolean(layered);
  const hasBadge = badge !== undefined;
  if (showFullFace) cls.push('full-face');
  const isMove = c.kind === 'move';
  // 放在增益區、依持續回合計時的 Ex 卡沒有攻守連擊，卡頭改寫持續回合
  const timedEx = isExCardId(c.id) && c.duration !== undefined;
  return (
    <div
      className={cls.join(' ')}
      data-uid={uid}
      style={{ ['--cc' as string]: cardColor(c), ['--cb' as string]: cardBorderColor(c) }}
      onClick={inert ? undefined : (onClick ?? (() => pin(id, expEffect)))}
      onContextMenu={(e) => {
        e.preventDefault();
        pin(id, expEffect);
      }}
      onMouseEnter={() => inspect(id, expEffect)}
    >
      {layered && <div className="layered-slot"><GameLayeredFace face={layered} card={c} /></div>}
      {!showFullFace && (
        <>
          <div className="hd">
            {isMove && !timedEx ? (
              <>
                <span className="a" title="攻擊力">{c.atk}</span>
                <span className="c" title="連擊值">{c.combo}</span>
                <span className="d" title="防禦力">{c.def}</span>
              </>
            ) : timedEx ? (
              <>
                <span className="g">Ex</span>
                <span className="g">持續{c.duration}</span>
              </>
            ) : (
              <>
                <span className="g">{c.kind === 'buff' ? '增益' : c.slot}</span>
                <span className="c" title="經驗需求">需{c.expReq}</span>
                <span className="g">{c.kind === 'buff' ? `持續${c.duration ?? '-'}` : '裝備'}</span>
              </>
            )}
          </div>
          <CardArt id={id} card={card} />
        </>
      )}
      <div className="face-footer">
        {!showFullFace && (
          <div className="ef">
            <span className="tg">{c.cls}・{kindLabel(c)}　</span>
            <CardText text={c.text} />
          </div>
        )}
        {(!showFullFace || hasBadge) && <div className={hasBadge ? 'nm with-badge' : 'nm'}>
          <span className="card-name" title={hasBadge ? c.name : undefined}>{c.name}</span>
          {hasBadge && <span className={badge === 0 ? 'badge empty' : 'badge'}>{badge}</span>}
        </div>}
      </div>
      {covered ? <span className="fdtag">裏側</span> : null}
      {counters ? <span className="ctr" title="剩餘持續回合">⏳{counters}<Delta d={counterDelta} k={deltaKey ?? 0} /></span> : null}
    </div>
  );
}

const MIN_FACE_SCALE = 0.5;
const MAX_FACE_SCALE = 1.75;
const FACE_SCALE_STEP = 0.25;
const FACE_PREVIEW_WIDTH = 184;

/** 側欄的卡片完整說明：放大的卡圖、數值、效果，並列出文字裡關鍵字的說明 */
export function InspectPanel({ id, card, fullFace = true, expActive, pinned, onUnpin }: { id: string | null; card?: CardData; fullFace?: boolean; expActive?: boolean; pinned?: boolean; onUnpin?: () => void }) {
  const [faceScale, setFaceScale] = useState(1);
  if (!id) {
    return (
      <div className="inspect muted">
        把滑鼠移到卡片上可以看到完整說明。
        <br />
        右鍵點卡片（或點一下不能操作的卡）可以固定說明。
      </div>
    );
  }
  const c = card ?? getCard(id);
  const layered = fullFace ? gameFaceFor(id) : undefined;
  const previewWidth = `min(${FACE_PREVIEW_WIDTH * faceScale}px, ${100 * faceScale / MAX_FACE_SCALE}%)`;
  const kws = keywordsIn(c.text);
  return (
    <div className="inspect" style={{ ['--cc' as string]: cardColor(c), ['--cb' as string]: cardBorderColor(c) }}>
      {pinned && (
        <div className="pinbar">
          <span>已固定這張的說明</span>
          <button onClick={onUnpin}>取消固定</button>
        </div>
      )}
      {layered ? (
        <>
          <div className="row face-zoom" role="group" aria-label="卡圖縮放">
            <button type="button" disabled={faceScale === MIN_FACE_SCALE}
              onClick={() => setFaceScale((scale) => Math.max(MIN_FACE_SCALE, scale - FACE_SCALE_STEP))}>縮小</button>
            <output className="muted">{faceScale * 100}%</output>
            <button type="button" disabled={faceScale === MAX_FACE_SCALE}
              onClick={() => setFaceScale((scale) => Math.min(MAX_FACE_SCALE, scale + FACE_SCALE_STEP))}>放大</button>
          </div>
          <GameLayeredFace face={layered} card={c} className="full-face-preview" style={{ width: previewWidth }} />
        </>
      ) : (
        <div className="bigart">
          <CardArt id={id} card={card} />
        </div>
      )}
      <div className="nm">{c.name}</div>
      <div className="muted">{c.cls}・{kindLabel(c)}</div>
      <div className="st">
        {c.kind === 'move' && !(isExCardId(c.id) && c.duration !== undefined)
          ? `攻擊 ${c.atk}　防禦 ${c.def}　連擊值 ${c.combo}`
          : c.kind === 'move'
          ? `持續回合 ${c.duration}`
          : `經驗需求 ${c.expReq}${c.kind === 'buff' ? `　持續時間 ${c.duration}` : ''}`}
      </div>
      {expActive && <div className="expnote">經驗效果：生效中</div>}
      <div className="tx">{c.text ? <CardText text={c.text} /> : '（無效果）'}</div>
      {kws.length > 0 && (
        <div className="kwlist">
          {kws.map((k) => (
            <div key={k.name}>
              <b>{k.name}</b>：{k.desc}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
