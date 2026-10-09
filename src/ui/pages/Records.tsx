import { useState } from 'react';
import { clearRecords, listRecords } from '../../stats/records';
import { Modal } from '../components/Modal';

export function Records({ onBack }: { onBack: () => void }) {
  const [records, setRecords] = useState(listRecords);
  const [confirming, setConfirming] = useState(false);

  const count = (o: 'win' | 'lose' | 'draw') => records.filter((r) => r.outcome === o).length;

  return (
    <div className="page narrow">
      <div className="row" style={{ marginBottom: 10 }}>
        <button onClick={onBack}>← 返回</button>
        <h2 style={{ margin: 0 }}>戰績</h2>
      </div>
      <div className="panel" style={{ display: 'grid', gap: 12 }}>
        {records.length === 0 ? (
          <div className="muted">還沒有戰績。打完一場對局就會自動記錄。</div>
        ) : (
          <div>共 {records.length} 場：{count('win')} 勝　{count('lose')} 負　{count('draw')} 平</div>
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
