import { FLOW_CHART_URL } from '../flowChart';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { SPEED_LABEL, usePlayback, type Speed } from '../usePlayback';
import { VERSION_SHORT, VERSION_TITLE } from '../../version';
import { CardFace, InspectContext, InspectPanel, PinContext } from '../components/CardFace';
import { CombatArea, LogPanel, PlayerBoard, type ZoneKey } from '../components/Board';
import { FlightLayer } from '../components/FlightLayer';
import { Spotlight } from '../components/Spotlight';
import { Modal } from '../components/Modal';
import { StepTracker } from '../components/StepTracker';
import { PromptPanel } from '../components/PromptPanel';
import type { Session } from '../../net/session';
import type { PlayerId } from '../../engine/types';

const ZONE_NAME: Record<ZoneKey, string> = { discard: '棄牌區', rage: '怒氣區', exp: '經驗區' };

export function Battle({ session, onExit }: { session: Session; onExit: () => void }) {
  const st = useSyncExternalStore(session.subscribe, session.getState);
  const [selected, setSelected] = useState<string[]>([]);
  const [inspect, setInspect] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const togglePin = useCallback((id: string) => setPinned((p) => (p === id ? null : id)), []);
  const [zone, setZone] = useState<{ p: PlayerId; z: ZoneKey } | null>(null);
  const [copied, setCopied] = useState(false);
  const [speed, setSpeedState] = useState<Speed>(() => {
    try {
      const s = localStorage.getItem('lianji.speed');
      return s === 'fast' || s === 'off' ? s : 'normal';
    } catch {
      return 'normal';
    }
  });
  const setSpeed = (s: Speed) => {
    setSpeedState(s);
    try {
      localStorage.setItem('lianji.speed', s);
    } catch {
      // 無法儲存偏好：忽略
    }
  };

  const final = st.view;
  const { cur, skip, scale } = usePlayback(st.batch, speed);
  // 播放動畫時顯示影格當下的桌面；播完才顯示最新的真實狀態與提示
  const v = useMemo(
    () =>
      final && cur
        ? { ...cur.frame.view, log: final.log.slice(0, cur.frame.logLen), prompt: null, waitingFor: null }
        : final,
    [final, cur],
  );

  // Esc 取消固定的說明
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPinned(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 每次收到新狀態或換影格，就清掉上一個提示的選擇
  useEffect(() => setSelected([]), [final, cur?.n]);

  const leave = () => {
    session.leave();
    onExit();
  };

  if (!v) {
    return (
      <div className="page narrow home">
        <div className="panel">
          {st.status === 'error' ? (
            <>
              <h2 style={{ color: 'var(--bad)' }}>無法連線</h2>
              <p>{st.message}</p>
            </>
          ) : st.roomCode && session.me === 0 ? (
            <>
              <h2>房間已建立</h2>
              <div className="code">{st.roomCode}</div>
              <p className="muted">把房號傳給朋友，請他在「加入房間」輸入。</p>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(st.roomCode ?? '').then(() => setCopied(true), () => {});
                }}
              >
                {copied ? '已複製' : '複製房號'}
              </button>
              <p>{st.message}</p>
            </>
          ) : (
            <h2>{st.message || '連線中…'}</h2>
          )}
          <div style={{ marginTop: 14 }}>
            <button onClick={leave}>{st.status === 'error' ? '返回' : '取消'}</button>
          </div>
        </div>
      </div>
    );
  }

  const me = v.me;
  const opp: PlayerId = me === 0 ? 1 : 0;
  const prompt = v.prompt;
  const waitingOpp = !prompt && v.waitingFor === opp && v.winner === null;

  const toggle = (key: string) => {
    if (!prompt) return;
    if (prompt.min === 1 && prompt.max === 1) {
      session.submit([key]);
      return;
    }
    setSelected((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : cur.length < prompt.max ? [...cur, key] : cur));
  };

  const zoneCards = zone ? v.players[zone.p][zone.z] : [];
  const result = v.winner === null ? null : v.winner === 'draw' ? 'draw' : v.winner === me ? 'win' : 'lose';
  const fx = cur?.frame.fx;
  const fxKey = cur?.n ?? 0;
  const dmgFx = fx?.type === 'damage' ? fx.dmg : null;
  const hitOf = (p: PlayerId) => (dmgFx && dmgFx[p] > 0 ? { amount: dmgFx[p], key: fxKey } : undefined);

  return (
    <InspectContext.Provider value={setInspect}>
      <PinContext.Provider value={togglePin}>
      <div className="battle">
        <div className="topbar">
          <span className="ver" title={VERSION_TITLE}>連擊大師 {VERSION_SHORT}</span>
          <b>第 {v.turn} 回合</b>
          <span className="phase">{v.phase}</span>
          <span className="muted">先攻：{v.first === me ? '你' : '對手'}</span>
          <span className="spacer" />
          {st.message && <span style={{ color: 'var(--bad)' }}>{st.message}</span>}
          <a className="btnlink" href={FLOW_CHART_URL} target="_blank" rel="noreferrer" title="在新分頁開啟戰鬥流程圖">流程圖</a>
          <select value={speed} onChange={(e) => setSpeed(e.target.value as Speed)} title="動畫速度">
            {(Object.keys(SPEED_LABEL) as Speed[]).map((s) => <option key={s} value={s}>{SPEED_LABEL[s]}</option>)}
          </select>
          <button className="danger" onClick={leave}>離開</button>
        </div>
        <StepTracker phase={v.phase} waitingFor={v.waitingFor} me={me} />
        {!st.opponentOnline && v.winner === null && (
          <div className="banner">
            對手連線不穩或已離線{st.forfeitIn !== null ? `，${st.forfeitIn} 秒後將判你獲勝` : '…'}
          </div>
        )}
        <div className="main">
          <div className={`board${cur ? ' playing' : ''}`}>
            <PlayerBoard v={v} p={opp} prompt={null} selected={[]} onPick={() => {}} onZone={(p, z) => setZone({ p, z })} hit={hitOf(opp)} />
            <CombatArea v={v} fx={fx} caption={cur?.frame.caption} fxKey={fxKey} />
            <PlayerBoard v={v} p={me} prompt={prompt} selected={selected} onPick={toggle} onZone={(p, z) => setZone({ p, z })} hit={hitOf(me)} />
            {cur ? (
              <div className="prompt wait">
                <span>動畫播放中…</span>
                <div className="btns"><button onClick={skip}>跳過動畫</button></div>
              </div>
            ) : prompt ? (
              <PromptPanel prompt={prompt} selected={selected} onPick={toggle} onSubmit={(k) => session.submit(k)} />
            ) : (
              <div className="prompt wait">{waitingOpp ? '等待對手操作…' : v.winner !== null ? '遊戲結束' : '處理中…'}</div>
            )}
          </div>
          <div className="side">
            <InspectPanel id={pinned ?? inspect} pinned={pinned !== null} onUnpin={() => setPinned(null)} />
            <LogPanel lines={v.log} />
          </div>
        </div>

        <Spotlight fx={fx} n={fxKey} scale={scale} />
        <FlightLayer view={v} fx={fx} playing={cur !== null} n={fxKey} scale={scale} />

        {zone && (
          <Modal onClose={() => setZone(null)}>
            <h3>
              {zone.p === me ? '我方' : '對手'}{ZONE_NAME[zone.z]}（{zoneCards.length}）
            </h3>
            {zone.z === 'rage' && zone.p !== me ? (
              <p className="muted">對手的怒氣區內容看不到。</p>
            ) : (
              <div className="cardrow" style={{ maxWidth: 720 }}>
                {zoneCards.map((c) => <CardFace key={c.uid} id={c.id} size="sm" covered={c.covered} />)}
                {zoneCards.length === 0 && <span className="muted">（空）</span>}
              </div>
            )}
            <div style={{ marginTop: 12 }}><button onClick={() => setZone(null)}>關閉</button></div>
          </Modal>
        )}

        {result && (
          <Modal>
            <div className={`result ${result}`}>
              <h1>{result === 'win' ? '你獲勝了！' : result === 'lose' ? '你落敗了' : '平手'}</h1>
              <p className="muted">{v.winReason}</p>
              <button className="primary" onClick={leave}>回首頁</button>
            </div>
          </Modal>
        )}
      </div>
      </PinContext.Provider>
    </InspectContext.Provider>
  );
}
