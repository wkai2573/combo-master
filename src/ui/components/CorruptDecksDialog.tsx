import { useRef, useState } from 'react';
import { discardCorruptDeck, inspectSavedDecks, type CorruptDeck } from '../../deck/storage';
import { Modal } from './Modal';

function CorruptItem({ item, onDiscard }: { item: CorruptDeck; onDiscard: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(item.raw);
      setCopied(true);
    } catch {
      // 剪貼簿不可用：選取文字，提示玩家自己複製
      ref.current?.focus();
      ref.current?.select();
      setFailed(true);
    }
  };

  return (
    <div style={{ marginTop: 10 }}>
      <div className="muted">{item.reason}</div>
      <textarea
        ref={ref}
        readOnly
        style={{ width: '100%', height: 140, boxSizing: 'border-box' }}
        value={item.raw}
        onFocus={(e) => e.currentTarget.select()}
      />
      <div className="row" style={{ marginTop: 6 }}>
        <button onClick={copy}>{copied ? '已複製' : '複製'}</button>
        <button onClick={onDiscard}>刪除</button>
        {failed && <span style={{ color: 'var(--bad)' }}>無法自動複製，文字已選取，請按 Ctrl+C</span>}
      </div>
    </div>
  );
}

/** 啟動時偵測到讀不進來的牌組資料就提示：可複製原文、刪除，或先關閉（本次載入不再提示） */
export function CorruptDecksDialog() {
  const [items, setItems] = useState<CorruptDeck[]>(() => inspectSavedDecks().corrupt);
  const [closed, setClosed] = useState(false);
  if (closed || items.length === 0) return null;

  return (
    <Modal>
      <h3>有牌組資料無法讀取</h3>
      <div className="muted" style={{ maxWidth: 460 }}>
        下面的資料已失效，不會出現在牌組列表。可以先複製留存，再刪除；不刪除的話，下次開啟還會提示。
        若整份資料都壞了，先關閉再儲存牌組會把它覆蓋掉，請先複製。
      </div>
      {items.map((item, i) => (
        <CorruptItem
          key={`${i}:${item.raw}`}
          item={item}
          onDiscard={() => {
            discardCorruptDeck(item);
            setItems(inspectSavedDecks().corrupt);
          }}
        />
      ))}
      <div className="row" style={{ marginTop: 12 }}>
        <button onClick={() => setClosed(true)}>關閉</button>
      </div>
    </Modal>
  );
}
