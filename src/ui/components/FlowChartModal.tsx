import { useMemo } from 'react';
import type { Phase } from '../../engine/types';
import { buildFlowChart, highlightNode, type Tone } from '../flowChart';
import { Modal } from './Modal';

const TONES: Tone[] = ['plain', 'good', 'bad', 'accent', 'note'];
const LINE_H = 16;

/** 戰鬥流程圖：靜態的規則地圖。從戰鬥畫面開啟時傳入目前階段，主幹上會標出「你在這裡」 */
export function FlowChartModal({ phase, onClose }: { phase?: Phase; onClose: () => void }) {
  const chart = useMemo(buildFlowChart, []);
  const here = highlightNode(phase);

  return (
    <Modal onClose={onClose}>
      <div className="flowchart">
        <div className="fchead">
          <h3>戰鬥流程圖</h3>
          <button onClick={onClose}>關閉</button>
        </div>
        <svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="group" aria-label="回合與戰鬥流程圖">
          <defs>
            {TONES.map((t) => (
              <marker key={t} id={`fc-arrow-${t}`} className={`fc-${t}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0,1 L9,5 L0,9 z" />
              </marker>
            ))}
          </defs>
          {chart.groups.map((g) => (
            <g key={g.label} className="fc-group">
              <rect x={g.x} y={g.y} width={g.w} height={g.h} rx={10} />
              <text x={g.x + 10} y={g.y + 15}>{g.label}</text>
            </g>
          ))}
          {chart.edges.map((e) => (
            <path key={e.id} className={`fc-edge fc-${e.tone}${e.dashed ? ' dashed' : ''}`} d={e.d} markerEnd={`url(#fc-arrow-${e.tone})`} />
          ))}
          {chart.nodes.map((n) => {
            const isHere = n.id === here;
            const top = n.y + n.h / 2 - ((n.lines.length - 1) * LINE_H) / 2;
            return (
              <g key={n.id} className={`fc-node fc-${n.tone}${isHere ? ' here' : ''}`}>
                <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={8} />
                {n.lines.map((line, i) => (
                  <text key={i} x={n.x + n.w / 2} y={top + i * LINE_H + 5} className={n.phase && i === 0 ? 'title' : undefined}>
                    {line}
                  </text>
                ))}
                {isHere && (
                  <g className="fc-here">
                    <rect x={n.x + n.w - 70} y={n.y - 12} width={64} height={18} rx={9} />
                    <text x={n.x + n.w - 38} y={n.y + 1}>你在這裡</text>
                  </g>
                )}
              </g>
            );
          })}
          {chart.edges.map(
            (e) =>
              e.label && (
                <text
                  key={`${e.id}-label`}
                  className={`fc-label fc-${e.tone}`}
                  x={e.label.x}
                  y={e.label.y}
                  style={{ textAnchor: e.label.anchor ?? 'start' }}
                  transform={e.label.vertical ? `rotate(-90 ${e.label.x} ${e.label.y})` : undefined}
                >
                  {e.label.text}
                </text>
              ),
          )}
        </svg>
      </div>
    </Modal>
  );
}
