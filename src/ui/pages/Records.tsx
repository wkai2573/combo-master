import { useMemo, useState } from 'react';
import { ALL_CHARACTERS } from '../../data/cards';
import { clearRecords, listRecords } from '../../stats/records';
import { filterByOpponent, legacyCount, matchupTable, turnStats, type Cell, type OpponentFilter } from '../../stats/summary';
import { Modal } from '../components/Modal';
import { TurnChart } from '../components/TurnChart';

const FILTERS: [OpponentFilter, string][] = [['all', '全部'], ['cpu', '電腦'], ['player', '玩家']];
const CHARS = ALL_CHARACTERS.filter((c) => !c.pending).map((c) => c.id);

const percent = (rate: number) => `${Math.round(rate * 100)}%`;

type Tab = 'table' | 'turns';
const TABS: [Tab, string][] = [['table', '角色對戰表'], ['turns', '回合數圖表']];

function CellView({ cell, picked, onPick }: { cell: Cell; picked: boolean; onPick: () => void }) {
  if (cell.games === 0) return <td className="rcell none">—</td>;
  const tone = cell.rate === null ? '' : cell.rate > 0.5 ? 'good' : cell.rate < 0.5 ? 'bad' : '';
  return (
    <td
      className={`rcell pickable ${tone} ${picked ? 'picked' : ''}`}
      title={`${cell.win} 勝　${cell.lose} 負　${cell.draw} 平`}
      onClick={onPick}
    >
      <b>{cell.rate === null ? '—' : percent(cell.rate)}</b>
      <span className="muted">{cell.games} 場</span>
      {cell.rate !== null && <span className="muted">{cell.win}勝{cell.lose}負{cell.draw > 0 ? `${cell.draw}平` : ''}</span>}
    </td>
  );
}

export function Records({ onBack }: { onBack: () => void }) {
  const [records, setRecords] = useState(listRecords);
  const [filter, setFilter] = useState<OpponentFilter>('all');
  const [confirming, setConfirming] = useState(false);
  const [tab, setTab] = useState<Tab>('table');
  const [pair, setPair] = useState<[string, string] | null>(null);

  const shown = useMemo(() => filterByOpponent(records, filter), [records, filter]);
  const table = useMemo(() => matchupTable(shown, CHARS), [shown]);
  const legacy = legacyCount(shown);
  const pairStats = useMemo(() => (pair ? turnStats(shown, { a: pair[0], b: pair[1] }) : null), [shown, pair]);
  const allStats = useMemo(() => turnStats(shown), [shown]);

  return (
    <div className="page records">
      <div className="row" style={{ marginBottom: 10 }}>
        <button onClick={onBack}>← 返回</button>
        <h2 style={{ margin: 0 }}>戰績</h2>
      </div>
      <div className="panel" style={{ display: 'grid', gap: 12 }}>
        <div className="row">
          <span>對手</span>
          {FILTERS.map(([key, label]) => (
            <button key={key} className={filter === key ? 'primary' : ''} onClick={() => setFilter(key)}>{label}</button>
          ))}
          <span className="muted">共 {shown.length} 場</span>
        </div>
        <div className="tabs">
          {TABS.map(([key, label]) => (
            <button key={key} className={tab === key ? 'primary' : ''} onClick={() => setTab(key)}>{label}</button>
          ))}
        </div>
        {records.length === 0 ? (
          <div className="muted">還沒有戰績。打完一場對局就會自動記錄。</div>
        ) : shown.length === 0 ? (
          <div className="muted">這個對手類型還沒有戰績。</div>
        ) : tab === 'turns' ? (
          <>
            <div className="muted" style={{ fontSize: 12 }}>目前篩選範圍內全部場次的回合數分布，含舊版本紀錄。</div>
            <TurnChart stats={allStats} />
          </>
        ) : (
          <>
            <div className="muted" style={{ fontSize: 12 }}>
              縱軸是我的角色，橫軸是對手角色，點一格看該組合的回合數。勝率 = 勝 ÷（勝 + 負），平手不計；兩個方向合併，同角色對打只列場數。
            </div>
            <div className="rtable-wrap">
              <table className="rtable">
                <thead>
                  <tr>
                    <th>我 \ 對手</th>
                    {CHARS.map((c) => <th key={c}>{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {CHARS.map((a, i) => (
                    <tr key={a}>
                      <th>{a}</th>
                      {CHARS.map((b, j) => (
                        <CellView
                          key={b}
                          cell={table[i][j]}
                          picked={pair?.[0] === a && pair[1] === b}
                          onPick={() => setPair(pair?.[0] === a && pair[1] === b ? null : [a, b])}
                        />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pair && (
              <div style={{ display: 'grid', gap: 6 }}>
                <b>{pair[0] === pair[1] ? `${pair[0]} 同角色對打` : `${pair[0]} 與 ${pair[1]}`}的回合數</b>
                <TurnChart stats={pairStats} />
              </div>
            )}
            {legacy > 0 && <div className="muted" style={{ fontSize: 12 }}>另有 {legacy} 場舊版本紀錄只計入回合數，不進勝率。</div>}
          </>
        )}
        <div className="muted" style={{ fontSize: 12 }}>
          戰績只存在這個瀏覽器。對手離線判負、中途離開、開過作弊模式的對局不記錄。
        </div>
        <div>
          <button className="danger" disabled={records.length === 0} onClick={() => setConfirming(true)}>清除全部紀錄</button>
        </div>
      </div>
      {confirming && (
        <Modal onClose={() => setConfirming(false)}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>確定要清除全部 {records.length} 場戰績嗎？清除後無法復原。</div>
            <div className="row">
              <button
                className="danger"
                onClick={() => {
                  clearRecords();
                  setRecords(listRecords());
                  setConfirming(false);
                }}
              >
                清除
              </button>
              <button onClick={() => setConfirming(false)}>取消</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
