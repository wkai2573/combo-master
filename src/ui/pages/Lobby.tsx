import { useMemo, useState } from 'react';
import { getCharacter } from '../../data/cards';
import { playableDecks, type DeckEntry } from '../../deck/storage';
import { GuestSession, HostSession, LocalSession, type Session } from '../../net/session';

export type LobbyMode = 'host' | 'join' | 'practice';

const TITLE: Record<LobbyMode, string> = { host: '建立房間', join: '加入房間', practice: '單機練習' };

export function Lobby({ mode, onStart, onBack }: { mode: LobbyMode; onStart: (s: Session) => void; onBack: () => void }) {
  const decks = useMemo(playableDecks, []);
  const [deckId, setDeckId] = useState(decks[0]?.id ?? '');
  const [oppId, setOppId] = useState('random');
  const [code, setCode] = useState('');
  const deck: DeckEntry | undefined = decks.find((d) => d.id === deckId);
  const ch = deck ? getCharacter(deck.charId) : undefined;

  const start = () => {
    if (!deck) return;
    const payload = { charId: deck.charId, cards: deck.cards };
    if (mode === 'host') onStart(new HostSession(payload));
    else if (mode === 'join') onStart(new GuestSession(code, payload));
    else {
      const opp = oppId === 'random' ? decks[Math.floor(Math.random() * decks.length)] : decks.find((d) => d.id === oppId)!;
      onStart(new LocalSession(payload, { charId: opp.charId, cards: opp.cards }));
    }
  };

  return (
    <div className="page narrow">
      <div className="row" style={{ marginBottom: 10 }}>
        <button onClick={onBack}>← 返回</button>
        <h2 style={{ margin: 0 }}>{TITLE[mode]}</h2>
      </div>
      <div className="panel" style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>我的牌組</span>
          <select value={deckId} onChange={(e) => setDeckId(e.target.value)}>
            {decks.map((d) => <option key={d.id} value={d.id}>{d.name}（{d.charId}）</option>)}
          </select>
        </label>
        {ch && (
          <div className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
            <div>{ch.cls}・生命值 {ch.hp}・覺醒需要經驗 {ch.expReq}</div>
            <div>效果：{ch.text}</div>
            <div>覺醒：{ch.awakenText}</div>
          </div>
        )}
        {mode === 'practice' && (
          <label style={{ display: 'grid', gap: 4 }}>
            <span>對手牌組</span>
            <select value={oppId} onChange={(e) => setOppId(e.target.value)}>
              <option value="random">隨機</option>
              {decks.map((d) => <option key={d.id} value={d.id}>{d.name}（{d.charId}）</option>)}
            </select>
          </label>
        )}
        {mode === 'join' && (
          <label style={{ display: 'grid', gap: 4 }}>
            <span>房號（6 碼）</span>
            <input value={code} maxLength={6} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="例如 K7M2QX"
              style={{ fontSize: 22, letterSpacing: 4, textAlign: 'center' }} />
          </label>
        )}
        {decks.length === 0 && <div style={{ color: 'var(--bad)' }}>沒有可用的牌組，請先到「組牌」建立合法牌組。</div>}
        <button className="primary" disabled={!deck || (mode === 'join' && code.trim().length !== 6)} onClick={start}>
          {mode === 'host' ? '建立房間' : mode === 'join' ? '加入' : '開始練習'}
        </button>
        {mode !== 'practice' && (
          <div className="muted" style={{ fontSize: 12 }}>
            連線使用 PeerJS 點對點。若雙方網路較嚴格（企業網路、部分行動網路）可能連不上，換個網路再試。
          </div>
        )}
      </div>
    </div>
  );
}
