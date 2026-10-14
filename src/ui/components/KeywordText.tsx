import { segmentsOf } from '../../data/keywords';
import { hideTip, showTip, toggleTip, useTip } from '../tooltip';

/** 把文字裡的關鍵字標成可滑入查看（鍵盤聚焦也會顯示，點擊可切換） */
export function KeywordText({ text }: { text: string }) {
  return (
    <>
      {segmentsOf(text).map((s, i) =>
        s.kws.length > 0 ? (
          <span
            key={i}
            className="kw"
            tabIndex={0}
            onMouseEnter={(e) => showTip(e.currentTarget, s.kws)}
            onMouseLeave={hideTip}
            onFocus={(e) => showTip(e.currentTarget, s.kws)}
            onBlur={hideTip}
            onClick={(e) => {
              e.stopPropagation();
              toggleTip(e.currentTarget, s.kws);
            }}
          >
            {s.text}
          </span>
        ) : (
          s.text
        ),
      )}
    </>
  );
}

/** 整個網站只放一個，顯示目前指到的關鍵字說明（點擊自身即可關閉） */
export function KeywordTooltip() {
  const tip = useTip();
  if (!tip) return null;
  const left = Math.max(8, Math.min(tip.left, window.innerWidth - 300));
  return (
    <div className="kwtip" style={{ left, top: tip.top }} role="tooltip" onClick={hideTip}>
      {tip.kws.map((k) => (
        <div key={k.name}>
          <b>{k.name}</b>
          <span className="g">{k.group}</span>
          <div>{k.desc}</div>
        </div>
      ))}
    </div>
  );
}
