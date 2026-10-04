import { useEffect, useRef } from 'react';
import { getCard, getCharacter } from '../../data/cards';
import type { CardView, GameView, PlayerView } from '../../engine/view';
import type { PlayerId, Request } from '../../engine/types';
import { CardFace } from './CardFace';

export type ZoneKey = 'discard' | 'rage' | 'exp';

interface BoardProps {
  v: GameView;
  p: PlayerId;
  prompt: Request | null;
  selected: string[];
  onPick: (key: string) => void;
  onZone: (p: PlayerId, z: ZoneKey) => void;
}

export function PlayerBoard({ v, p, prompt, selected, onPick, onZone }: BoardProps) {
  const pv = v.players[p];
  const mine = p === v.me;
  const ch = getCharacter(pv.charId);
  const awake = pv.exp.length >= ch.expReq;
  const optKeys = new Set(prompt?.options.map((o) => o.key) ?? []);
  const name = p === 0 ? '玩家A' : '玩家B';

  return (
    <div className={`pboard${v.first === p ? ' turn' : ''}`}>
      <div className="phead">
        <span className="charname" title={`${ch.text}\n覺醒：${ch.awakenText}`}>
          {ch.name}
        </span>
        <span className="muted">{name}{mine ? '（你）' : ''}・{ch.cls}</span>
        {v.first === p && <span className="pill awake">先攻</span>}
        <span className="pill hp" title="牌組張數就是生命值">生命 {pv.deckCount}</span>
        <span className="pill">手牌 {pv.hand.length}</span>
        <span className="pill click" onClick={() => onZone(p, 'rage')}>怒氣 {pv.rage.length}</span>
        <span className="pill click" onClick={() => onZone(p, 'discard')}>棄牌 {pv.discard.length}</span>
        <span className={`pill click${awake ? ' awake' : ''}`} onClick={() => onZone(p, 'exp')}>
          經驗 {pv.exp.length}/{ch.expReq}{awake ? ' 覺醒' : ''}
        </span>
        {pv.passed && <span className="pill">已收招</span>}
      </div>
      <div className="muted" style={{ fontSize: 12 }}>
        效果：{ch.text}　<span style={{ color: awake ? 'var(--accent)' : undefined }}>覺醒：{ch.awakenText}</span>
      </div>

      {(pv.gear.length > 0 || pv.buff.length > 0) && (
        <div>
          <div className="zonelabel">裝備／增益</div>
          <div className="cardrow">
            {pv.gear.map((c) => <CardFace key={c.uid} id={c.id} size="sm" />)}
            {pv.buff.map((c) => <CardFace key={c.uid} id={c.id} size="sm" counters={c.counters} />)}
          </div>
        </div>
      )}

      <div>
        <div className="zonelabel">經驗區（左側為最前方）</div>
        <div className="cardrow scroll" style={{ minHeight: pv.exp.length ? 0 : 20 }}>
          {pv.exp.map((c) => (
            <CardFace
              key={c.uid} id={c.id} size="sm" covered={c.covered}
              glow={optKeys.has(`c${c.uid}`)} selected={selected.includes(`c${c.uid}`)}
              onClick={optKeys.has(`c${c.uid}`) ? () => onPick(`c${c.uid}`) : undefined}
            />
          ))}
          {pv.exp.length === 0 && <span className="muted">（空）</span>}
        </div>
      </div>

      <div>
        <div className="zonelabel">手牌</div>
        <div className="cardrow">
          {pv.hand.map((c) => (
            <CardFace
              key={c.uid} id={mine ? c.id : null} size={mine ? 'md' : 'sm'}
              glow={mine && optKeys.has(`c${c.uid}`)} selected={mine && selected.includes(`c${c.uid}`)}
              onClick={mine && optKeys.has(`c${c.uid}`) ? () => onPick(`c${c.uid}`) : undefined}
            />
          ))}
          {pv.hand.length === 0 && <span className="muted">（空）</span>}
        </div>
      </div>
    </div>
  );
}

function rangeText(v: GameView): string {
  const mine = v.players[v.me].combat;
  const opp = v.players[v.me === 0 ? 1 : 0].combat;
  if (mine.length === 0 || opp.length === 0) return '範圍：任意連擊值';
  const a = getCard(mine[mine.length - 1].id!).combo;
  const b = getCard(opp[opp.length - 1].id!).combo;
  return `範圍內：連擊值 ${Math.min(a, b)} ~ ${Math.max(a, b)}`;
}

const sumOf = (cards: CardView[], key: 'atk' | 'def') =>
  cards.reduce((n, c) => n + (c.id ? getCard(c.id)[key] : 0), 0);

/** 一方的戰鬥區：卡片往下疊（最新的在最下面且完整顯示），上面幾張只露出「攻／連擊／守」 */
function StackColumn({ pv, label }: { pv: PlayerView; label: string }) {
  const cards = [...pv.combat, ...pv.pursuit];
  const rawAtk = sumOf(pv.combat, 'atk') + sumOf(pv.pursuit, 'atk');
  const rawDef = sumOf(pv.combat, 'def');
  const diff = (shown: number, raw: number) => (shown === raw ? '' : `（含效果 ${shown > raw ? '+' : ''}${shown - raw}）`);
  return (
    <div className="col">
      <h4>{label}</h4>
      <div className="vstack">
        {cards.map((c, i) => (
          <CardFace key={c.uid} id={c.id} size="md" pursuit={i >= pv.combat.length} />
        ))}
        {cards.length === 0 && <span className="empty">（尚未出招）</span>}
      </div>
      <div className="sumbox">
        <div>總攻 <b className="atk">{pv.atk}</b> ／ 總防 <b className="def">{pv.def}</b></div>
        {(pv.atk !== rawAtk || pv.def !== rawDef) && (
          <div className="note">卡面合計 {rawAtk} ／ {rawDef}{diff(pv.atk, rawAtk)}</div>
        )}
        {pv.pursuit.length > 0 && <div className="note">金框為追擊卡</div>}
      </div>
    </div>
  );
}

export function CombatArea({ v }: { v: GameView }) {
  const opp: PlayerId = v.me === 0 ? 1 : 0;
  return (
    <div className="combatarea">
      <div className="cols">
        <StackColumn pv={v.players[opp]} label="對方" />
        <div className="mid">
          <div className="range">{rangeText(v)}</div>
          <div className="muted" style={{ fontSize: 12 }}>對方傷害 ＝ 我方總攻 − 對方總防</div>
        </div>
        <StackColumn pv={v.players[v.me]} label="我方" />
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
