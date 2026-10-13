import { KeywordText } from './KeywordText';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { expLayout } from '../expLayout';
import { handLayout } from '../handLayout';
import { useWide } from '../useWide';
import { useCoarsePointer } from '../layoutMode';
import type { DragApi } from '../useCardDrag';
import { tapCard } from '../touchTap';
import { getCard, getCharacter } from '../../data/cards';
import { combatCards, expCounts, type CardView, type GameView, type PlayerView } from '../../engine/view';
import type { StatChanges } from '../../engine/stats';
import type { DropZone, FrameFx, PlayerId, Request } from '../../engine/types';
import type { StepHint } from '../../data/turnSteps';
import { CardFace, expEffectActive } from './CardFace';
import { Delta } from './Delta';

export type ZoneKey = 'discard' | 'exp' | 'combat';

/** 戰鬥區列表底下的備註：招式在前、追擊卡在後，[頂] 指的是最後一張招式（追擊卡不算） */
export const COMBAT_LIST_NOTE = '招式在前、追擊卡在後（白色內線）；最後一張招式是 [頂] 所指的招式';

interface BoardProps {
  v: GameView;
  p: PlayerId;
  prompt: Request | null;
  selected: string[];
  onPick: (key: string) => void;
  /** anchor 是被點的區域在畫面上的位置，展開面板貼著它出現 */
  onZone: (p: PlayerId, z: ZoneKey, anchor: DOMRect) => void;
  /** 手牌拖曳使用（只有我方的面板用得到） */
  drag?: DragApi;
  /** 這位玩家剛受到傷害：震動並浮出傷害數字（key 變動時重播） */
  hit?: { amount: number; key: number; /** 第一張牌落進怒氣區要等多久（毫秒） */ delay: number };
  /** 這個影格與上一個顯示的桌面之間的數值變化（key 變動時重播） */
  changes?: StatChanges;
  fxKey: number;
  /** 勝負確定後：勝方發光、敗方變灰 */
  outcome?: 'win' | 'lose' | 'draw';
  /** 開局洗牌：牌組堆抖動 */
  shuffling?: boolean;
}

/** 牌堆：牌組、怒氣區、棄牌區。飛行圖層以 data-pile 找到它在畫面上的位置 */
export function Pile({ p, zone, label, count, top, delta, k, shuffling, countText, dropZone, onClick }: {
  p: PlayerId; zone: 'deck' | 'discard' | 'rage' | 'exp' | 'gear'; label: string; count: number; top?: CardView; delta?: number; k?: number; shuffling?: boolean;
  /** 標籤下方的數字文字，不給就是張數（經驗堆寫「表 N／共 M」） */
  countText?: string;
  /** 拖曳使用時，這個牌堆是哪種放置區 */
  dropZone?: DropZone;
  onClick?: (anchor: DOMRect) => void;
}) {
  const depth = Math.min(count, 6);
  const edge = Array.from({ length: depth }, (_, i) => `calc(${i + 1} * var(--pile-step, 2px)) calc(${i + 1} * var(--pile-step, 2px)) 0 var(--pile-edge)`).join(', ');
  return (
    <div className={`pile ${zone}${onClick ? ' click' : ''}`} data-dropzone={dropZone} onClick={onClick && ((e) => onClick(e.currentTarget.getBoundingClientRect()))}>
      <div className={`pilestack${shuffling ? ' shuffling' : ''}`} data-pile={`${p}-${zone}`} style={{ boxShadow: edge || undefined }}>
        {count === 0 ? (
          <div className="card sm slot">空</div>
        ) : top?.id ? (
          <CardFace id={top.id} size="sm" covered={top.covered} inert />
        ) : (
          <CardFace id={null} size="sm" inert />
        )}
      </div>
      <div className="pilelabel"><span>{label}</span> <b>{countText ?? count}</b><Delta d={delta} k={k ?? 0} tone="neutral" /></div>
    </div>
  );
}

/** 經驗區：高度固定。一列放得下是完整小卡，放不下分兩列矮卡，再放不下就水平重疊；滑過矮卡會展開成完整小卡 */
function ExpZone({ cards, optKeys, selected, onPick }: { cards: CardView[]; optKeys: Set<string>; selected: string[]; onPick: (key: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  // 繪製前就量好寬度，第一幀就是對的版面
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const layout = expLayout(cards.length, width);
  const short = layout.mode !== 'one';
  // 觸控沒有滑過：點矮卡先展開成完整小卡，同一張再點一下才送出（不是選項的卡再點就收起）
  const coarse = useCoarsePointer();
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (open !== null && !cards.some((c) => c.uid === open)) setOpen(null);
  }, [cards, open]);
  const optSig = [...optKeys].join(',');
  useEffect(() => setOpen(null), [optSig]);
  const tapShort = (c: CardView) => () => {
    const r = tapCard(open, c.uid, optKeys.has(`c${c.uid}`));
    setOpen(r.preview);
    if (r.submit) onPick(`c${c.uid}`);
  };
  return (
    <div
      ref={ref} className={`expcards ${layout.mode}`}
      style={short ? { ['--step' as string]: `${layout.step}px`, ['--cols' as string]: layout.cols } : undefined}
    >
      {cards.map((c, i) => (
        <div key={c.uid} className={`expslot${short ? (i < layout.firstRow ? ' r1' : ' r2') : ''}${open === c.uid ? ' open' : ''}`}>
          <CardFace
            uid={c.uid} id={c.id} size="sm" short={short} expEffect={expEffectActive(c)} covered={c.covered}
            glow={optKeys.has(`c${c.uid}`)} selected={selected.includes(`c${c.uid}`)}
            onClick={coarse && short ? tapShort(c) : optKeys.has(`c${c.uid}`) ? () => onPick(`c${c.uid}`) : undefined}
          />
        </div>
      ))}
      {cards.length === 0 && <span className="muted">（空）</span>}
    </div>
  );
}

/**
 * 手牌：沒有張數上限。放得下就並排，放不下就水平重疊（我方每張至少露出 minStep 像素），滑過浮出完整卡。
 * 觸控裝置沒有滑過：點一下先選取並在上方預覽，同一張再點一下才送出。我方的牌可以拖到放置區使用
 */
export function HandRow({ cards, mine, optKeys, selected, single, minStep, drag, onPick }: {
  cards: CardView[]; mine: boolean; optKeys: Set<string>; selected: string[];
  /** 提示是必選 1 個：點選就送出（觸控則是第二下） */
  single: boolean;
  minStep?: number;
  drag?: DragApi;
  onPick: (key: string) => void;
}) {
  const coarse = useCoarsePointer() && mine;
  const [preview, setPreview] = useState<number | null>(null);
  // 提示換了（選項不同）就收起預覽
  const optSig = [...optKeys].join(',');
  useEffect(() => setPreview(null), [optSig]);
  useEffect(() => {
    if (preview !== null && !cards.some((c) => c.uid === preview)) setPreview(null);
  }, [cards, preview]);
  const ref = useRef<HTMLDivElement>(null);
  // 預覽固定在手牌列正上方（頁面捲動、手牌列在畫面邊緣時也不會被裁掉），高度依上方剩下的空間縮小
  const [pvBox, setPvBox] = useState<{ bottom: number; h: number } | null>(null);
  useLayoutEffect(() => {
    if (preview === null || !ref.current) return;
    const top = ref.current.getBoundingClientRect().top;
    setPvBox({ bottom: window.innerHeight - top + 4, h: Math.max(120, Math.min(230, top - 70)) });
    // 視窗大小改變（轉向）後位置作廢，直接收起
    const close = () => setPreview(null);
    window.addEventListener('resize', close);
    return () => window.removeEventListener('resize', close);
  }, [preview]);
  const [m, setM] = useState({ width: 0, cardW: 0 });
  // 繪製前就量好寬度與卡寬，第一幀就是對的版面；卡寬會隨版面尺寸變化，所以一併觀察第一張牌
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>('.card');
    const read = () => setM((o) => {
      const cs = getComputedStyle(el);
      const width = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const cardW = el.querySelector<HTMLElement>('.card')?.offsetWidth ?? 0;
      return o.width === width && o.cardW === cardW ? o : { width, cardW };
    });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    if (first) ro.observe(first);
    return () => ro.disconnect();
  }, [cards[0]?.uid]);
  const layout = handLayout(cards.length, m.width, m.cardW, minStep ?? (mine ? 36 : 24));
  const tap = (c: CardView) => {
    const key = `c${c.uid}`;
    const canPick = optKeys.has(key);
    if (!single && canPick) {
      // 多選：點一下就切換選取（確定鍵在提示欄），選取時順便預覽，取消時收起
      setPreview(selected.includes(key) ? null : c.uid);
      return onPick(key);
    }
    const r = tapCard(preview, c.uid, canPick);
    setPreview(r.preview);
    if (r.submit) onPick(key);
  };
  const shown = preview === null ? null : cards.find((c) => c.uid === preview);
  return (
    <div className="handwrap">
      {coarse && shown?.id && (
        <div
          className="handpreview" onClick={() => setPreview(null)}
          style={pvBox ? { bottom: pvBox.bottom, ['--ph' as string]: `${pvBox.h}px`, ['--pw' as string]: `${Math.round(pvBox.h * 0.73)}px`, ['--pf' as string]: `${(pvBox.h / 230) * 13}px` } : undefined}
        >
          <CardFace id={shown.id} size="md" />
          <div className="previewhint">{!optKeys.has(`c${shown.uid}`) ? '這張現在不能使用' : single ? '再點一下手牌送出' : '已選取，按確定送出'}</div>
        </div>
      )}
      <div
        ref={ref} className={`handrow${layout.overlap ? ' overlap' : ''}`}
        style={layout.overlap ? { ['--hstep' as string]: `${Math.floor(layout.step)}px` } : undefined}
      >
        {cards.map((c) => {
          const key = `c${c.uid}`;
          const canDrag = mine && !!drag?.zoneFor(key);
          return (
            <div
              key={c.uid} className={`handslot${canDrag ? ' draggable' : ''}${drag?.draggingKey === key ? ' dragging' : ''}`}
              onPointerDown={canDrag ? (e) => drag!.start(e, key, c.id) : undefined}
            >
              <CardFace
                uid={c.uid} id={mine ? c.id : null} size={mine ? 'md' : 'sm'}
                glow={mine && optKeys.has(key)} selected={mine && (selected.includes(key) || preview === c.uid)}
                onClick={
                  !mine ? undefined
                    : coarse ? () => tap(c)
                    : optKeys.has(key) ? () => onPick(key) : undefined
                }
              />
            </div>
          );
        })}
        {cards.length === 0 && <span className="muted">（空）</span>}
      </div>
    </div>
  );
}

export function PlayerBoard({ v, p, prompt, selected, onPick, onZone, drag, hit, changes, fxKey, outcome, shuffling }: BoardProps) {
  const pv = v.players[p];
  const mine = p === v.me;
  const expRef = useRef<HTMLDivElement>(null);
  // 寬螢幕版的裝備／增益區是固定大小的槽位，卡牌用矮卡
  const wide = useWide();
  const ch = getCharacter(pv.charId);
  const awake = pv.exp.length >= ch.expReq;
  const { faceUp, total } = expCounts(pv);
  const optKeys = new Set(prompt?.options.map((o) => o.key) ?? []);
  const name = p === 0 ? '玩家A' : '玩家B';

  return (
    <div className={`pboard${v.first === p ? ' turn' : ''}${hit ? ' hit' : ''}${outcome ? ` ${outcome}` : ''}`} style={hit ? { ['--hit-delay' as string]: `${hit.delay}ms` } : undefined}>
      {hit && <span className="dmgpop" key={hit.key}>−{hit.amount}</span>}
      <div className="phead">
        <span className="charname" title={`${ch.text}\n覺醒：${ch.awakenText}`}>
          {ch.name}
        </span>
        <span className="muted">{name}{mine ? '（你）' : ''}・{ch.cls}</span>
        {v.first === p && <span className="pill awake">先攻</span>}
        {awake && <span className="pill awake">覺醒</span>}
        <span className={`pill hp${changes?.life[p] ? ' flash' : ''}`} key={`hp${fxKey}`} title="牌組張數就是生命值">生命 {pv.deckCount}<Delta d={changes?.life[p]} k={fxKey} /></span>
        <span className="pill">手牌 {pv.hand.length}</span>
        <span className={`pill click${changes?.exp[p] ? ' flash' : ''}`} key={`exp${fxKey}`} onClick={() => expRef.current && onZone(p, 'exp', expRef.current.getBoundingClientRect())}>
          經驗區 表 {faceUp}／共 {total}<Delta d={changes?.exp[p]} k={fxKey} tone="neutral" />
        </span>
        {pv.passed && <span className="pill">已收招</span>}
      </div>
      <div className="muted peffect" style={{ fontSize: 12 }}>
        效果：<KeywordText text={ch.text} />　<span style={{ color: awake ? 'var(--accent)' : undefined }}>覺醒（需 {ch.expReq} 張經驗）：<KeywordText text={ch.awakenText} /></span>
      </div>

      <div className={`gearzone${pv.gear.length + pv.buff.length === 0 ? ' empty' : ''}`} data-dropzone={mine ? 'gear' : undefined}>
        <div className="zonelabel">裝備／增益</div>
        <div className="cardrow">
          {pv.gear.map((c) => <CardFace key={c.uid} uid={c.uid} id={c.id} size="sm" short={wide} />)}
          {pv.buff.map((c) => <CardFace key={c.uid} uid={c.uid} id={c.id} size="sm" short={wide} counters={c.counters} counterDelta={changes?.buff[c.uid]} deltaKey={fxKey} />)}
        </div>
      </div>

      <div className="zonesrow">
        <div className="piles">
          <Pile p={p} zone="deck" label="牌組" count={pv.deckCount} shuffling={shuffling} />
          <Pile p={p} zone="rage" label="怒氣" count={pv.rage.length} delta={changes?.rage[p]} k={fxKey} />
          <Pile p={p} zone="discard" label="棄牌" count={pv.discard.length} top={pv.discard[pv.discard.length - 1]} onClick={(a) => onZone(p, 'discard', a)} />
        </div>
        <div className="expzone" ref={expRef} data-dropzone={mine ? 'exp' : undefined}>
          <div className="zonelabel">經驗區（左側為最前方）</div>
          <ExpZone cards={pv.exp} optKeys={optKeys} selected={selected} onPick={onPick} />
        </div>
      </div>

      <div className="handzone">
        <div className="zonelabel">手牌</div>
        <HandRow cards={pv.hand} mine={mine} optKeys={optKeys} selected={selected} single={prompt?.min === 1 && prompt?.max === 1} drag={mine ? drag : undefined} onPick={onPick} />
      </div>
    </div>
  );
}

function rangeText(v: GameView): string {
  const mine = v.players[v.me].moves;
  const opp = v.players[v.me === 0 ? 1 : 0].moves;
  if (mine.length === 0 || opp.length === 0) return '範圍：任意連擊值';
  const a = getCard(mine[mine.length - 1].id!).combo;
  const b = getCard(opp[opp.length - 1].id!).combo;
  return `範圍內：連擊值 ${Math.min(a, b)} ~ ${Math.max(a, b)}`;
}

const sumOf = (cards: CardView[], key: 'atk' | 'def') =>
  cards.reduce((n, c) => n + (c.id ? getCard(c.id)[key] : 0), 0);

/** 一方的戰鬥區：卡片往下疊（最新的在最下面且完整顯示），上面幾張只露出「攻／連擊／守」 */
/** 卡面合計與實際總攻防不同時的說明 */
function statNote(pv: PlayerView): string | null {
  const rawAtk = sumOf(pv.moves, 'atk') + sumOf(pv.pursuit, 'atk');
  const rawDef = sumOf(pv.moves, 'def');
  if (pv.atk === rawAtk && pv.def === rawDef) return null;
  const diff = (shown: number, raw: number) => (shown === raw ? '' : `（含效果 ${shown > raw ? '+' : ''}${shown - raw}）`);
  return `卡面合計 ${rawAtk} ／ ${rawDef}${diff(pv.atk, rawAtk)}`;
}

function StackColumn({ pv, label, mine, fx, delta, k, onOpen }: {
  pv: PlayerView; label: string; mine: boolean; fx?: FrameFx; delta?: { atk: number; def: number }; k: number;
  /** 點疊牌開這一方戰鬥區的列表（疊牌只露出上面一條，下方的牌靠列表檢查） */
  onOpen: (anchor: DOMRect) => void;
}) {
  const { cards } = combatCards(pv);
  return (
    <div className={`col ${mine ? 'mine' : 'opp'}`}>
      <h4>{label}</h4>
      <div
        className={`vstack${cards.length > 0 ? ' click' : ''}`} style={{ ['--n1' as string]: Math.max(cards.length - 1, 1) }}
        onClick={cards.length > 0 ? (e) => onOpen(e.currentTarget.getBoundingClientRect()) : undefined}
      >
        {cards.map((c, i) => (
          <CardFace
            key={c.uid} uid={c.uid} id={c.id} size="md" pursuit={i >= pv.moves.length}
            fresh={fx?.type === 'play' && fx.uid === c.uid} inert
          />
        ))}
        {cards.length === 0 && <span className="empty">（尚未出招）</span>}
      </div>
      <div className={`sumbox${fx?.type === 'calc' ? ' pulse' : ''}`}>
        <div>
          <span className="sumline">總攻 <b className="atk">{pv.atk}</b><Delta d={delta?.atk} k={k} /></span>
          <span className="sumslash"> ／ </span>
          <span className="sumline">總防 <b className="def">{pv.def}</b><Delta d={delta?.def} k={k} /></span>
        </div>
      </div>
    </div>
  );
}

/** 疊在某一方戰鬥區上的特效：收招（追擊判定改在中央放大播放） */
function ColumnFx({ fx, fxKey, player }: { fx?: FrameFx; fxKey: number; player: PlayerId }) {
  if (!fx || !('player' in fx) || fx.player !== player) return null;
  if (fx.type === 'pass') return <div className="resultpop pass" key={`p${fxKey}`}>收招</div>;
  return null;
}

/** 攻守拼招的一條算式：總攻、總防、傷害依序出現（from 為這條算式的第一項是全部的第幾項） */
function Equation({ who, atk, def, dmg, from }: { who: string; atk: number; def: number; dmg: number; from: number }) {
  const at = (i: number) => ({ ['--i' as string]: from + i });
  return (
    <div className="eq">
      <span className="who">{who}</span>
      <span className="st" style={at(0)}>攻 <b className="atk">{atk}</b></span>
      <span className="st" style={at(1)}>− 守 <b className="def">{def}</b></span>
      <span className="st" style={at(2)}>＝ <b className={`dm${dmg === 0 ? ' zero' : ''}`}>{dmg}</b></span>
    </div>
  );
}

export function CombatArea({ v, fx, caption, fxKey, changes, hint, onOpen }: {
  v: GameView; fx?: FrameFx; caption?: string; fxKey: number; changes?: StatChanges;
  /** 點某一方的疊牌：開那一方的戰鬥區列表 */
  onOpen: (p: PlayerId, anchor: DOMRect) => void;
  /** 回合步驟的規則提示：手機版面沒有步驟列，改放在戰鬥區中央 */
  hint?: StepHint | null;
}) {
  const opp: PlayerId = v.me === 0 ? 1 : 0;
  const calc = fx?.type === 'calc' ? fx : null;
  const notes = [['對方', statNote(v.players[opp])], ['我方', statNote(v.players[v.me])]].filter((n): n is [string, string] => n[1] !== null);
  const hasPursuit = v.players[opp].pursuit.length + v.players[v.me].pursuit.length > 0;
  return (
    <div className="combatarea" data-dropzone="moves">
      <div className="caption" key={`c${fxKey}`}>{caption ?? ' '}</div>
      <div className="cols">
        <div className="colwrap">
          <StackColumn pv={v.players[opp]} label="對方" mine={false} fx={fx} delta={changes && { atk: changes.atk[opp], def: changes.def[opp] }} k={fxKey} onOpen={(a) => onOpen(opp, a)} />
          <ColumnFx fx={fx} fxKey={fxKey} player={opp} />
        </div>
        <div className="mid">
          {hint && (
            <div className="stephint">
              <b>{hint.phase}</b>：{hint.hint}
              {hint.who && <span className="who">{hint.who}</span>}
            </div>
          )}
          {calc ? (
            <div className="calc" key={`calc${fxKey}`}>
              <Equation who="對方 → 我方" atk={calc.atk[opp]} def={calc.def[v.me]} dmg={calc.dmg[v.me]} from={0} />
              <Equation who="我方 → 對方" atk={calc.atk[v.me]} def={calc.def[opp]} dmg={calc.dmg[opp]} from={3} />
            </div>
          ) : (
            <>
              <div className="range">{rangeText(v)}</div>
              <div className="muted" style={{ fontSize: 12 }}>傷害 ＝ 對方總攻 − 我方總防</div>
              <div className="midnotes">
                {notes.map(([who, t]) => <div key={who}>{who}：{t}</div>)}
                {hasPursuit && <div>金框為追擊卡</div>}
              </div>
            </>
          )}
        </div>
        <div className="colwrap">
          <StackColumn pv={v.players[v.me]} label="我方" mine fx={fx} delta={changes && { atk: changes.atk[v.me], def: changes.def[v.me] }} k={fxKey} onOpen={(a) => onOpen(v.me, a)} />
          <ColumnFx fx={fx} fxKey={fxKey} player={v.me} />
        </div>
      </div>
    </div>
  );
}

export function LogPanel({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [lines.length]);
  return (
    <div className="log" ref={ref}>
      {lines.map((l, i) => (
        <div key={i} className={l.startsWith('──') ? 'sep' : l.includes('獲勝') ? 'win' : undefined}>{l}</div>
      ))}
    </div>
  );
}
