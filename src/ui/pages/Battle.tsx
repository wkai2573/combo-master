import { FLOW_CHART_URL } from '../flowChart';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { SPEED_LABEL, useSpeed, usePlayback, type Speed } from '../usePlayback';
import { VERSION_SHORT, VERSION_TITLE } from '../../version';
import { InspectContext, InspectPanel, PinContext } from '../components/CardFace';
import { CombatArea, LogPanel, PlayerBoard, type ZoneKey } from '../components/Board';
import { FlightLayer } from '../components/FlightLayer';
import { PhaseBanner } from '../components/PhaseBanner';
import { Spotlight } from '../components/Spotlight';
import { Modal } from '../components/Modal';
import { ZoneViewer } from '../components/ZoneViewer';
import { StepTracker } from '../components/StepTracker';
import { PromptPanel } from '../components/PromptPanel';
import { CheatPanel } from '../components/CheatPanel';
import { useWide } from '../useWide';
import type { Session } from '../../net/session';
import type { PlayerId } from '../../engine/types';

const ZONE_NAME: Record<ZoneKey, string> = { discard: '棄牌區', rage: '怒氣區', exp: '經驗區' };

export function Battle({ session, onExit }: { session: Session; onExit: () => void }) {
  const st = useSyncExternalStore(session.subscribe, session.getState);
  const wide = useWide();
  const [selected, setSelected] = useState<string[]>([]);
  // exp：這張卡在經驗區且經驗效果生效中（說明欄多一行狀態）
  const [inspect, setInspect] = useState<{ id: string; exp: boolean } | null>(null);
  const [pinned, setPinned] = useState<{ id: string; exp: boolean } | null>(null);
  const inspectCard = useCallback((id: string | null, exp?: boolean) => setInspect(id ? { id, exp: !!exp } : null), []);
  const togglePin = useCallback((id: string, exp?: boolean) => setPinned((p) => (p?.id === id && p.exp === !!exp ? null : { id, exp: !!exp })), []);
  // 窄螢幕版：卡片說明與遊戲紀錄收成可開關的抽屜，一次開一個
  const [drawer, setDrawer] = useState<'inspect' | 'log' | null>(null);
  const [zone, setZone] = useState<{ p: PlayerId; z: ZoneKey; anchor: DOMRect } | null>(null);
  const zoneRef = useRef(zone);
  zoneRef.current = zone;
  const [copied, setCopied] = useState(false);
  // 作弊模式：開關記在連線層（對方才看得到提示），離開或下一局都會回到關閉；面板的開合只是這個畫面的事
  const [cheatOpen, setCheatOpen] = useState(false);
  const cheatOpenRef = useRef(cheatOpen);
  cheatOpenRef.current = cheatOpen;
  // 面板跟著連線層確認過的開關走：開啟被確認才打開，關閉就收起（房主沒回應或遊戲已結束時不會憑空彈出）
  const cheatOnState = st.cheatOn[session.me];
  useEffect(() => setCheatOpen(cheatOnState), [cheatOnState]);
  const [speed, setSpeed] = useSpeed();
  const final = st.view;
  const { presentation: pres, skip } = usePlayback(st.batch, final, speed);
  const { view: v, changes, fx, fxKey, scale } = pres;

  // 窄螢幕沒有常駐的說明欄：固定一張卡的說明時自動打開說明抽屜
  const wideRef = useRef(wide);
  wideRef.current = wide;
  useEffect(() => {
    if (pinned && !wideRef.current) setDrawer('inspect');
  }, [pinned]);

  // Esc：先關閉展開的牌區，沒有展開的牌區才取消固定的說明
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // 在輸入框裡按 Esc 只離開輸入框，不連帶關掉面板
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
        e.target.blur();
        return;
      }
      if (zoneRef.current) setZone(null);
      else if (cheatOpenRef.current) setCheatOpen(false);
      else {
        setPinned(null);
        setDrawer(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 每次收到新狀態或換影格，就清掉上一個提示的選擇
  useEffect(() => setSelected([]), [final, fxKey]);

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
  const cheatOn = st.cheatOn[me];
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
  // 結束演出播完（或跳過）才顯示結果視窗；演出期間先讓勝負在桌面上呈現
  const result = !pres.settled || v.winner === null ? null : v.winner === 'draw' ? 'draw' : v.winner === me ? 'win' : 'lose';
  const outcomeOf = (p: PlayerId) => (v.winner === null ? undefined : v.winner === 'draw' ? 'draw' : v.winner === p ? 'win' : 'lose');
  const shown = pinned ?? inspect;
  const inspectPanel = <InspectPanel id={shown?.id ?? null} expActive={shown?.exp} pinned={pinned !== null} onUnpin={() => setPinned(null)} />;
  const oppBoard = <PlayerBoard v={v} p={opp} prompt={null} selected={[]} onPick={() => {}} onZone={(p, z, anchor) => setZone({ p, z, anchor })} hit={pres.hits[opp]} changes={changes} fxKey={fxKey} outcome={outcomeOf(opp)} shuffling={fx?.type === 'shuffle'} />;
  const myBoard = <PlayerBoard v={v} p={me} prompt={prompt} selected={selected} onPick={toggle} onZone={(p, z, anchor) => setZone({ p, z, anchor })} hit={pres.hits[me]} changes={changes} fxKey={fxKey} outcome={outcomeOf(me)} shuffling={fx?.type === 'shuffle'} />;
  const combat = <CombatArea v={v} fx={fx} caption={pres.caption} fxKey={fxKey} changes={changes} />;
  const promptBar = pres.playing ? (
    <div className="prompt wait">
      <span>動畫播放中…</span>
      <div className="btns"><button onClick={skip}>跳過動畫</button></div>
    </div>
  ) : prompt ? (
    <PromptPanel prompt={prompt} selected={selected} onPick={toggle} onSubmit={(k) => session.submit(k)} />
  ) : (
    <div className="prompt wait">{waitingOpp ? '等待對手操作…' : v.winner !== null ? '遊戲結束' : '處理中…'}</div>
  );

  return (
    <InspectContext.Provider value={inspectCard}>
      <PinContext.Provider value={togglePin}>
      <div className={`battle${wide ? ' wide' : ''}`} style={{ ['--spd' as string]: scale }}>
        <div className="topbar">
          <span className="ver" title={VERSION_TITLE}>連擊大師 {VERSION_SHORT}</span>
          <b>第 {v.turn} 回合</b>
          <span className="phase">{v.phase}</span>
          <span className="muted">先攻：{v.first === me ? '你' : '對手'}</span>
          <span className="spacer" />
          {st.message && <span style={{ color: 'var(--bad)' }}>{st.message}</span>}
          {!wide && (
            <>
              <button className={drawer === 'inspect' ? 'on' : ''} aria-pressed={drawer === 'inspect'} onClick={() => setDrawer((d) => (d === 'inspect' ? null : 'inspect'))}>說明</button>
              <button className={drawer === 'log' ? 'on' : ''} aria-pressed={drawer === 'log'} onClick={() => setDrawer((d) => (d === 'log' ? null : 'log'))}>紀錄</button>
            </>
          )}
          {session.cheat && (
            <>
              <button className={cheatOn ? 'on' : ''} aria-pressed={cheatOn} title="開啟後可以隨意加入手牌、移除手牌、調整牌堆順序" onClick={() => session.cheat?.setOn(!cheatOn)}>作弊模式</button>
              {cheatOn && <button className={cheatOpen ? 'on' : ''} aria-pressed={cheatOpen} onClick={() => setCheatOpen(!cheatOpen)}>作弊面板</button>}
            </>
          )}
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
        {cheatOn && <div className="banner cheat">作弊模式開啟中：這一局的結果不具參考價值</div>}
        {st.cheatOn[opp] && <div className="banner cheat">對手開啟了作弊模式：對手可以調整雙方的牌區</div>}
        <div className="main">
          {wide ? (
            <div className={`board${pres.playing ? ' playing' : ''}`}>
              {oppBoard}
              <div className="midrow">
                <div className="sidecol">{inspectPanel}</div>
                {combat}
                <div className="sidecol"><LogPanel lines={v.log} /></div>
              </div>
              {promptBar}
              {myBoard}
            </div>
          ) : (
            <>
              <div className={`board${pres.playing ? ' playing' : ''}`}>
                {oppBoard}
                {combat}
                {myBoard}
                {promptBar}
              </div>
              {drawer && (
                <div className="drawer">
                  <div className="drawerhead">
                    <b>{drawer === 'inspect' ? '卡片說明' : '遊戲紀錄'}</b>
                    <button onClick={() => { setDrawer(null); setPinned(null); }}>關閉</button>
                  </div>
                  {drawer === 'inspect' ? inspectPanel : <LogPanel lines={v.log} />}
                </div>
              )}
            </>
          )}
        </div>

        {session.cheat && cheatOn && cheatOpen && v.winner === null && (
          <CheatPanel cheat={session.cheat} me={me} snapshotKey={final} locked={!pres.settled} onClose={() => setCheatOpen(false)} />
        )}
        <PhaseBanner fx={fx} n={fxKey} me={me} />
        <Spotlight fx={fx} caption={pres.caption} n={fxKey} scale={scale} />
        <FlightLayer view={v} fx={fx} playing={pres.playing} n={fxKey} scale={scale} />

        {zone && !(zone.z === 'rage' && zone.p !== me) && <ZoneViewer title={`${zone.p === me ? '我方' : '對手'}${ZONE_NAME[zone.z]}`} cards={zoneCards} exp={zone.z === 'exp'} anchor={zone.anchor} onClose={() => setZone(null)} />}

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
