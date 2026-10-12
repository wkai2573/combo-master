import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { SPEED_LABEL, useSpeed, usePlayback, type Speed } from '../usePlayback';
import { VERSION_SHORT, VERSION_TITLE } from '../../version';
import { InspectContext, InspectPanel, PinContext } from '../components/CardFace';
import { CombatArea, LogPanel, PlayerBoard, type ZoneKey } from '../components/Board';
import { FlightLayer } from '../components/FlightLayer';
import { PhaseBanner } from '../components/PhaseBanner';
import { Spotlight } from '../components/Spotlight';
import { FlowChartModal } from '../components/FlowChartModal';
import { Modal } from '../components/Modal';
import { ZoneViewer } from '../components/ZoneViewer';
import { StepTracker } from '../components/StepTracker';
import { stepHint } from '../../data/turnSteps';
import { PromptPanel } from '../components/PromptPanel';
import { CheatPanel } from '../components/CheatPanel';
import { isCheatUnlocked } from '../../cheatUnlock';
import { useWide } from '../useWide';
import { usePhone } from '../layoutMode';
import { useCardDrag } from '../useCardDrag';
import { promptPlacement, promptSheet } from '../promptSheet';
import { CardSheet, MyDock, OppBar, PhoneMenu, PromptSheet, Sheet, SheetBody, type SheetTarget } from '../components/PhoneBoard';
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
  // 手機版面沒有固定說明：點不能操作的卡，從底部滑出那張的說明；其他版面維持固定／取消固定
  const [cardSheet, setCardSheet] = useState<{ id: string; exp: boolean } | null>(null);
  const phone = usePhone();
  const phoneRef = useRef(phone);
  phoneRef.current = phone;
  const togglePin = useCallback((id: string, exp?: boolean) => {
    if (phoneRef.current) setCardSheet({ id, exp: !!exp });
    else setPinned((p) => (p?.id === id && p.exp === !!exp ? null : { id, exp: !!exp }));
  }, []);
  const closeCardSheet = useCallback(() => setCardSheet(null), []);
  const [menuOpen, setMenuOpen] = useState(false);
  // 手機版面：遊戲紀錄收成可開關的抽屜（從頂列選單打開）
  const [logOpen, setLogOpen] = useState(false);
  const [zone, setZone] = useState<{ p: PlayerId; z: ZoneKey; anchor: DOMRect } | null>(null);
  const zoneRef = useRef(zone);
  zoneRef.current = zone;
  const menuRef = useRef(menuOpen);
  menuRef.current = menuOpen;
  const cardSheetRef = useRef(cardSheet);
  cardSheetRef.current = cardSheet;
  // 手機版面：從底部滑出的面板，看角色效果或某個牌區；autoSheet 表示是提示要在面板裡選牌而自動打開的
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const sheetRef = useRef(sheet);
  sheetRef.current = sheet;
  const autoSheet = useRef(false);
  const [copied, setCopied] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);
  // 作弊模式：開關記在連線層（對方才看得到提示），離開或下一局都會回到關閉；面板的開合只是這個畫面的事
  const [cheatOpen, setCheatOpen] = useState(false);
  // 作弊模式預設隱藏：瀏覽器裡有解鎖旗標才顯示開關與面板（對手開啟時的提示橫幅不受影響）
  const [cheatUnlocked] = useState(isCheatUnlocked);
  const cheatOpenRef = useRef(cheatOpen);
  cheatOpenRef.current = cheatOpen;
  // 面板跟著連線層確認過的開關走：開啟被確認才打開，關閉就收起（房主沒回應或遊戲已結束時不會憑空彈出）
  const cheatOnState = st.cheatOn[session.me];
  useEffect(() => setCheatOpen(cheatOnState), [cheatOnState]);
  const [speed, setSpeed] = useSpeed();
  const final = st.view;
  const { presentation: pres, skip } = usePlayback(st.batch, final, speed);
  const { view: v, changes, fx, fxKey, scale } = pres;

  // 版面在寬螢幕版與手機版面之間切換：各版面專屬的面板與抽屜收起，免得換回來時殘留看不到的狀態（對局狀態不受影響）
  const layoutKey = wide ? 'wide' : 'phone';
  const lastLayout = useRef(layoutKey);
  useEffect(() => {
    if (lastLayout.current === layoutKey) return;
    lastLayout.current = layoutKey;
    autoSheet.current = false;
    setSheet(null);
    setZone(null);
    setLogOpen(false);
    setPinned(null);
    setInspect(null);
    setCardSheet(null);
    setMenuOpen(false);
  }, [layoutKey]);

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
      else if (menuRef.current) setMenuOpen(false);
      else if (cardSheetRef.current) setCardSheet(null);
      else if (sheetRef.current) setSheet(null);
      else if (cheatOpenRef.current) setCheatOpen(false);
      else {
        setPinned(null);
        setLogOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 每次收到新狀態或換影格，就清掉上一個提示的選擇
  useEffect(() => setSelected([]), [final, fxKey]);

  // 手拿著的牌可以拖到提示指定的放置區直接使用（動畫播放中不啟用）
  const livePrompt = v && !pres.playing ? v.prompt : null;
  const { api: drag, ghost: dragGhost } = useCardDrag(livePrompt, (keys) => session.submit(keys));

  // 提示物件每次收到狀態都可能是新的，內容沒變就不算換了提示；效果只看這個簽章，否則會一直重新設定面板而無限重繪
  const promptSig = livePrompt ? `${livePrompt.title}|${livePrompt.options.map((o) => o.key).join(',')}` : '';
  // 手機版面：提示要選的牌在牌區（經驗區等）裡時，自動打開那個牌區的面板；提示換掉就收回
  useEffect(() => {
    if (!phone || !v) return;
    const found = promptSheet(v, livePrompt);
    const panel = promptPlacement(v, livePrompt) === 'panel';
    const handOpt = !!livePrompt && livePrompt.options.some((o) => v.players[v.me].hand.some((c) => c.uid === o.uid));
    if (found) {
      autoSheet.current = true;
      setSheet((cur) => (cur && cur.p === found.p && cur.tab === found.tab ? cur : found));
    } else if (autoSheet.current || (sheetRef.current && (handOpt || panel))) {
      // 自動打開的面板用完收回；手動打開的面板會擋住手牌或提示面板，要選手牌、或提示改用底部面板時也收起來
      autoSheet.current = false;
      setSheet(null);
    }
    // 只在提示換了時判斷；影格更新同一個提示不必重開
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptSig, phone]);

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
  const result = pres.playing || v.winner === null ? null : v.winner === 'draw' ? 'draw' : v.winner === me ? 'win' : 'lose';
  const outcomeOf = (p: PlayerId) => (v.winner === null ? undefined : v.winner === 'draw' ? 'draw' : v.winner === p ? 'win' : 'lose');
  const shown = pinned ?? inspect;
  const inspectPanel = <InspectPanel id={shown?.id ?? null} expActive={shown?.exp} pinned={pinned !== null} onUnpin={() => setPinned(null)} />;
  const oppBoard = <PlayerBoard v={v} p={opp} prompt={null} selected={[]} onPick={() => {}} onZone={(p, z, anchor) => setZone({ p, z, anchor })} hit={pres.hits[opp]} changes={changes} fxKey={fxKey} outcome={outcomeOf(opp)} shuffling={fx?.type === 'shuffle'} />;
  const myBoard = <PlayerBoard v={v} p={me} prompt={prompt} selected={selected} onPick={toggle} drag={drag} onZone={(p, z, anchor) => setZone({ p, z, anchor })} hit={pres.hits[me]} changes={changes} fxKey={fxKey} outcome={outcomeOf(me)} shuffling={fx?.type === 'shuffle'} />;
  const combat = <CombatArea v={v} fx={fx} caption={pres.caption} fxKey={fxKey} changes={changes} hint={phone ? stepHint(v.phase, v.waitingFor, me) : undefined} />;
  // 手機版面：選項已經在手牌列上了，提示欄不再重複畫一次手牌
  const handUids = phone ? new Set(v.players[me].hand.map((c) => c.uid)) : undefined;
  const oppBar = <OppBar v={v} p={opp} changes={changes} fxKey={fxKey} hit={pres.hits[opp]} outcome={outcomeOf(opp)} onOpen={setSheet} />;
  const myDock = (
    <MyDock
      v={v} p={me} changes={changes} fxKey={fxKey} hit={pres.hits[me]} outcome={outcomeOf(me)} onOpen={setSheet}
      prompt={prompt} selected={selected} onPick={toggle} drag={drag} shuffling={fx?.type === 'shuffle'}
    />
  );
  const placement = promptPlacement(v, prompt);
  const waitText = waitingOpp ? '等待對手操作…' : v.winner !== null ? '遊戲結束' : '處理中…';
  const promptPanel = (skipHand?: Set<number>) =>
    prompt && <PromptPanel prompt={prompt} selected={selected} onPick={toggle} onSubmit={(k) => session.submit(k)} skipUids={skipHand} />;
  const promptBarOf = (skipHand?: Set<number>) => pres.playing ? (
    <div className="prompt wait">
      <span>動畫播放中…</span>
      <div className="btns"><button onClick={skip}>跳過動畫</button></div>
    </div>
  ) : prompt ? (
    promptPanel(skipHand)
  ) : (
    <div className="prompt wait">{waitText}</div>
  );
  // 手機版面的提示欄：固定高度，播放動畫時留白（不提供跳過）；放不下的提示改由牌區面板或底部提示面板承接
  const zoneTarget = prompt ? promptSheet(v, prompt) : null;
  const phoneBar = pres.playing ? null : !prompt ? (
    <div className="prompt wait">{waitText}</div>
  ) : placement === 'bar' ? (
    promptPanel(handUids)
  ) : (
    <div className="prompt wait">
      <span>{placement === 'zone' ? '要選的牌在牌區裡' : '請在面板中選擇'}</span>
      {placement === 'zone' && !sheet && zoneTarget && <div className="btns"><button className="primary" onClick={() => setSheet(zoneTarget)}>打開牌區</button></div>}
    </div>
  );

  return (
    <InspectContext.Provider value={inspectCard}>
      <PinContext.Provider value={togglePin}>
      <div className={`battle${wide ? ' wide' : ' phone'}`} style={{ ['--spd' as string]: scale }}>
        <div className="topbar">
          <span className="ver" title={VERSION_TITLE}>連擊大師 {VERSION_SHORT}</span>
          <b>第 {v.turn} 回合</b>
          <span className="phase">{v.phase}</span>
          {!phone && <span className="muted">先攻：{v.first === me ? '你' : '對手'}</span>}
          <span className="spacer" />
          {st.message && <span style={{ color: 'var(--bad)' }}>{st.message}</span>}
          {phone ? (
            <PhoneMenu
              open={menuOpen} onToggle={() => setMenuOpen((o) => !o)} onClose={() => setMenuOpen(false)}
              speed={speed} onSpeed={setSpeed} onLog={() => setLogOpen(true)} onFlow={() => setFlowOpen(true)} onLeave={leave}
              cheat={session.cheat && cheatUnlocked ? { on: cheatOn, panelOpen: cheatOpen, onToggle: () => session.cheat?.setOn(!cheatOn), onPanel: () => setCheatOpen(!cheatOpen) } : undefined}
            />
          ) : (
            <>
              {session.cheat && cheatUnlocked && (
                <>
                  <button className={cheatOn ? 'on' : ''} aria-pressed={cheatOn} title="開啟後可以隨意加入手牌、移除手牌，調整、刪除、新增牌堆的卡，以及翻面經驗卡" onClick={() => session.cheat?.setOn(!cheatOn)}>作弊模式</button>
                  {cheatOn && <button className={cheatOpen ? 'on' : ''} aria-pressed={cheatOpen} onClick={() => setCheatOpen(!cheatOpen)}>作弊面板</button>}
                </>
              )}
              <button title="開啟戰鬥流程圖" onClick={() => setFlowOpen(true)}>流程圖</button>
              <select value={speed} onChange={(e) => setSpeed(e.target.value as Speed)} title="動畫速度">
                {(Object.keys(SPEED_LABEL) as Speed[]).map((s) => <option key={s} value={s}>{SPEED_LABEL[s]}</option>)}
              </select>
              <button className="danger" onClick={leave}>離開</button>
            </>
          )}
        </div>
        {!phone && <StepTracker phase={v.phase} waitingFor={v.waitingFor} me={me} />}
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
              {promptBarOf(handUids)}
              {myBoard}
            </div>
          ) : (
            <>
              <div className={`board${pres.playing ? ' playing' : ''}`}>
                {oppBar}
                {combat}
                {myDock}
                <div className="promptslot">{phoneBar}</div>
              </div>
              {logOpen && (
                <div className="drawer">
                  <div className="drawerhead">
                    <b>遊戲紀錄</b>
                    <button onClick={() => setLogOpen(false)}>關閉</button>
                  </div>
                  <LogPanel lines={v.log} />
                </div>
              )}
            </>
          )}
        </div>

        {session.cheat && cheatUnlocked && cheatOn && cheatOpen && v.winner === null && (
          <CheatPanel cheat={session.cheat} me={me} snapshotKey={final} locked={!pres.settled} onClose={() => setCheatOpen(false)} />
        )}
        {phone && sheet && !result && (
          <Sheet v={v} target={sheet} onTab={(tab) => setSheet({ ...sheet, tab })} onClose={() => { autoSheet.current = false; setSheet(null); }} footer={pres.playing ? null : prompt ? promptPanel() : <div className="prompt wait">{waitText}</div>}>
            <SheetBody v={v} target={sheet} optKeys={new Set(prompt?.options.map((o) => o.key) ?? [])} selected={selected} single={prompt?.min === 1 && prompt?.max === 1} onPick={toggle} fxKey={fxKey} changes={changes} />
          </Sheet>
        )}
        {phone && cardSheet && !result && <CardSheet id={cardSheet.id} exp={cardSheet.exp} onClose={closeCardSheet} />}
        {phone && !result && !pres.playing && prompt && placement === 'panel' && <PromptSheet>{promptPanel()}</PromptSheet>}
        {dragGhost}
        <PhaseBanner fx={fx} n={fxKey} me={me} />
        <Spotlight fx={fx} caption={pres.caption} n={fxKey} scale={scale} />
        <FlightLayer view={v} fx={fx} playing={pres.playing} n={fxKey} scale={scale} extraPile={phone ? (owner, z) => z === 'exp' || z === 'gear' || z === 'buff' || (owner !== me && z === 'hand') : undefined} />

        {flowOpen && <FlowChartModal phase={v.phase} onClose={() => setFlowOpen(false)} />}
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
