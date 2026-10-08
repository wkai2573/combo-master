import { useMemo } from 'react';
import type { Phase } from '../../engine/types';
import { buildFlowChart, highlightNode, type EdgeTone, type Tone } from '../flowChart';
import { Modal } from './Modal';

const EDGE_TONES: EdgeTone[] = ['plain', 'turn', 'combat', 'good', 'bad', 'branch'];
const LEGEND: { tone: Tone; label: string }[] = [
  { tone: 'turn', label: '回合階段' },
  { tone: 'combat', label: '戰鬥步驟' },
  { tone: 'good', label: '追擊成功' },
  { tone: 'bad', label: '失敗與勝負' },
  { tone: 'note', label: '備註' },
];
const LEGEND_X = 100;
const LEGEND_PITCH = 112;
// 標題與說明在節點內的基線位置
const TITLE_DY = 25;
const SUB_DY = 44;

/** 戰鬥流程圖：靜態的規則地圖。從戰鬥畫面開啟時傳入目前階段，主幹上會標出「你在這裡」 */
export function FlowChartModal({ phase, onClose }: { phase?: Phase; onClose: () => void }) {
  const chart = useMemo(buildFlowChart, []);
  const here = highlightNode(phase);

  return (
    <Modal onClose={onClose}>
      <div className="flowchart">
        <div className="fchead">
          <h3>戰鬥流程圖</h3>
          <span className="muted fchint">手機上可左右、上下拖曳</span>
          <button onClick={onClose}>關閉</button>
        </div>
        <div className="fcscroll" tabIndex={0} role="region" aria-label="流程圖，可用方向鍵捲動">
          <svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="group" aria-label="回合與戰鬥流程圖">
            <defs>
              {EDGE_TONES.map((t) => (
                <marker key={t} id={`fc-arrow-${t}`} className={`fc-e-${t}`} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" />
                </marker>
              ))}
              <pattern id="fc-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M40 0H0V40" />
              </pattern>
            </defs>
            <rect className="fc-gridfill" width="100%" height="100%" />
            {chart.lanes.map((l) => (
              <g key={l.label} className={`fc-lane${l.exception ? ' ex' : ''}`}>
                <rect x={l.x} y={l.y} width={l.w} height={l.h} rx={10} />
                {l.exception && <rect className="exframe" x={l.x + 6} y={l.y + 6} width={l.w - 12} height={l.h - 12} rx={8} />}
                <text x={l.x + 16} y={l.y + 24}>{l.label}</text>
              </g>
            ))}
            {chart.edges.map((e) => (
              <path key={e.id} className={`fc-edge fc-e-${e.tone}${e.dashed ? ' dashed' : ''}`} d={e.d} markerEnd={`url(#fc-arrow-${e.tone})`} />
            ))}
            {chart.nodes.map((n) => {
              const isHere = n.id === here;
              return (
                <g key={n.id} className={`fc-node fc-n-${n.tone}${n.dashed ? ' dashed' : ''}${isHere ? ' here' : ''}`}>
                  <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={9} />
                  <rect className="icon" x={n.x + 8} y={n.y + 9} width={9} height={9} rx={2.5} />
                  <text className="title" x={n.x + n.w / 2 + 5} y={n.y + TITLE_DY}>{n.lines[0]}</text>
                  <text className="sub" x={n.x + n.w / 2} y={n.y + SUB_DY}>{n.lines[1]}</text>
                  {isHere && (
                    <g className="fc-here">
                      <rect x={n.x + 4} y={n.y + n.h - 6} width={64} height={18} rx={9} />
                      <text x={n.x + 36} y={n.y + n.h + 7}>你在這裡</text>
                    </g>
                  )}
                </g>
              );
            })}
            {chart.edges.map(
              (e) =>
                e.label && (
                  <text key={`${e.id}-label`} className={`fc-label fc-e-${e.tone}`} x={e.label.x} y={e.label.y + 3}>
                    {e.label.text}
                  </text>
                ),
            )}
            <g className="fc-legend">
              <text className="lg-title" x={56} y={chart.legendY + 10}>圖例</text>
              {LEGEND.map((it, i) => (
                <g key={it.tone} className={`fc-node fc-n-${it.tone}`} transform={`translate(${LEGEND_X + i * LEGEND_PITCH} ${chart.legendY})`}>
                  <rect width={16} height={11} rx={3} />
                  <text x={22} y={10}>{it.label}</text>
                </g>
              ))}
              <path className="fc-edge fc-e-branch dashed" d={`M${LEGEND_X + LEGEND.length * LEGEND_PITCH},${chart.legendY + 6} h30`} markerEnd="url(#fc-arrow-branch)" />
              <text x={LEGEND_X + LEGEND.length * LEGEND_PITCH + 38} y={chart.legendY + 10}>條件分支</text>
            </g>
          </svg>
        </div>
      </div>
    </Modal>
  );
}
