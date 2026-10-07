import { KeywordText } from './KeywordText';
import { useEffect, useRef } from 'react';
import { getCard, getCharacter } from '../../data/cards';
import type { CardView, GameView, PlayerView } from '../../engine/view';
import type { FrameFx, PlayerId, Request } from '../../engine/types';
import { CardFace } from './CardFace';

export type ZoneKey = 'discard' | 'rage' | 'exp';

interface BoardProps {
  v: GameView;
  p: PlayerId;
  prompt: Request | null;
  selected: string[];
  onPick: (key: string) => void;
  onZone: (p: PlayerId, z: ZoneKey) => void;
  /** 這位玩家剛受到傷害：震動並浮出傷害數字（key 變動時重播） */
  hit?: { amount: number; key: number };
}

/** 牌堆：牌組、棄牌區、怒氣區。飛行圖層以 data-pile 找到它在畫面上的位置 */
function Pile({ p, zone, label, count, top, onClick }: {
  p: PlayerId; zone: 'deck' | 'discard' | 'rage'; label: string; count: number; top?: CardView; onClick?: () => void;
}) {
  const depth = Math.min(count, 6);
  const edge = Array.from({ length: depth }, (_, i) => `${(i + 1) * 2}px ${(i + 1) * 2}px 0 var(--pile-edge)`).join(', ');
  return (
    <div className={`pile ${zone}${onClick ? ' click' : ''}`} onClick={onClick}>
      <div className="pilestack" data-pile={`${p}-${zone}`} style={{ boxShadow: edge || undefined }}>
        {count === 0 ? (
          <div className="card sm slot">空</div>
        ) : zone === 'discard' && top?.id ? (
          <CardFace id={top.id} size="sm" />
        ) : (
          <CardFace id={null} size="sm" />
        )}
      </div>
      <div className="pilelabel">{label} <b>{count}</b></div>
    </div>
  );
}

export function PlayerBoard({ v, p, prompt, selected, onPick, onZone, hit }: BoardProps) {
  const pv = v.players[p];
  const mine = p === v.me;
  const ch = getCharacter(pv.charId);
  const awake = pv.exp.length >= ch.expReq;
  const optKeys = new Set(prompt?.options.map((o) => o.key) ?? []);
  const name = p === 0 ? '玩家A' : '玩家B';

  return (
    <div className={`pboard${v.first === p ? ' turn' : ''}${hit ? ' hit' : ''}`}>
      {hit && <span className="dmgpop" key={hit.key}>−{hit.amount}</span>}
      <div className="phead">
        <span className="charname" title={`${ch.text}\n覺醒：${ch.awakenText}`}>
          {ch.name}
        </span>
        <span className="muted">{name}{mine ? '（你）' : ''}・{ch.cls}</span>
        {v.first === p && <span className="pill awake">先攻</span>}
        <span className="pill hp" title="牌組張數就是生命值">生命 {pv.deckCount}</span>
        <span className="pill">手牌 {pv.hand.length}</span>
        <span className={`pill click${awake ? ' awake' : ''}`} onClick={() => onZone(p, 'exp')}>
          經驗 {pv.exp.length}/{ch.expReq}{awake ? ' 覺醒' : ''}
        </span>
        {pv.passed && <span className="pill">已收招</span>}
      </div>
      <div className="muted" style={{ fontSize: 12 }}>
        效果：<KeywordText text={ch.text} />　<span style={{ color: awake ? 'var(--accent)' : undefined }}>覺醒：<KeywordText text={ch.awakenText} /></span>
      </div>

      {(pv.gear.length > 0 || pv.buff.length > 0) && (
        <div>
          <div className="zonelabel">裝備／增益</div>
          <div className="cardrow">
            {pv.gear.map((c) => <CardFace key={c.uid} uid={c.uid} id={c.id} size="sm" />)}
            {pv.buff.map((c) => <CardFace key={c.uid} uid={c.uid} id={c.id} size="sm" counters={c.counters} />)}
          </div>
        </div>
      )}

      <div className="zonesrow">
        <div className="piles">
          <Pile p={p} zone="deck" label="牌組" count={pv.deckCount} />
          <Pile p={p} zone="discard" label="棄牌" count={pv.discard.length} top={pv.discard[pv.discard.length - 1]} onClick={() => onZone(p, 'discard')} />
          <Pile p={p} zone="rage" label="怒氣" count={pv.rage.length} onClick={() => onZone(p, 'rage')} />
        </div>
        <div className="expzone">
          <div className="zonelabel">經驗區（左側為最前方）</div>
          <div className="cardrow scroll" style={{ minHeight: pv.exp.length ? 0 : 20 }}>
            {pv.exp.map((c) => (
              <CardFace
                key={c.uid} uid={c.uid} id={c.id} size="sm" covered={c.covered}
                glow={optKeys.has(`c${c.uid}`)} selected={selected.includes(`c${c.uid}`)}
                onClick={optKeys.has(`c${c.uid}`) ? () => onPick(`c${c.uid}`) : undefined}
              />
            ))}
            {pv.exp.length === 0 && <span className="muted">（空）</span>}
          </div>
        </div>
      </div>

      <div>
        <div className="zonelabel">手牌</div>
        <div className="cardrow">
          {pv.hand.map((c) => (
            <CardFace
              key={c.uid} uid={c.uid} id={mine ? c.id : null} size={mine ? 'md' : 'sm'}
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
function StackColumn({ pv, label, mine, fx }: { pv: PlayerView; label: string; mine: boolean; fx?: FrameFx }) {
  const cards = [...pv.combat, ...pv.pursuit];
  const rawAtk = sumOf(pv.combat, 'atk') + sumOf(pv.pursuit, 'atk');
  const rawDef = sumOf(pv.combat, 'def');
  const diff = (shown: number, raw: number) => (shown === raw ? '' : `（含效果 ${shown > raw ? '+' : ''}${shown - raw}）`);
  return (
    <div className={`col ${mine ? 'mine' : 'opp'}`}>
      <h4>{label}</h4>
      <div className="vstack">
        {cards.map((c, i) => (
          <CardFace
            key={c.uid} uid={c.uid} id={c.id} size="md" pursuit={i >= pv.combat.length}
            fresh={fx?.type === 'play' && fx.uid === c.uid}
          />
        ))}
        {cards.length === 0 && <span className="empty">（尚未出招）</span>}
      </div>
      <div className={`sumbox${fx?.type === 'calc' ? ' pulse' : ''}`}>
        <div>總攻 <b className="atk">{pv.atk}</b> ／ 總防 <b className="def">{pv.def}</b></div>
        {(pv.atk !== rawAtk || pv.def !== rawDef) && (
          <div className="note">卡面合計 {rawAtk} ／ {rawDef}{diff(pv.atk, rawAtk)}</div>
        )}
        {pv.pursuit.length > 0 && <div className="note">金框為追擊卡</div>}
      </div>
    </div>
  );
}

/** 疊在某一方戰鬥區上的特效：追擊翻牌、判定結果、收招 */
function ColumnFx({ fx, fxKey, player }: { fx?: FrameFx; fxKey: number; player: PlayerId }) {
  if (!fx || !('player' in fx) || fx.player !== player) return null;
  if (fx.type === 'flip') {
    return (
      <div className="flipcard" key={`f${fxKey}`}>
        <div className="fliplabel">追擊判定</div>
        <CardFace id={fx.cardId} size="md" />
      </div>
    );
  }
  if (fx.type === 'flipResult') {
    return <div className={`resultpop ${fx.ok ? 'ok' : 'fail'}`} key={`r${fxKey}`}>{fx.ok ? '追擊成功！' : '追擊失敗'}</div>;
  }
  if (fx.type === 'pass') return <div className="resultpop pass" key={`p${fxKey}`}>收招</div>;
  return null;
}

export function CombatArea({ v, fx, caption, fxKey }: {
  v: GameView; fx?: FrameFx; caption?: string; fxKey: number;
}) {
  const opp: PlayerId = v.me === 0 ? 1 : 0;
  const calc = fx?.type === 'calc' ? fx : null;
  const dmgLine = (n: number) => <b className={`dm${n === 0 ? ' zero' : ''}`}>{n}</b>;
  return (
    <div className="combatarea">
      <div className="caption" key={`c${fxKey}`}>{caption ?? ' '}</div>
      <div className="cols">
        <div className="colwrap">
          <StackColumn pv={v.players[opp]} label="對方" mine={false} fx={fx} />
          <ColumnFx fx={fx} fxKey={fxKey} player={opp} />
        </div>
        <div className="mid">
          {calc ? (
            <div className="calc" key={`calc${fxKey}`}>
              <div className="eq">
                <span className="who">對方 → 我方</span>
                攻 <b className="atk">{calc.atk[opp]}</b> − 守 <b className="def">{calc.def[v.me]}</b> ＝ {dmgLine(calc.dmg[v.me])}
              </div>
              <div className="eq">
                <span className="who">我方 → 對方</span>
                攻 <b className="atk">{calc.atk[v.me]}</b> − 守 <b className="def">{calc.def[opp]}</b> ＝ {dmgLine(calc.dmg[opp])}
              </div>
            </div>
          ) : (
            <>
              <div className="range">{rangeText(v)}</div>
              <div className="muted" style={{ fontSize: 12 }}>傷害 ＝ 對方總攻 − 我方總防</div>
            </>
          )}
        </div>
        <div className="colwrap">
          <StackColumn pv={v.players[v.me]} label="我方" mine fx={fx} />
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
