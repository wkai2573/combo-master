import type { TurnStats } from '../../stats/summary';

/** 回合數長條圖：橫軸回合數、縱軸場數，下方列出場數與平均、最短、最長 */
export function TurnChart({ stats }: { stats: TurnStats | null }) {
  if (!stats) return <div className="muted">這個範圍還沒有場次。</div>;
  const top = Math.max(...stats.histogram.map((h) => h.games));
  return (
    <div className="turnchart">
      <div className="tc-bars" role="img" aria-label={`回合數分布，共 ${stats.games} 場`}>
        {stats.histogram.map((h) => (
          <div key={h.turns} className="tc-col" title={`${h.turns} 回合：${h.games} 場`}>
            <span className="tc-n">{h.games > 0 ? h.games : ''}</span>
            <div className="tc-bar" style={{ height: `${(h.games / top) * 100}%` }} />
            <span className="tc-x">{h.turns}</span>
          </div>
        ))}
      </div>
      <div className="muted tc-axis">橫軸：回合數　縱軸：場數</div>
      <div className="tc-sum">
        共 {stats.games} 場　平均 {stats.avg.toFixed(1)} 回合　最短 {stats.min} 回合　最長 {stats.max} 回合
      </div>
    </div>
  );
}
