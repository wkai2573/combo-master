import { useMemo, useState } from 'react';
import { ALL_CHARACTERS, getCard, getCharacter, PLAYABLE_CARDS } from '../../data/cards';
import { isCardEnabled } from '../../data/enabledCards';
import { presetDeck } from '../../data/presetDecks';
import type { CardData, CardKind } from '../../data/types';
import { deleteDeck, exportDeck, importDeck, listDecks, saveDeck, type DeckEntry } from '../../deck/storage';
import { MAX_COPIES, validateDeck } from '../../deck/validate';
import { CardFace, InspectContext, InspectPanel } from '../components/CardFace';
import { Modal } from '../components/Modal';

const KIND_ORDER: Record<CardKind, number> = { move: 0, equip: 1, buff: 2 };
const byOrder = (a: CardData, b: CardData) =>
  KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.combo - b.combo || a.name.localeCompare(b.name, 'zh-Hant');

export function DeckBuilder({ onBack }: { onBack: () => void }) {
  const firstChar = ALL_CHARACTERS.find((c) => !c.pending)!;
  const [charId, setCharId] = useState(firstChar.id);
  const [cards, setCards] = useState<string[]>(() => presetDeck(firstChar.id));
  const [name, setName] = useState(`${firstChar.id}（預設）`);
  const [deckId, setDeckId] = useState<string | null>(`preset:${firstChar.id}`);
  const [version, setVersion] = useState(0);
  const [msg, setMsg] = useState('');
  const [inspect, setInspect] = useState<string | null>(null);
  const [kind, setKind] = useState<'all' | CardKind>('all');
  const [combo, setCombo] = useState(0);
  const [scope, setScope] = useState<'all' | 'class' | 'common'>('all');
  const [query, setQuery] = useState('');
  const [io, setIo] = useState<null | 'export' | 'import'>(null);
  const [ioText, setIoText] = useState('');

  const char = getCharacter(charId);
  const saved = useMemo(() => listDecks().filter((d) => d.charId === charId), [charId, version]);
  const current = saved.find((d) => d.id === deckId);
  const check = validateDeck(charId, cards);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const id of cards) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [cards]);

  const pool = useMemo(() => {
    const q = query.trim();
    return PLAYABLE_CARDS.filter((c) => c.cls === '共用' || c.cls === char.cls)
      .filter((c) => kind === 'all' || c.kind === kind)
      .filter((c) => combo === 0 || (c.kind === 'move' && c.combo === combo))
      .filter((c) => scope === 'all' || (scope === 'common' ? c.cls === '共用' : c.cls !== '共用'))
      .filter((c) => !q || c.name.includes(q) || c.text.includes(q) || c.traits.some((t) => t.includes(q)))
      .sort(byOrder);
  }, [char.cls, kind, combo, scope, query]);

  // 目前開放的卡裡沒有的類型／專用卡，就不顯示對應的篩選選項
  const kindsAvailable = useMemo(
    () => new Set(PLAYABLE_CARDS.filter((c) => c.cls === '共用' || c.cls === char.cls).map((c) => c.kind)),
    [char.cls],
  );
  const hasClassCards = useMemo(() => PLAYABLE_CARDS.some((c) => c.cls === char.cls), [char.cls]);
  // 舊存檔的牌組可能含已停用的效果卡
  const disabledInDeck = useMemo(
    () => [...new Set(cards.filter((id) => !isCardEnabled(getCard(id))))],
    [cards],
  );

  const deckLines = useMemo(
    () => [...counts.keys()].map(getCard).sort(byOrder),
    [counts],
  );
  const curve = useMemo(() => {
    const arr = Array(9).fill(0) as number[];
    for (const id of cards) {
      const c = getCard(id);
      if (c.kind === 'move') arr[c.combo - 1]++;
    }
    return arr;
  }, [cards]);
  const maxCurve = Math.max(1, ...curve);

  const add = (id: string) => {
    if ((counts.get(id) ?? 0) >= MAX_COPIES) return;
    setCards((cur) => [...cur, id]);
  };
  const remove = (id: string) => {
    setCards((cur) => {
      const i = cur.lastIndexOf(id);
      return i < 0 ? cur : [...cur.slice(0, i), ...cur.slice(i + 1)];
    });
  };

  const load = (d: DeckEntry) => {
    setCharId(d.charId);
    setCards([...d.cards]);
    setName(d.preset ? `${d.charId}（我的牌組）` : d.name);
    setDeckId(d.id);
    setMsg('');
  };
  const changeChar = (id: string) => {
    const ch = getCharacter(id);
    if (ch.pending) return;
    setCharId(id);
    setCards(presetDeck(id));
    setName(`${id}（預設）`);
    setDeckId(`preset:${id}`);
    setMsg('');
  };
  const save = (asNew: boolean) => {
    const entry = saveDeck({ id: asNew ? undefined : current && !current.preset ? current.id : undefined, name, charId, cards });
    setDeckId(entry.id);
    setName(entry.name);
    setVersion((n) => n + 1);
    setMsg(check.ok ? `已儲存「${entry.name}」` : `已儲存「${entry.name}」（目前不合法，無法用來對戰）`);
  };
  const remove_ = () => {
    if (!current || current.preset) return;
    if (!window.confirm(`確定刪除「${current.name}」？`)) return;
    deleteDeck(current.id);
    setVersion((n) => n + 1);
    changeChar(charId);
    setMsg('已刪除');
  };
  const doImport = () => {
    const r = importDeck(ioText);
    if (!r.ok) {
      setMsg(r.error);
      return;
    }
    setCharId(r.deck.charId);
    setCards(r.deck.cards);
    setName(r.deck.name);
    setDeckId(null);
    setIo(null);
    setMsg('已匯入（尚未儲存）');
  };

  return (
    <InspectContext.Provider value={setInspect}>
      <div className="page">
        <div className="row" style={{ marginBottom: 10 }}>
          <button onClick={onBack}>← 返回</button>
          <h2 style={{ margin: 0 }}>組牌</h2>
          <span className="spacer" />
          <span className="charbtns row">
            {ALL_CHARACTERS.map((c) => (
              <button key={c.id} className={c.id === charId ? 'on' : ''} disabled={c.pending} onClick={() => changeChar(c.id)}
                title={c.pending ? '資料尚未補齊' : `${c.cls}｜${c.text}`}>
                {c.pending ? `${c.cls}（待補）` : c.name}
              </button>
            ))}
          </span>
        </div>

        <div className="builder">
          <div className="panel">
            <div className="row" style={{ marginBottom: 10 }}>
              {kindsAvailable.size > 1 && (
                <select value={kind} onChange={(e) => setKind(e.target.value as 'all' | CardKind)}>
                  <option value="all">全部類型</option>
                  {kindsAvailable.has('move') && <option value="move">招式</option>}
                  {kindsAvailable.has('equip') && <option value="equip">裝備</option>}
                  {kindsAvailable.has('buff') && <option value="buff">增益</option>}
                </select>
              )}
              <select value={combo} onChange={(e) => setCombo(Number(e.target.value))}>
                <option value={0}>全部連擊值</option>
                {Array.from({ length: 9 }, (_, i) => <option key={i + 1} value={i + 1}>連擊值 {i + 1}</option>)}
              </select>
              {hasClassCards && (
                <select value={scope} onChange={(e) => setScope(e.target.value as 'all' | 'class' | 'common')}>
                  <option value="all">專用＋共用</option>
                  <option value="class">只看{char.cls}專用</option>
                  <option value="common">只看共用</option>
                </select>
              )}
              <input placeholder="搜尋名稱／效果／特徵" value={query} onChange={(e) => setQuery(e.target.value)} />
              <span className="muted">{pool.length} 張（點卡片加入牌組）</span>
            </div>
            <div className="pool">
              {pool.map((c) => {
                const n = counts.get(c.id) ?? 0;
                return (
                  <div className="poolitem" key={c.id}>
                    <CardFace id={c.id} size="md" badge={n || undefined} dim={n >= MAX_COPIES} onClick={() => add(c.id)} />
                    <div className="ctl">
                      <button disabled={n === 0} onClick={() => remove(c.id)}>−</button>
                      <span>{n}/{MAX_COPIES}</span>
                      <button disabled={n >= MAX_COPIES} onClick={() => add(c.id)}>＋</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="deckcol">
            <InspectPanel id={inspect} />
            <div className="panel">
              <div className="row" style={{ marginBottom: 8 }}>
                <select value={deckId ?? ''} onChange={(e) => { const d = saved.find((x) => x.id === e.target.value); if (d) load(d); }}>
                  {deckId === null && <option value="">（未儲存的牌組）</option>}
                  {saved.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <button onClick={() => load({ id: `preset:${charId}`, name: '', charId, cards: presetDeck(charId), preset: true })}>載入預設</button>
                <button onClick={() => { setCards([]); setName('新牌組'); setDeckId(null); }}>清空</button>
              </div>
              <div className="row" style={{ marginBottom: 8 }}>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="牌組名稱" style={{ flex: 1 }} />
              </div>
              <div className="row" style={{ marginBottom: 8 }}>
                <button className="primary" onClick={() => save(false)}>儲存</button>
                <button onClick={() => save(true)}>另存新檔</button>
                <button className="danger" disabled={!current || current.preset} onClick={remove_}>刪除</button>
                <span className="spacer" />
                <button onClick={() => { setIoText(exportDeck({ name, charId, cards })); setIo('export'); }}>匯出</button>
                <button onClick={() => { setIoText(''); setIo('import'); }}>匯入</button>
              </div>

              <div className="row" style={{ marginBottom: 6 }}>
                <b style={{ fontSize: 18 }} className={check.ok ? 'ok' : ''}>{cards.length} / {char.hp}</b>
                <span className="muted">張（＝生命值）</span>
                {check.ok ? <span className="ok">✔ 可用於對戰</span> : <span style={{ color: 'var(--bad)' }}>不可用於對戰</span>}
              </div>
              {!check.ok && <div className="errors">{check.errors.map((e) => <div key={e}>・{e}</div>)}</div>}
              {disabledInDeck.length > 0 && (
                <div className="row" style={{ marginTop: 6 }}>
                  <span className="muted">含 {disabledInDeck.length} 種已停用的效果卡</span>
                  <button onClick={() => setCards((cur) => cur.filter((id) => !disabledInDeck.includes(id)))}>移除停用的卡</button>
                </div>
              )}
              {msg && <div className="muted" style={{ marginTop: 4 }}>{msg}</div>}

              <div className="zonelabel" style={{ marginTop: 10 }}>連擊值分佈（招式）</div>
              <div className="curve" style={{ marginBottom: 4 }}>
                {curve.map((n, i) => (
                  <div className="curvecol" key={i}>
                    <div className="bar" style={{ height: `${(n / maxCurve) * 100}%` }}><span>{n || ''}</span></div>
                  </div>
                ))}
              </div>
              <div className="curve" style={{ height: 'auto', alignItems: 'flex-start' }}>
                {curve.map((_, i) => <div className="lbl" style={{ flex: 1 }} key={i}>{i + 1}</div>)}
              </div>
            </div>

            <div className="panel">
              <div className="decklist">
                {deckLines.map((c) => (
                  <div className="deckline" key={c.id} onMouseEnter={() => setInspect(c.id)}>
                    <span className="cb">{c.kind === 'move' ? c.combo : c.kind === 'equip' ? '裝' : '增'}</span>
                    <span className="nm" title={c.text}>{c.name}</span>
                    <span className="muted">{c.cls}</span>
                    <button onClick={() => remove(c.id)}>−</button>
                    <b>{counts.get(c.id)}</b>
                    <button disabled={(counts.get(c.id) ?? 0) >= MAX_COPIES} onClick={() => add(c.id)}>＋</button>
                  </div>
                ))}
                {deckLines.length === 0 && <span className="muted">（牌組是空的，從左邊點卡片加入）</span>}
              </div>
            </div>
          </div>
        </div>

        {io && (
          <Modal onClose={() => setIo(null)}>
            <h3>{io === 'export' ? '匯出牌組（複製下面的文字）' : '匯入牌組（貼上 JSON）'}</h3>
            <textarea
              style={{ width: 460, height: 240 }}
              value={ioText}
              readOnly={io === 'export'}
              onChange={(e) => setIoText(e.target.value)}
              onFocus={(e) => io === 'export' && e.currentTarget.select()}
            />
            <div className="row" style={{ marginTop: 10 }}>
              {io === 'import' && <button className="primary" onClick={doImport}>匯入</button>}
              <button onClick={() => setIo(null)}>關閉</button>
              {msg && io === 'import' && <span style={{ color: 'var(--bad)' }}>{msg}</span>}
            </div>
          </Modal>
        )}
      </div>
    </InspectContext.Provider>
  );
}
