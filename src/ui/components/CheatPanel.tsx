import { useMemo, useRef, useState } from 'react';
import { CHEAT_POOL, CHEAT_ZONES, CHEAT_ZONE_LABEL as ZONE_LABEL, type CheatZone } from '../../engine/cheat';
import type { CardView } from '../../engine/view';
import type { PlayerId } from '../../engine/types';
import { getCard } from '../../data/cards';
import type { ClassName } from '../../data/types';
import type { CheatApi } from '../../net/session';
import { CardFace } from './CardFace';

type Tab = 'add' | 'remove' | 'zones';

const TABS: [Tab, string][] = [['add', '加入手牌'], ['remove', '移除手牌'], ['zones', '牌堆順序']];
const CLASSES: ClassName[] = ['共用', '劍士', '盜賊', '商人', '弓箭手', '法師'];
/** 每個牌區第一張卡的位置 */
const ZONE_HINT: Record<CheatZone, string> = {
  deck: '最左邊是牌組最上方（下一張抽的牌）',
  rage: '最左邊是怒氣區最上方（回復與費用先動這張）',
  discard: '最左邊是棄牌區最先放入的牌，最右邊是最上面',
  exp: '最左邊是經驗區最前方（蓋X 從這裡開始蓋表側卡）',
};

/**
 * 作弊面板：從全卡池挑卡加入手牌、移除手牌、檢視雙方牌區並拖曳調整順序。
 * locked（動畫播放中）時不能操作；被引擎拒絕的操作會顯示原因。
 */
export function CheatPanel({ cheat, me, snapshotKey, locked, onClose }: {
  cheat: CheatApi;
  me: PlayerId;
  /** 桌面每次變動就換一個值，面板據此重新讀取檢視 */
  snapshotKey: unknown;
  locked: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>('add');
  const [target, setTarget] = useState<PlayerId>(me);
  const [zone, setZone] = useState<CheatZone>('deck');
  const [query, setQuery] = useState('');
  const [cls, setCls] = useState<ClassName | ''>('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  // 動畫播放期間桌面停在播放中的影格，面板也停在鎖定前的內容，兩邊才對得上
  const live = useMemo(() => cheat.snapshot(), [cheat, snapshotKey]);
  const frozen = useRef(live);
  if (!locked) frozen.current = live;
  const snap = locked ? frozen.current : live;
  const opp: PlayerId = me === 0 ? 1 : 0;
  const side = (p: PlayerId) => (p === me ? '我方' : '對手');

  const run = (err: string | null, ok: string) => setMsg(err ? { ok: false, text: err } : { ok: true, text: ok });

  const pool = CHEAT_POOL.filter((c) => (!cls || c.cls === cls) && (!query.trim() || c.name.includes(query.trim())));
  const hand = snap[target].hand;
  const cards: CardView[] = snap[target][zone];

  const moveCard = (from: number, to: number) => {
    if (locked || from === to || to < 0 || to >= cards.length) return;
    const uids = cards.map((c) => c.uid);
    const [u] = uids.splice(from, 1);
    uids.splice(to, 0, u);
    run(cheat.reorder(target, zone, uids), `已調整${side(target)}的${ZONE_LABEL[zone]}順序`);
  };

  return (
    <div className="cheatpanel" role="dialog" aria-label="作弊面板">
      <div className="cheathead">
        <b>作弊面板</b>
        <div className="cheattabs" role="tablist">
          {TABS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setMsg(null); }}>{label}</button>
          ))}
        </div>
        <div className="cheattarget" role="group" aria-label="操作對象">
          {([me, opp] as PlayerId[]).map((p) => (
            <button key={p} className={target === p ? 'on' : ''} aria-pressed={target === p} onClick={() => setTarget(p)}>{side(p)}</button>
          ))}
        </div>
        <span className="spacer" />
        <button onClick={onClose}>關閉</button>
      </div>
      {locked && <div className="cheatnote">動畫播放中，暫時不能操作（可以按下方的「跳過動畫」）</div>}
      {msg && <div className={`cheatnote ${msg.ok ? 'ok' : 'bad'}`} role="status">{msg.text}</div>}

      {tab === 'add' && (
        <>
          <div className="cheatfilter">
            <input placeholder="搜尋卡名" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="搜尋卡名" />
            <select value={cls} onChange={(e) => setCls(e.target.value as ClassName | '')} aria-label="職業篩選">
              <option value="">全部職業</option>
              {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <span className="muted">點一張卡加入{side(target)}的手牌（共 {pool.length} 張，含未開放的卡）</span>
          </div>
          <div className="cheatgrid">
            {pool.map((c) => (
              <CardFace key={c.id} id={c.id} size="sm" onClick={locked ? undefined : () => run(cheat.add(target, c.id), `已將【${c.name}】加入${side(target)}的手牌`)} />
            ))}
            {pool.length === 0 && <span className="muted">沒有符合的卡</span>}
          </div>
        </>
      )}

      {tab === 'remove' && (
        <>
          <div className="cheatfilter"><span className="muted">點一張手牌把它移出遊戲（{side(target)}的手牌 {hand.length} 張）</span></div>
          <div className="cheatgrid">
            {hand.map((c) => (
              <CardFace key={c.uid} id={c.id} size="sm" onClick={locked ? undefined : () => run(cheat.remove(target, c.uid), `已將【${getCard(c.id!).name}】移出遊戲`)} />
            ))}
            {hand.length === 0 && <span className="muted">（沒有手牌）</span>}
          </div>
        </>
      )}

      {tab === 'zones' && (
        <>
          <div className="cheatfilter">
            <div className="cheattabs" role="group" aria-label="牌區">
              {CHEAT_ZONES.map((z) => (
                <button key={z} className={zone === z ? 'on' : ''} aria-pressed={zone === z} onClick={() => setZone(z)}>{ZONE_LABEL[z]}（{snap[target][z].length}）</button>
              ))}
            </div>
            <span className="muted">{ZONE_HINT[zone]}；拖曳或按 ◀ ▶ 調整</span>
          </div>
          <div className="cheatgrid">
            {cards.map((c, i) => (
              <div
                key={c.uid}
                className={`cheatcell${dragFrom === i ? ' dragging' : ''}`}
                draggable={!locked}
                onDragStart={(e) => { setDragFrom(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); }}
                onDragOver={(e) => { if (dragFrom !== null) e.preventDefault(); }}
                onDrop={(e) => { e.preventDefault(); if (dragFrom !== null) moveCard(dragFrom, i); setDragFrom(null); }}
                onDragEnd={() => setDragFrom(null)}
              >
                <CardFace id={c.id} size="sm" covered={zone === 'exp' && c.covered} />
                <div className="cheatmove">
                  <button aria-label="往左移" disabled={locked || i === 0} onClick={() => moveCard(i, i - 1)}>◀</button>
                  <span className="muted">{i + 1}</span>
                  <button aria-label="往右移" disabled={locked || i === cards.length - 1} onClick={() => moveCard(i, i + 1)}>▶</button>
                </div>
              </div>
            ))}
            {cards.length === 0 && <span className="muted">（空）</span>}
          </div>
        </>
      )}
    </div>
  );
}
