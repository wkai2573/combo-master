import { useEffect, useMemo, useRef, useState } from 'react';
import { CHEAT_POOL, CHEAT_ZONES, CHEAT_ZONE_LABEL as ZONE_LABEL, type CheatZone } from '../../engine/cheat';
import type { CardView } from '../../engine/view';
import type { PlayerId } from '../../engine/types';
import { getCard } from '../../data/cards';
import type { CardData, ClassName } from '../../data/types';
import type { CheatApi } from '../../net/session';
import { CardFace } from './CardFace';
import { SortableList } from './SortableList';

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

/** 全卡池的搜尋與挑選：點一張卡就交給 onPick */
function CardPool({ hint, locked, onPick }: { hint: (count: number) => string; locked: boolean; onPick: (c: CardData) => void }) {
  const [query, setQuery] = useState('');
  const [cls, setCls] = useState<ClassName | ''>('');
  const pool = CHEAT_POOL.filter((c) => (!cls || c.cls === cls) && (!query.trim() || c.name.includes(query.trim())));
  return (
    <>
      <div className="cheatfilter">
        <input placeholder="搜尋卡名" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="搜尋卡名" />
        <select value={cls} onChange={(e) => setCls(e.target.value as ClassName | '')} aria-label="職業篩選">
          <option value="">全部職業</option>
          {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="muted">{hint(pool.length)}</span>
      </div>
      <div className="cheatgrid">
        {pool.map((c) => (
          <CardFace key={c.id} id={c.id} size="sm" onClick={locked ? undefined : () => onPick(c)} />
        ))}
        {pool.length === 0 && <span className="muted">沒有符合的卡</span>}
      </div>
    </>
  );
}

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
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [picking, setPicking] = useState(false);
  // 刪除與翻面先照結果顯示：失敗時馬上退回，成功時等檢視跟上了再拿掉（鎖定中檢視停著，不能提早退回）
  const [gone, setGone] = useState<ReadonlySet<number>>(new Set());
  const [flipped, setFlipped] = useState<ReadonlyMap<number, boolean>>(new Map());

  // 動畫播放期間桌面停在播放中的影格，面板也停在鎖定前的內容，兩邊才對得上
  const live = useMemo(() => cheat.snapshot(), [cheat, snapshotKey]);
  const frozen = useRef(live);
  if (!locked) frozen.current = live;
  const snap = locked ? frozen.current : live;
  useEffect(() => {
    if (!snap) return;
    const seen = new Map<number, CardView>();
    for (const p of snap) for (const z of CHEAT_ZONES) for (const c of p[z]) seen.set(c.uid, c);
    setGone((s) => (s.size === 0 || [...s].every((u) => seen.has(u)) ? s : new Set([...s].filter((u) => seen.has(u)))));
    setFlipped((m) => {
      const keep = [...m].filter(([u, covered]) => seen.get(u) !== undefined && seen.get(u)!.covered !== covered);
      return keep.length === m.size ? m : new Map(keep);
    });
  }, [snap]);
  // 訪客剛開啟作弊時，房主的檢視還在路上
  if (!snap) {
    return (
      <div className="cheatpanel" role="dialog" aria-label="作弊面板">
        <div className="cheathead"><b>作弊面板</b><span className="muted">讀取中…</span><span className="spacer" /><button onClick={onClose}>關閉</button></div>
      </div>
    );
  }
  const opp: PlayerId = me === 0 ? 1 : 0;
  const side = (p: PlayerId) => (p === me ? '我方' : '對手');

  // 操作的結果（訪客要等房主回覆）：被拒絕時顯示原因
  const run = (result: Promise<string | null>, ok: string, undo?: () => void): Promise<void> =>
    result.then((err) => {
      if (err) undo?.();
      setMsg(err ? { ok: false, text: err } : { ok: true, text: ok });
    });

  const hand = snap[target].hand;
  const cards: CardView[] = snap[target][zone]
    .filter((c) => !gone.has(c.uid))
    .map((c) => (flipped.has(c.uid) ? { ...c, covered: flipped.get(c.uid)! } : c));

  const reorder = (keys: string[]) =>
    run(cheat.reorder(target, zone, keys.map(Number)), `已調整${side(target)}的${ZONE_LABEL[zone]}順序`);
  const deleteCard = (c: CardView) => {
    setGone((s) => new Set(s).add(c.uid));
    run(cheat.deleteCard(target, zone, c.uid), `已將【${getCard(c.id!).name}】移出遊戲`, () =>
      setGone((s) => new Set([...s].filter((u) => u !== c.uid))));
  };
  const flip = (c: CardView) => {
    setFlipped((m) => new Map(m).set(c.uid, !c.covered));
    run(cheat.flip(target, c.uid), `已將【${getCard(c.id!).name}】翻成${c.covered ? '表側' : '裏側'}`, () =>
      setFlipped((m) => new Map([...m].filter(([u]) => u !== c.uid))));
  };
  const insertCard = (c: CardData) => {
    setPicking(false);
    run(cheat.insert(target, zone, c.id), `已將【${c.name}】加到${side(target)}的${ZONE_LABEL[zone]}最前面`);
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
        <CardPool
          locked={locked}
          hint={(n) => `點一張卡加入${side(target)}的手牌（共 ${n} 張，含未開放的卡）`}
          onPick={(c) => run(cheat.add(target, c.id), `已將【${c.name}】加入${side(target)}的手牌`)}
        />
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
            <span className="muted">{ZONE_HINT[zone]}；拖曳調整順序</span>
          </div>
          <SortableList
            key={`${target}-${zone}`}
            className="cheatgrid"
            items={cards}
            getKey={(c) => String(c.uid)}
            disabled={locked}
            onReorder={reorder}
            prefix={
              <button className="cheatadd" disabled={locked} onClick={() => setPicking(true)} aria-label={`新增卡片到${ZONE_LABEL[zone]}最前面`}>
                <span>＋</span>
                <span className="muted">新增</span>
              </button>
            }
            empty={<span className="muted">（空）</span>}
            renderItem={(c) => (
              <div className="cheatcard">
                <CardFace id={c.id} size="sm" covered={zone === 'exp' && c.covered} />
                <button className="cheatx" data-nodrag disabled={locked} aria-label="刪除這張卡" title="刪除（移出遊戲）" onClick={() => deleteCard(c)}>×</button>
                {zone === 'exp' && (
                  <button className="cheatflip" data-nodrag disabled={locked} aria-label={c.covered ? '翻成表側' : '翻成裏側'} title={c.covered ? '翻成表側' : '翻成裏側'} onClick={() => flip(c)}>⇄</button>
                )}
              </div>
            )}
          />
        </>
      )}

      {picking && (
        <div className="cheatpicker" role="dialog" aria-label="選擇要新增的卡" onClick={() => setPicking(false)}>
          <div className="cheatpickbox" onClick={(e) => e.stopPropagation()}>
            <div className="cheathead"><b>新增到{side(target)}的{ZONE_LABEL[zone]}最前面</b><span className="spacer" /><button onClick={() => setPicking(false)}>取消</button></div>
            <CardPool locked={locked} hint={(n) => `點一張卡加入（共 ${n} 張，含未開放的卡）`} onPick={insertCard} />
          </div>
        </div>
      )}
    </div>
  );
}
