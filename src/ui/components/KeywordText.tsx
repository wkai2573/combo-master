import { segmentsOf } from '../../data/keywords';
import { hideTip, showTip, toggleTip, useTip } from '../tooltip';

/** 把文字裡的關鍵字標成可滑入查看（鍵盤聚焦也會顯示，點擊可切換） */
export function KeywordText({ text, termIcons = false }: { text: string; termIcons?: boolean }) {
  return (
    <>
      {segmentsOf(text).map((s, i) => {
        if (s.kws.length === 0) return s.text;
        const group = termIcons ? s.kws[0].group : undefined;
        const termClass = group === '動作' ? 'cx-action' : group === '名詞' ? 'cx-noun' : undefined;
        return (
          <span
            key={i}
            className={termClass ? 'kw cx-keyword-icon' : 'kw'}
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
            {termClass ? <span className={`cx-term ${termClass}`}>{s.text}</span> : s.text}
          </span>
        );
      })}
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
