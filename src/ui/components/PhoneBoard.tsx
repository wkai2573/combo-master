import { useEffect, type ReactNode } from 'react';
import { getCharacter } from '../../data/cards';
import type { StatChanges } from '../../engine/stats';
import type { PlayerId, Request } from '../../engine/types';
import { combatCards, expCounts, pileTop, type CardView, type GameView, type PlayerView } from '../../engine/view';
import type { DragApi } from '../useCardDrag';
import type { Speed } from '../playback';
import { COMBAT_LIST_NOTE, HandRow, Pile } from './Board';
import { CardFace, expEffectActive, InspectPanel } from './CardFace';
import { Delta } from './Delta';
import { KeywordText } from './KeywordText';

/** 手機版面的全螢幕面板裡能看的內容：角色效果，或某個牌區的列表（怒氣區誰都看不到，不在其中） */
export type SheetTab = 'char' | 'exp' | 'gear' | 'discard' | 'combat';
export interface SheetTarget { p: PlayerId; tab: SheetTab }

const TAB_NAME: Record<SheetTab, string> = { char: '角色', exp: '經驗區', gear: '裝備增益區', discard: '棄牌區', combat: '戰鬥區' };

const tabCount = (pv: PlayerView, tab: SheetTab): number | null =>
  tab === 'exp' ? pv.exp.length : tab === 'gear' ? pv.gear.length + pv.buff.length : tab === 'discard' ? pv.discard.length : tab === 'combat' ? pv.moves.length + pv.pursuit.length : null;

/** 經驗牌堆下方的數字：表側幾張、總共幾張 */
const expCountText = (pv: PlayerView) => {
  const { faceUp, total } = expCounts(pv);
  return `表${faceUp}／共${total}`;
};

interface InfoProps {
  v: GameView;
  p: PlayerId;
  changes?: StatChanges;
  fxKey: number;
  hit?: { amount: number; key: number; delay: number };
  outcome?: 'win' | 'lose' | 'draw';
  onOpen: (t: SheetTarget) => void;
}

const boardClass = (v: GameView, p: PlayerId, hit: InfoProps['hit'], outcome: InfoProps['outcome']) =>
  `pboard${v.first === p ? ' turn' : ''}${hit ? ' hit' : ''}${outcome ? ` ${outcome}` : ''}`;

/** 角色名、先攻、生命、手牌數；我方與對手共用 */
function InfoLine({ v, p, changes, fxKey, onOpen }: Pick<InfoProps, 'v' | 'p' | 'changes' | 'fxKey' | 'onOpen'>) {
  const pv = v.players[p];
  const ch = getCharacter(pv.charId);
  const mine = p === v.me;
  const awake = pv.exp.length >= ch.expReq;
  return (
    <div className="infoline">
      <button className="charbtn" onClick={() => onOpen({ p, tab: 'char' })} title="看角色效果">
        <span className="charname">{ch.name}</span>
        <span className="muted">{mine ? '我方' : '對手'}・{ch.cls}</span>
      </button>
      {v.first === p && <span className="pill awake">先攻</span>}
      {awake && <span className="pill awake">覺醒</span>}
      <span className={`pill hp${changes?.life[p] ? ' flash' : ''}`} key={`hp${fxKey}`} title="牌組張數就是生命值">生命 {pv.deckCount}<Delta d={changes?.life[p]} k={fxKey} /></span>
      <span className="pill" data-hand-count={p} data-pile={mine ? undefined : `${p}-hand`}>手牌 {pv.hand.length}</span>
      {pv.passed && <span className="pill">已收招</span>}
    </div>
  );
}

/** 對手縮成一條：角色、生命、手牌數，加上各牌區的張數，點開看內容 */
export function OppBar({ v, p, changes, fxKey, hit, outcome, onOpen }: InfoProps) {
  const pv = v.players[p];
  const chip = (zone: string, label: string, text: string | number, tab?: SheetTab, delta?: number, numCls?: string) => {
    const body = (
      <>
        {label} <b className={numCls}>{text}</b>{delta !== undefined && <Delta d={delta} k={fxKey} tone="neutral" />}
      </>
    );
    return tab ? (
      <button className="chip click" data-pile={`${p}-${zone}`} onClick={() => onOpen({ p, tab })}>{body}</button>
    ) : (
      <span className="chip" data-pile={`${p}-${zone}`}>{body}</span>
    );
  };
  return (
    <div className={`${boardClass(v, p, hit, outcome)} oppbar`} style={hit ? { ['--hit-delay' as string]: `${hit.delay}ms` } : undefined}>
      {hit && <span className="dmgpop" key={hit.key}>−{hit.amount}</span>}
      <InfoLine v={v} p={p} changes={changes} fxKey={fxKey} onOpen={onOpen} />
      <div className="chips">
        {chip('deck', '牌組', pv.deckCount)}
        {chip('rage', '怒氣', pv.rage.length, undefined, changes?.rage[p])}
        {chip('discard', '棄牌', pv.discard.length, 'discard')}
        {chip('exp', '經驗區', expCountText(pv), 'exp', changes?.exp[p], 'expcount')}
        {chip('gear', '裝備增益', pv.gear.length + pv.buff.length, 'gear')}
      </div>
    </div>
  );
}

interface DockProps extends InfoProps {
  prompt: Request | null;
  selected: string[];
  onPick: (key: string) => void;
  drag: DragApi;
  shuffling?: boolean;
}

/** 我方面板：資訊列、五個牌堆（牌組、怒氣、棄牌、經驗、裝備增益）、單列手牌 */
export function MyDock({ v, p, changes, fxKey, hit, outcome, onOpen, prompt, selected, onPick, drag, shuffling }: DockProps) {
  const pv = v.players[p];
  const optKeys = new Set(prompt?.options.map((o) => o.key) ?? []);
  const open = (tab: SheetTab) => () => onOpen({ p, tab });
  return (
    <div className={`${boardClass(v, p, hit, outcome)} mydock`} style={hit ? { ['--hit-delay' as string]: `${hit.delay}ms` } : undefined}>
      {hit && <span className="dmgpop" key={hit.key}>−{hit.amount}</span>}
      <InfoLine v={v} p={p} changes={changes} fxKey={fxKey} onOpen={onOpen} />
      {/* 爆發與增益階段拖曳使用手牌：整排牌堆列是放置區，放在列上任何位置都算，不必瞄準小小的牌堆 */}
      <div className="piles minipiles" data-dropzone={prompt?.dropZone === 'exp' || prompt?.dropZone === 'gear' ? prompt.dropZone : undefined}>
        <Pile p={p} zone="deck" label="牌組" count={pv.deckCount} shuffling={shuffling} />
        <Pile p={p} zone="rage" label="怒氣" count={pv.rage.length} delta={changes?.rage[p]} k={fxKey} />
        <Pile p={p} zone="discard" label="棄牌" count={pv.discard.length} top={pv.discard[pv.discard.length - 1]} onClick={open('discard')} />
        <Pile
          p={p} zone="exp" label="經驗" count={pv.exp.length} countText={expCountText(pv)}
          top={pileTop(pv, 'exp') ?? undefined} delta={changes?.exp[p]} k={fxKey} onClick={open('exp')}
        />
        <Pile p={p} zone="gear" label="裝備增益" count={pv.gear.length + pv.buff.length} top={pileTop(pv, 'gear') ?? undefined} onClick={open('gear')} />
      </div>
      <div className="handzone">
        <HandRow cards={pv.hand} mine optKeys={optKeys} selected={selected} single={prompt?.min === 1 && prompt?.max === 1} minStep={28} drag={drag} onPick={onPick} />
      </div>
    </div>
  );
}

/** 全螢幕面板的內容：角色效果，或某個牌區的牌（只能看，要選牌的提示改在底部提示面板裡選） */
export function SheetBody({ v, target, fxKey, changes }: { v: GameView; target: SheetTarget; fxKey: number; changes?: StatChanges }) {
  const pv = v.players[target.p];
  const ch = getCharacter(pv.charId);
  const awake = pv.exp.length >= ch.expReq;
  if (target.tab === 'char') {
    const { faceUp, total } = expCounts(pv);
    return (
      <div className="sheetchar">
        <div><b className="charname">{ch.name}</b>　<span className="muted">{ch.cls}</span></div>
        <div>經驗區 表 {faceUp}／共 {total}　覺醒需要 {ch.expReq} 張{awake ? '　覺醒中' : ''}</div>
        <div className="peffect">效果：<KeywordText text={ch.text} /></div>
        <div className="peffect" style={{ color: awake ? 'var(--accent)' : undefined }}>覺醒：<KeywordText text={ch.awakenText} /></div>
      </div>
    );
  }
  const pursuitFrom = target.tab === 'combat' ? combatCards(pv).pursuitFrom : Infinity;
  const face = (c: CardView, i: number) => (
    <CardFace
      key={c.uid} id={c.id} size="md" pursuit={i >= pursuitFrom} expEffect={target.tab === 'exp' && expEffectActive(c)} covered={target.tab === 'exp' && c.covered}
      counters={target.tab === 'gear' ? c.counters : undefined} counterDelta={target.tab === 'gear' ? changes?.buff[c.uid] : undefined} deltaKey={fxKey}
    />
  );
  const cards = target.tab === 'exp' ? pv.exp : target.tab === 'gear' ? [...pv.gear, ...pv.buff] : target.tab === 'combat' ? combatCards(pv).cards : pv.discard;
  return (
    <div className="cardrow sheetcards">
      {cards.map(face)}
      {cards.length === 0 && <span className="muted">（空）</span>}
      {target.tab === 'exp' && cards.length > 0 && <div className="muted sheetnote">左側為最前方</div>}
      {target.tab === 'combat' && cards.length > 0 && <div className="muted sheetnote">{COMBAT_LIST_NOTE}</div>}
    </div>
  );
}

/**
 * 手機版面的全螢幕面板：看角色效果或某個牌區的列表。只有標題、內容與底部一顆大黃色關閉鈕，
 * 不能切到別的牌區，也不顯示提示欄與動作按鈕
 */
export function Sheet({ v, target, onClose, children }: { v: GameView; target: SheetTarget; onClose: () => void; children: ReactNode }) {
  const mine = target.p === v.me;
  const n = tabCount(v.players[target.p], target.tab);
  const title = `${mine ? '我方' : '對手'}${TAB_NAME[target.tab]}${n === null ? '' : `（${n}）`}`;
  return (
    <>
      <div className="sheetback" />
      <div className="sheet full" role="dialog" aria-label={title}>
        <div className="sheethead"><b>{title}</b></div>
        <div className="sheetbody">{children}</div>
        <button className="sheetclose" onClick={onClose}>關閉</button>
      </div>
    </>
  );
}

/** 手機版面放不下提示欄的提示（選項多、要看不在手牌上的卡、排序）：從底部滑出的面板，非回答不可所以不能點外面關閉 */
export function PromptSheet({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="sheetback" />
      <div className="sheet promptsheet" role="dialog" aria-label="提示">{children}</div>
    </>
  );
}

/**
 * 手機版面的卡片說明：點不能操作的卡從頂部滑下，沒有關閉鈕。沒有固定機制，點面板以外的地方就收起，
 * 那一下點擊不會穿透去操作別的東西；只有另一張不能操作的卡例外，點它是換成那張的說明
 */
export function CardSheet({ id, exp, onClose }: { id: string; exp: boolean; onClose: () => void }) {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (t?.closest('.cardsheet')) return;
      if (t?.closest('.card.inspectable')) return;
      e.stopPropagation();
      e.preventDefault();
      onClose();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [onClose]);
  return (
    <>
      <div className="sheetback passive" />
      <div className="sheet cardsheet" role="dialog" aria-label="卡片說明">
        <div className="sheetbody"><InspectPanel id={id} expActive={exp} /></div>
        <div className="muted sheetnote cardsheethint">點空白處關閉</div>
      </div>
    </>
  );
}

const MENU_SPEEDS: [Speed, string][] = [['normal', '標準'], ['fast', '快速'], ['off', '關閉']];

/** 手機版面頂列的選單鈕（三條線）與展開的選單：紀錄、流程圖、動畫速度、作弊、離開 */
export function PhoneMenu({ open, onToggle, onClose, speed, onSpeed, onLog, onFlow, cheat, locked, onLeave }: {
  open: boolean; onToggle: () => void; onClose: () => void;
  speed: Speed; onSpeed: (s: Speed) => void; onLog: () => void; onFlow: () => void;
  /** 解鎖作弊的瀏覽器才有：開關、面板按鈕 */
  cheat?: { on: boolean; panelOpen: boolean; onToggle: () => void; onPanel: () => void };
  /** 新手教學中：不能看紀錄與流程圖 */
  locked?: boolean;
  onLeave: () => void;
}) {
  const run = (fn: () => void) => () => { onClose(); fn(); };
  return (
    <>
      <button className={`menubtn${open ? ' on' : ''}`} aria-label="選單" aria-expanded={open} aria-haspopup="menu" onClick={onToggle}>
        <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true"><path d="M1 2h16M1 7h16M1 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
      {open && (
        <>
          <div className="menuback" onClick={onClose} />
          <div className="phonemenu" role="menu">
            {!locked && <button role="menuitem" onClick={run(onLog)}>紀錄</button>}
            {!locked && <button role="menuitem" onClick={run(onFlow)}>流程圖</button>}
            <div className="menuspeed" role="group" aria-label="動畫速度">
              <span className="muted">動畫速度</span>
              <div className="speeds">
                {MENU_SPEEDS.map(([s, label]) => (
                  <button key={s} className={s === speed ? 'on' : ''} aria-pressed={s === speed} onClick={() => onSpeed(s)}>{label}</button>
                ))}
              </div>
            </div>
            {cheat && (
              <>
                <button role="menuitem" className={cheat.on ? 'on' : ''} aria-pressed={cheat.on} onClick={run(cheat.onToggle)}>作弊模式</button>
                {cheat.on && <button role="menuitem" className={cheat.panelOpen ? 'on' : ''} aria-pressed={cheat.panelOpen} onClick={run(cheat.onPanel)}>作弊面板</button>}
              </>
            )}
            <button role="menuitem" className="danger" onClick={run(onLeave)}>離開</button>
          </div>
        </>
      )}
    </>
  );
}
