import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { SPEED_LABEL, useSpeed, usePlayback, type Speed } from '../usePlayback';
import { VERSION_SHORT, VERSION_TITLE } from '../../version';
import { InspectContext, InspectPanel, PinContext } from '../components/CardFace';
import { COMBAT_LIST_NOTE, CombatArea, LogPanel, PlayerBoard, type ZoneKey } from '../components/Board';
import { FlightLayer } from '../components/FlightLayer';
import { PhaseBanner } from '../components/PhaseBanner';
import { Spotlight } from '../components/Spotlight';
import { FlowChartModal } from '../components/FlowChartModal';
import { Modal } from '../components/Modal';
import { ZoneViewer } from '../components/ZoneViewer';
import { StepTracker } from '../components/StepTracker';
import { stepHint } from '../../data/turnSteps';
import { combatCards } from '../../engine/view';
import { PromptPanel } from '../components/PromptPanel';
import { CheatPanel } from '../components/CheatPanel';
import { TutorialLayer } from '../components/TutorialLayer';
import { isCheatUnlocked } from '../../cheatUnlock';
import { useWide } from '../useWide';
import { usePhone } from '../layoutMode';
import { useCardDrag } from '../useCardDrag';
import { promptPlacement } from '../promptPlacement';
import { gatePrompt } from '../../tutorial/gate';
import { CardSheet, MyDock, OppBar, PhoneMenu, PromptSheet, Sheet, SheetBody } from '../components/PhoneBoard';
import { useOverlays } from '../useOverlays';
import type { Session } from '../../net/session';
import type { PlayerId } from '../../engine/types';

const noop = () => {};

const ZONE_NAME: Record<ZoneKey, string> = { discard: '棄牌區', exp: '經驗區', combat: '戰鬥區' };

export function Battle({ session, onExit }: { session: Session; onExit: () => void }) {
  const st = useSyncExternalStore(session.subscribe, session.getState);
  const wide = useWide();
  const phone = usePhone();
  const [selected, setSelected] = useState<string[]>([]);
  // exp：這張卡在經驗區且經驗效果生效中（說明欄多一行狀態）
  const [inspect, setInspect] = useState<{ id: string; exp: boolean } | null>(null);
  const inspectCard = useCallback((id: string | null, exp?: boolean) => setInspect(id ? { id, exp: !!exp } : null), []);
  const [copied, setCopied] = useState(false);
  // 作弊模式預設隱藏：瀏覽器裡有解鎖旗標才顯示開關與面板（對手開啟時的提示橫幅不受影響）
  const [cheatUnlocked] = useState(isCheatUnlocked);
  const cheatOnState = st.cheatOn[session.me];
  const [speed, setSpeed] = useSpeed();
  const final = st.view;
  const { presentation: pres, skip } = usePlayback(st.batch, final, speed);
  const { view: v, changes, fx, fxKey, scale } = pres;

  // 每次收到新狀態或換影格，就清掉上一個提示的選擇
  useEffect(() => setSelected([]), [final, fxKey]);

  // 手拿著的牌可以拖到提示指定的放置區直接使用（動畫播放中不啟用）
  // 教學封鎖所有操作：玩家看得到的提示只剩腳本要求的那張牌（每次繪製都換新物件，提示面板會當成換了提示，所以要記住）
  const tut = st.tutorial;
  const gated = useMemo(() => gatePrompt(tut, v?.prompt ?? null), [tut, v?.prompt]);
  const livePrompt = v && !pres.playing ? gated : null;
  const { api: drag, ghost: dragGhost } = useCardDrag(livePrompt, (keys) => session.submit(keys));

  // 提示物件每次收到狀態都可能是新的，內容沒變就不算換了提示；效果只看這個簽章，否則會一直重新設定面板而無限重繪
  const promptSig = livePrompt ? `${livePrompt.title}|${livePrompt.options.map((o) => o.key).join(',')}` : '';

  const overlays = useOverlays({
    isPhone: phone,
    isCombatEmpty: (p) => !!v && v.players[p].moves.length + v.players[p].pursuit.length === 0,
    promptSig,
    cheatOn: cheatOnState,
    onLayoutChange: () => setInspect(null),
  });

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
  const prompt = gated;
  // 教學中牌區與戰鬥區的列表都不能開
  const openZone = tut ? noop : overlays.openZone;
  const openSheet = tut ? noop : overlays.openSheet;
  const waitingOpp = !prompt && v.waitingFor === opp && v.winner === null;

  const toggle = (key: string) => {
    if (!prompt) return;
    if (prompt.min === 1 && prompt.max === 1) {
      session.submit([key]);
      return;
    }
    setSelected((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : cur.length < prompt.max ? [...cur, key] : cur));
  };

  const zoneCombat = overlays.zone?.z === 'combat' ? combatCards(v.players[overlays.zone.p]) : null;
  const zoneCards = !overlays.zone ? [] : zoneCombat ? zoneCombat.cards : v.players[overlays.zone.p][overlays.zone.z as 'exp' | 'discard'];
  // 結束演出播完（或跳過）才顯示結果視窗；演出期間先讓勝負在桌面上呈現
  const result = pres.playing || v.winner === null ? null : v.winner === 'draw' ? 'draw' : v.winner === me ? 'win' : 'lose';
  const outcomeOf = (p: PlayerId) => (v.winner === null ? undefined : v.winner === 'draw' ? 'draw' : v.winner === p ? 'win' : 'lose');
  const shown = overlays.pinned ?? inspect;
  const inspectPanel = <InspectPanel id={shown?.id ?? null} expActive={shown?.exp} pinned={overlays.pinned !== null} onUnpin={overlays.unpin} />;
  const oppBoard = <PlayerBoard v={v} p={opp} prompt={null} selected={[]} onPick={() => {}} onZone={openZone} hit={pres.hits[opp]} changes={changes} fxKey={fxKey} outcome={outcomeOf(opp)} shuffling={fx?.type === 'shuffle'} />;
  const myBoard = <PlayerBoard v={v} p={me} prompt={prompt} selected={selected} onPick={toggle} drag={drag} onZone={openZone} hit={pres.hits[me]} changes={changes} fxKey={fxKey} outcome={outcomeOf(me)} shuffling={fx?.type === 'shuffle'} />;
  const combat = <CombatArea v={v} fx={fx} caption={pres.caption} fxKey={fxKey} changes={changes} hint={phone ? stepHint(v.phase, v.waitingFor, me) : undefined}
    onOpen={(p, anchor) => (phone ? openSheet({ p, tab: 'combat' }) : openZone(p, 'combat', anchor))} />;
  // 手機版面：選項已經在手牌列上了，提示欄不再重複畫一次手牌
  const handUids = phone ? new Set(v.players[me].hand.map((c) => c.uid)) : undefined;
  const oppBar = <OppBar v={v} p={opp} changes={changes} fxKey={fxKey} hit={pres.hits[opp]} outcome={outcomeOf(opp)} onOpen={openSheet} />;
  const myDock = (
    <MyDock
      v={v} p={me} changes={changes} fxKey={fxKey} hit={pres.hits[me]} outcome={outcomeOf(me)} onOpen={openSheet}
      prompt={prompt} selected={selected} onPick={toggle} drag={drag} shuffling={fx?.type === 'shuffle'}
    />
  );
  const placement = promptPlacement(v, prompt);
  const waitText = waitingOpp ? '等待對手操作…' : v.winner !== null ? '遊戲結束' : tut && v.waitingFor === me ? '請依照說明操作' : '處理中…';
  const promptPanel = (skipHand?: Set<number>) =>
    prompt && <PromptPanel prompt={prompt} selected={selected} onPick={toggle} onSubmit={(k) => session.submit(k)} skipUids={skipHand} />;
  const promptBarOf = (skipHand?: Set<number>) => pres.playing ? (
    <div className="prompt wait">
      <span>動畫播放中…</span>
      {!tut && <div className="btns"><button onClick={skip}>跳過動畫</button></div>}
    </div>
  ) : prompt ? (
    promptPanel(skipHand)
  ) : (
    <div className="prompt wait">{waitText}</div>
  );
  // 手機版面的提示欄：固定高度，播放動畫時留白（不提供跳過）；放不下的提示改由牌區面板或底部提示面板承接
  const phoneBar = pres.playing ? null : !prompt ? (
    <div className="prompt wait">{waitText}</div>
  ) : placement === 'bar' ? (
    promptPanel(handUids)
  ) : (
    <div className="prompt wait"><span>請在面板中選擇</span></div>
  );

  return (
    <InspectContext.Provider value={inspectCard}>
      <PinContext.Provider value={overlays.togglePin}>
      <div className={`battle${wide ? ' wide' : ' phone'}${tut ? ' tutorial' : ''}`} style={{ ['--spd' as string]: scale }}>
        <div className="topbar">
          <span className="ver" title={VERSION_TITLE}>連擊大師 {VERSION_SHORT}</span>
          <b>第 {v.turn} 回合</b>
          <span className="phase">{v.phase}</span>
          {!phone && <span className="muted">先攻：{v.first === me ? '你' : '對手'}</span>}
          <span className="spacer" />
          {st.message && <span style={{ color: 'var(--bad)' }}>{st.message}</span>}
          {phone ? (
            <PhoneMenu
              open={overlays.menuOpen} onToggle={overlays.toggleMenu} onClose={overlays.closeMenu}
              speed={speed} onSpeed={setSpeed} onLog={overlays.openLog} onFlow={overlays.openFlow} onLeave={leave} locked={!!tut}
              cheat={session.cheat && cheatUnlocked ? { on: cheatOn, panelOpen: overlays.cheatOpen, onToggle: () => session.cheat?.setOn(!cheatOn), onPanel: overlays.toggleCheat } : undefined}
            />
          ) : (
            <>
              {session.cheat && cheatUnlocked && (
                <>
                  <button className={cheatOn ? 'on' : ''} aria-pressed={cheatOn} title="開啟後可以隨意加入手牌、移除手牌，調整、刪除、新增牌堆的卡，以及翻面經驗卡" onClick={() => session.cheat?.setOn(!cheatOn)}>作弊模式</button>
                  {cheatOn && <button className={overlays.cheatOpen ? 'on' : ''} aria-pressed={overlays.cheatOpen} onClick={overlays.toggleCheat}>作弊面板</button>}
                </>
              )}
              {!tut && <button title="開啟戰鬥流程圖" onClick={overlays.openFlow}>流程圖</button>}
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
              {overlays.logOpen && (
                <div className="drawer">
                  <div className="drawerhead">
                    <b>遊戲紀錄</b>
                    <button onClick={overlays.closeLog}>關閉</button>
                  </div>
                  <LogPanel lines={v.log} />
                </div>
              )}
            </>
          )}
        </div>

        {session.cheat && cheatUnlocked && cheatOn && overlays.cheatOpen && v.winner === null && (
          <CheatPanel cheat={session.cheat} me={me} snapshotKey={final} locked={!pres.settled} onClose={overlays.closeCheat} />
        )}
        {phone && overlays.sheet && !result && (
          <Sheet v={v} target={overlays.sheet} onClose={overlays.closeSheet}>
            <SheetBody v={v} target={overlays.sheet} fxKey={fxKey} changes={changes} />
          </Sheet>
        )}
        {phone && overlays.cardSheet && !result && <CardSheet id={overlays.cardSheet.id} exp={overlays.cardSheet.exp} onClose={overlays.closeCardSheet} />}
        {phone && !result && !pres.playing && prompt && placement === 'panel' && <PromptSheet>{promptPanel()}</PromptSheet>}
        {dragGhost}
        <PhaseBanner fx={fx} n={fxKey} me={me} />
        <Spotlight fx={fx} caption={pres.caption} n={fxKey} scale={scale} />
        <FlightLayer view={v} fx={fx} playing={pres.playing} n={fxKey} scale={scale} extraPile={phone ? (owner, z) => z === 'exp' || z === 'gear' || z === 'buff' || (owner !== me && z === 'hand') : undefined} />

        {st.tutorial && <TutorialLayer progress={st.tutorial} view={v} active={pres.settled} onNext={() => session.advance?.()} />}

        {overlays.flowOpen && <FlowChartModal phase={v.phase} onClose={overlays.closeFlow} />}
        {overlays.zone && <ZoneViewer title={`${overlays.zone.p === me ? '我方' : '對手'}${ZONE_NAME[overlays.zone.z]}`} cards={zoneCards} exp={overlays.zone.z === 'exp'} pursuitFrom={zoneCombat?.pursuitFrom} note={zoneCombat ? COMBAT_LIST_NOTE : undefined} anchor={overlays.zone.anchor as DOMRect} onClose={overlays.closeZone} />}

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
