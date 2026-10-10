import { useMemo, useState } from 'react';
import { ALL_CHARACTERS } from '../../data/cards';
import { defaultStore } from '../../stats/upload';
import { APP_VERSION } from '../../version';
import { characterSeats, characterSummary, filterByOpponent, legacyCount, matchupTable, MIN_WIN_RATE_VERSION, seatStats, turnStats, unseatedCount, type Cell, type OpponentFilter, type SeatStats } from '../../stats/summary';
import { TurnChart } from '../components/TurnChart';
import { useCloudRecords } from '../useCloudRecords';

/** 戰績倉庫：整個頁面共用一個，沒有設定伺服器時是 null */
const STORE = defaultStore();

const FILTERS: [OpponentFilter, string][] = [['all', '全部'], ['cpu', '電腦'], ['player', '玩家']];
const CHARS = ALL_CHARACTERS.filter((c) => !c.pending).map((c) => c.id);

/** 四捨五入但不把 99.6% 顯示成 100%、也不把 0.4% 顯示成 0%：滿分與零分只留給真的全勝與全敗 */
const percent = (rate: number) => `${rate === 0 ? 0 : rate === 1 ? 100 : Math.min(99, Math.max(1, Math.round(rate * 100)))}%`;

type Tab = 'table' | 'char' | 'seat' | 'turns';
const TABS: [Tab, string][] = [['table', '角色對戰表'], ['char', '單看角色'], ['seat', '先後攻'], ['turns', '回合數圖表']];

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

/** mirror：同角色對打只列場數，勝負平沒有意義 */
function RowCells({ cell, mirror = false }: { cell: Cell; mirror?: boolean }) {
  return (
    <>
      <td>{cell.rate === null ? '—' : percent(cell.rate)}</td>
      <td>{cell.games > 0 ? cell.games : '—'}</td>
      <td>{mirror ? '—' : cell.win}</td>
      <td>{mirror ? '—' : cell.lose}</td>
      <td>{mirror ? '—' : cell.draw}</td>
    </>
  );
}

/** 先攻與後攻兩列；先後攻沒有同角色對打（已排除），所以每格都有勝負平 */
function SeatTable({ seats, label }: { seats: SeatStats; label: string }) {
  return (
    <div className="rtable-wrap">
      <table className="rtable">
        <thead>
          <tr><th>{label}</th><th>勝率</th><th>場數</th><th>勝</th><th>負</th><th>平</th></tr>
        </thead>
        <tbody>
          <tr><th>先攻</th><RowCells cell={seats.first} /></tr>
          <tr><th>後攻</th><RowCells cell={seats.second} /></tr>
        </tbody>
      </table>
    </div>
  );
}

export function Records({ onBack }: { onBack: () => void }) {
  const [filter, setFilter] = useState<OpponentFilter>('all');
  // 版本複選：沒動過就用預設（勝率統計最低版本以上的所有版本）；三個檢視共用
  const [picked, setPicked] = useState<string[] | null>(null);
  const [tab, setTab] = useState<Tab>('table');
  const [pair, setPair] = useState<[string, string] | null>(null);
  const [char, setChar] = useState(CHARS[0]);

  // 戰績來自雲端的全站資料：版本勾選決定向伺服器取哪些版本，對手類型再在這裡篩
  const cloud = useCloudRecords(STORE, picked);
  const { versions, chosen, records } = cloud;
  const shown = useMemo(() => filterByOpponent(records, filter), [records, filter]);
  const toggleVersion = (v: string) => setPicked(chosen.includes(v) ? chosen.filter((x) => x !== v) : [...chosen, v]);
  const table = useMemo(() => matchupTable(shown, CHARS), [shown]);
  const legacy = legacyCount(shown);
  const legacyNote = legacy > 0 && (
    <div className="muted" style={{ fontSize: 12 }}>
      範圍內含 {legacy} 場規則和現在不同的舊版本紀錄（低於 v{MIN_WIN_RATE_VERSION}），數字不一定能和新版本直接比較。
    </div>
  );
  const unseated = unseatedCount(shown);
  const charUnseated = unseatedCount(shown, char);
  const seats = useMemo(() => seatStats(shown), [shown]);
  const charSeat = useMemo(() => characterSeats(shown, char), [shown, char]);
  const pairStats = useMemo(() => (pair ? turnStats(shown, { a: pair[0], b: pair[1] }) : null), [shown, pair]);
  const allStats = useMemo(() => turnStats(shown), [shown]);
  const summary = useMemo(() => characterSummary(shown, char, CHARS), [shown, char]);
  const charStats = useMemo(() => turnStats(shown, { a: char }), [shown, char]);

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
        {versions.length > 0 && (
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <span>版本</span>
            {versions.map(({ version, games }) => (
              <label key={version} className="row" style={{ gap: 4 }}>
                <input type="checkbox" checked={chosen.includes(version)} onChange={() => toggleVersion(version)} />
                v{version}<span className="muted">（{games} 場）</span>
              </label>
            ))}
            <button onClick={() => setPicked(versions.map((v) => v.version))}>全選</button>
            <button onClick={() => setPicked([APP_VERSION])}>只選目前版本</button>
            <button onClick={() => setPicked(null)}>預設</button>
          </div>
        )}
        {(cloud.status === 'loading' || cloud.status === 'error' || cloud.stale) && records.length > 0 && (
          <div className="row" style={{ fontSize: 12 }}>
            {cloud.status === 'loading' && <span className="muted">更新中…</span>}
            {cloud.status === 'error' && (
              <>
                <span style={{ color: 'var(--bad)' }}>{cloud.error}</span>
                <button onClick={cloud.retry}>重試</button>
              </>
            )}
            {cloud.stale && cloud.status !== 'loading' && <span className="muted">顯示的是上次成功取得的資料。</span>}
          </div>
        )}
        <div className="tabs">
          {TABS.map(([key, label]) => (
            <button key={key} className={tab === key ? 'primary' : ''} onClick={() => setTab(key)}>{label}</button>
          ))}
        </div>
        {cloud.status === 'unavailable' ? (
          <div className="muted">雲端戰績目前不可用（還沒有設定戰績伺服器）。對局照常進行，不受影響。</div>
        ) : cloud.status === 'loading' && records.length === 0 ? (
          <div className="muted">載入戰績中…</div>
        ) : cloud.status === 'error' && records.length === 0 ? (
          <div className="row">
            <span style={{ color: 'var(--bad)' }}>{cloud.error}</span>
            <button onClick={cloud.retry}>重試</button>
          </div>
        ) : versions.length === 0 ? (
          <div className="muted">雲端還沒有戰績。打完一場對局就會自動上傳。</div>
        ) : chosen.length === 0 ? (
          <div className="muted">請至少勾選一個版本。</div>
        ) : shown.length === 0 ? (
          <div className="muted">這個對手類型與版本還沒有戰績。</div>
        ) : tab === 'char' ? (
          <>
            <label className="row">
              <span>角色</span>
              <select value={char} onChange={(e) => setChar(e.target.value)}>
                {CHARS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <div className="muted" style={{ fontSize: 12 }}>
              包含對手用 {char} 的場次（對手贏就是 {char} 輸）。總勝率不含同角色對打。
            </div>
            <table className="rtable">
              <thead>
                <tr><th>對手</th><th>勝率</th><th>場數</th><th>勝</th><th>負</th><th>平</th></tr>
              </thead>
              <tbody>
                <tr className="rtotal">
                  <th>全部角色</th>
                  <RowCells cell={summary.total} />
                </tr>
                {summary.versus.map(({ opponent, cell }) => (
                  <tr key={opponent}>
                    <th>{opponent === char ? `${opponent}（同角色）` : opponent}</th>
                    <RowCells cell={cell} mirror={opponent === char} />
                  </tr>
                ))}
              </tbody>
            </table>
            <SeatTable seats={charSeat} label={`${char} 的身分`} />
            <div className="muted" style={{ fontSize: 12 }}>
              先攻、後攻指整場開局隨機決定的那一次，不含同角色對打。{charUnseated > 0 && `另有 ${charUnseated} 場沒有先後攻資料（舊版本的紀錄，或連線時房主的版本較舊），不計入。`}
            </div>
            <b>{char} 出場的回合數</b>
            <TurnChart stats={charStats} />
            {legacyNote}
          </>
        ) : tab === 'seat' ? (
          <>
            <div className="muted" style={{ fontSize: 12 }}>
              先攻、後攻指整場開局隨機決定的那一次（之後每回合會交換）。不管你是哪一邊，統計開局先攻方與後攻方各贏幾場，兩邊互補。勝率 = 勝 ÷（勝 + 負），平手不計；不含同角色對打。
            </div>
            <SeatTable seats={seats} label="身分" />
            {unseated > 0 && <div className="muted" style={{ fontSize: 12 }}>另有 {unseated} 場沒有先後攻資料（舊版本的紀錄，或連線時房主的版本較舊），不計入。</div>}
          </>
        ) : tab === 'turns' ? (
          <>
            <div className="muted" style={{ fontSize: 12 }}>目前篩選範圍內全部場次的回合數分布。</div>
            <TurnChart stats={allStats} />
            {legacyNote}
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
            {legacyNote}
          </>
        )}
        <div className="muted" style={{ fontSize: 12 }}>
          這是所有玩家的戰績，存在雲端；連線對局只由房主上傳，一場只算一筆。對手離線判負、中途離開、開過作弊模式的對局不記錄。
        </div>
      </div>
    </div>
  );
}
