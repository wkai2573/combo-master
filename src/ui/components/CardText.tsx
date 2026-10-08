import { lineBoxes, parseCardText, type CardBox } from '../../data/cardText';
import { keywordsIn } from '../../data/keywords';
import { hideTip, showTip } from '../tooltip';
import { KeywordText } from './KeywordText';

/** 費用圖示：蓋是一張牌背，怒是一團火 */
function CostIcon({ icon }: { icon: '蓋' | '怒' }) {
  return (
    <svg className={`cx-icon ${icon === '蓋' ? 'cover' : 'rage'}`} viewBox="0 0 16 16" aria-hidden="true">
      {icon === '蓋' ? (
        <>
          <rect x="3" y="1.8" width="10" height="12.4" rx="1.8" fill="currentColor" fillOpacity=".22" stroke="currentColor" strokeWidth="1.2" />
          <path d="M5.4 5.2 8 3.4l2.6 1.8L8 7zM5.4 10.6 8 8.8l2.6 1.8L8 12.4z" fill="currentColor" />
        </>
      ) : (
        <path d="M8 1.2c.5 2.4-2 3.5-2 5.8 0 .8.3 1.3.8 1.7-.2-1.5.8-2.3 1.6-3.2.9 1.4 2.6 2.5 2.6 4.6 0 2.2-1.6 3.7-3.5 3.7s-3.4-1.5-3.4-3.4c0-1 .4-2 1.1-2.7C6.2 6.1 8.1 4.6 8 1.2z" fill="currentColor" />
      )}
    </svg>
  );
}

/** 一行開頭的特殊框；滑入或聚焦時顯示對應關鍵字的說明 */
function Box({ box }: { box: CardBox }) {
  const kws = keywordsIn(box.source);
  const cls = ['cx-box', `cx-${box.kind}`, box.icon === '蓋' ? 'cover' : box.icon === '怒' ? 'rage' : ''].filter(Boolean).join(' ');
  return (
    <span
      className={cls}
      tabIndex={kws.length ? 0 : undefined}
      onMouseEnter={(e) => kws.length && showTip(e.currentTarget, kws)}
      onMouseLeave={hideTip}
      onFocus={(e) => kws.length && showTip(e.currentTarget, kws)}
      onBlur={hideTip}
    >
      {box.icon ? (
        <>
          <CostIcon icon={box.icon} />
          <b>{box.value}</b>
        </>
      ) : (
        box.label
      )}
    </span>
  );
}

/**
 * 卡片效果文字，依撰寫規範分段上色：回合X次、開頭關鍵字、費用用特殊框（蓋與怒用圖示），
 * 時機綠底、條件藍底並與時機相連，效果無底色，效果裡的動作關鍵字維持黃字底線與滑入提示。
 * 多行卡文每行各自上色；轉述別張卡的標題行不上色。
 */
export function CardText({ text }: { text: string }) {
  return (
    <>
      {parseCardText(text).map((line, i) =>
        line.kind === 'header' ? (
          <div key={i} className="cx-line cx-header">
            <KeywordText text={line.raw} />
          </div>
        ) : (
          <div key={i} className="cx-line">
            {lineBoxes(line).map((b, j) => (
              <Box key={j} box={b} />
            ))}
            {line.timing && (
              <span className="cx-timing">
                <KeywordText text={line.timing} />
              </span>
            )}
            {line.condition && (
              <span className="cx-cond">
                <KeywordText text={line.condition} />
              </span>
            )}
            <KeywordText text={line.effect} />
          </div>
        ),
      )}
    </>
  );
}
