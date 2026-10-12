import { useEffect, useState, type ReactNode } from 'react';
import { useCoarsePointer } from '../layoutMode';
import { tapCard } from '../touchTap';
import { getCharacter } from '../../data/cards';
import type { StatChanges } from '../../engine/stats';
import type { PlayerId, Request } from '../../engine/types';
import { pileTop, type CardView, type GameView, type PlayerView } from '../../engine/view';
import type { DragApi } from '../useCardDrag';
import type { Speed } from '../playback';
import { HandRow, Pile } from './Board';
import { CardFace, expEffectActive, InspectPanel } from './CardFace';
import { Delta } from './Delta';
import { KeywordText } from './KeywordText';

/** 手機版面的底部面板裡能看的內容 */
export type SheetTab = 'char' | 'exp' | 'gear' | 'discard' | 'rage';
export interface SheetTarget { p: PlayerId; tab: SheetTab }

const TAB_NAME: Record<SheetTab, string> = { char: '角色', exp: '經驗區', gear: '裝備增益區', discard: '棄牌區', rage: '怒氣區' };

/** 這位玩家的面板在手機版面能點開看的分頁：怒氣區只有擁有者看得到 */
export const sheetTabs = (mine: boolean): SheetTab[] => (mine ? ['char', 'exp', 'gear', 'discard', 'rage'] : ['char', 'exp', 'gear', 'discard']);

const tabCount = (pv: PlayerView, tab: SheetTab): number | null =>
  tab === 'exp' ? pv.exp.length : tab === 'gear' ? pv.gear.length + pv.buff.length : tab === 'discard' ? pv.discard.length : tab === 'rage' ? pv.rage.length : null;

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
  return (
    <div className="infoline">
      <button className="charbtn" onClick={() => onOpen({ p, tab: 'char' })} title="看角色效果">
        <span className="charname">{ch.name}</span>
        <span className="muted">{mine ? '我方' : '對手'}・{ch.cls}</span>
      </button>
      {v.first === p && <span className="pill awake">先攻</span>}
      <span className={`pill hp${changes?.life[p] ? ' flash' : ''}`} key={`hp${fxKey}`} title="牌組張數就是生命值">生命 {pv.deckCount}<Delta d={changes?.life[p]} k={fxKey} /></span>
      <span className="pill" data-pile={mine ? undefined : `${p}-hand`}>手牌 {pv.hand.length}</span>
      {pv.passed && <span className="pill">已收招</span>}
    </div>
  );
}

/** 對手縮成一條：角色、生命、手牌數，加上各牌區的張數，點開看內容 */
export function OppBar({ v, p, changes, fxKey, hit, outcome, onOpen }: InfoProps) {
  const pv = v.players[p];
  const ch = getCharacter(pv.charId);
  const awake = pv.exp.length >= ch.expReq;
  const chip = (zone: string, label: string, text: string | number, tab?: SheetTab, delta?: number, cls = '') => {
    const body = (
      <>
        {label} <b>{text}</b>{delta !== undefined && <Delta d={delta} k={fxKey} tone="neutral" />}
      </>
    );
    return tab ? (
      <button className={`chip click${cls}`} data-pile={`${p}-${zone}`} onClick={() => onOpen({ p, tab })}>{body}</button>
    ) : (
      <span className={`chip${cls}`} data-pile={`${p}-${zone}`}>{body}</span>
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
        {chip('exp', awake ? '覺醒' : '經驗', `${pv.exp.length}/${ch.expReq}`, 'exp', changes?.exp[p], awake ? ' awake' : '')}
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
  const ch = getCharacter(pv.charId);
  const awake = pv.exp.length >= ch.expReq;
  const optKeys = new Set(prompt?.options.map((o) => o.key) ?? []);
  const open = (tab: SheetTab) => () => onOpen({ p, tab });
  return (
    <div className={`${boardClass(v, p, hit, outcome)} mydock`} style={hit ? { ['--hit-delay' as string]: `${hit.delay}ms` } : undefined}>
      {hit && <span className="dmgpop" key={hit.key}>−{hit.amount}</span>}
      <InfoLine v={v} p={p} changes={changes} fxKey={fxKey} onOpen={onOpen} />
      {/* 爆發與增益階段拖曳使用手牌：整排牌堆列是放置區，放在列上任何位置都算，不必瞄準小小的牌堆 */}
      <div className="piles minipiles" data-dropzone={prompt?.dropZone === 'exp' || prompt?.dropZone === 'gear' ? prompt.dropZone : undefined}>
        <Pile p={p} zone="deck" label="牌組" count={pv.deckCount} shuffling={shuffling} />
        <Pile p={p} zone="rage" label="怒氣" count={pv.rage.length} delta={changes?.rage[p]} k={fxKey} onClick={open('rage')} />
        <Pile p={p} zone="discard" label="棄牌" count={pv.discard.length} top={pv.discard[pv.discard.length - 1]} onClick={open('discard')} />
        <Pile
          p={p} zone="exp" label={awake ? '覺醒' : '經驗'} count={pv.exp.length} extra={`/${ch.expReq}`} awake={awake}
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

/** 底部面板的內容：依分頁顯示角色效果或某個牌區的牌 */
export function SheetBody({ v, target, optKeys, selected, single, onPick, fxKey, changes }: {
  v: GameView; target: SheetTarget; optKeys: Set<string>; selected: string[]; /** 提示是必選 1 個：點選就送出（觸控則是第二下） */ single: boolean;
  onPick: (key: string) => void; fxKey: number; changes?: StatChanges;
}) {
  const coarse = useCoarsePointer();
  const [armed, setArmed] = useState<number | null>(null);
  const optSig = [...optKeys].join(',');
  useEffect(() => setArmed(null), [optSig, target.tab, target.p]);
  const pv = v.players[target.p];
  const ch = getCharacter(pv.charId);
  const mine = target.p === v.me;
  const awake = pv.exp.length >= ch.expReq;
  if (target.tab === 'char') {
    return (
      <div className="sheetchar">
        <div><b className="charname">{ch.name}</b>　<span className="muted">{ch.cls}</span></div>
        <div>經驗 {pv.exp.length}/{ch.expReq}{awake ? '　覺醒中' : ''}</div>
        <div className="peffect">效果：<KeywordText text={ch.text} /></div>
        <div className="peffect" style={{ color: awake ? 'var(--accent)' : undefined }}>覺醒：<KeywordText text={ch.awakenText} /></div>
      </div>
    );
  }
  const pick = (c: CardView) => {
    if (!mine || !optKeys.has(`c${c.uid}`)) return undefined;
    if (!coarse || !single) return () => onPick(`c${c.uid}`);
    return () => {
      const r = tapCard(armed, c.uid, true);
      setArmed(r.preview);
      if (r.submit) onPick(`c${c.uid}`);
    };
  };
  const face = (c: CardView) => (
    <CardFace
      key={c.uid} id={c.id} size="md" expEffect={target.tab === 'exp' && expEffectActive(c)} covered={target.tab === 'exp' && c.covered}
      glow={mine && optKeys.has(`c${c.uid}`)} selected={mine && (selected.includes(`c${c.uid}`) || armed === c.uid)} onClick={pick(c)}
      counters={target.tab === 'gear' ? c.counters : undefined} counterDelta={target.tab === 'gear' ? changes?.buff[c.uid] : undefined} deltaKey={fxKey}
    />
  );
  const cards = target.tab === 'exp' ? pv.exp : target.tab === 'gear' ? [...pv.gear, ...pv.buff] : target.tab === 'discard' ? pv.discard : pv.rage;
  return (
    <div className="cardrow sheetcards">
      {cards.map(face)}
      {cards.length === 0 && <span className="muted">（空）</span>}
      {target.tab === 'exp' && cards.length > 0 && <div className="muted sheetnote">左側為最前方</div>}
    </div>
  );
}

/** 手機版面從底部滑出的面板：分頁列、內容、提示欄（要在面板裡選牌時，提示欄跟著面板一起出現） */
export function Sheet({ v, target, onTab, onClose, footer, children }: {
  v: GameView; target: SheetTarget; onTab: (t: SheetTab) => void; onClose: () => void; footer?: ReactNode; children: ReactNode;
}) {
  const mine = target.p === v.me;
  const pv = v.players[target.p];
  return (
    <>
      <div className="sheetback" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={`${mine ? '我方' : '對手'}${TAB_NAME[target.tab]}`}>
        <div className="sheethead">
          <b>{mine ? '我方' : '對手'}</b>
          <div className="sheettabs">
            {sheetTabs(mine).map((t) => {
              const n = tabCount(pv, t);
              return (
                <button key={t} className={t === target.tab ? 'on' : ''} aria-pressed={t === target.tab} onClick={() => onTab(t)}>
                  {TAB_NAME[t]}{n === null ? '' : ` ${n}`}
                </button>
              );
            })}
          </div>
          <button onClick={onClose}>關閉</button>
        </div>
        <div className="sheetbody">{children}</div>
        {footer}
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
 * 手機版面的卡片說明：點不能操作的卡從底部滑出。沒有固定機制，點面板以外的地方就收起，
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
        <div className="sheethead">
          <b>卡片說明</b>
          <span className="spacer" />
          <button onClick={onClose}>關閉</button>
        </div>
        <div className="sheetbody"><InspectPanel id={id} expActive={exp} /></div>
      </div>
    </>
  );
}

const MENU_SPEEDS: [Speed, string][] = [['normal', '標準'], ['fast', '快速'], ['off', '關閉']];

/** 手機版面頂列的選單鈕（三條線）與展開的選單：紀錄、流程圖、動畫速度、作弊、離開 */
export function PhoneMenu({ open, onToggle, onClose, speed, onSpeed, onLog, onFlow, cheat, onLeave }: {
  open: boolean; onToggle: () => void; onClose: () => void;
  speed: Speed; onSpeed: (s: Speed) => void; onLog: () => void; onFlow: () => void;
  /** 解鎖作弊的瀏覽器才有：開關、面板按鈕 */
  cheat?: { on: boolean; panelOpen: boolean; onToggle: () => void; onPanel: () => void };
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
            <button role="menuitem" onClick={run(onLog)}>紀錄</button>
            <button role="menuitem" onClick={run(onFlow)}>流程圖</button>
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
