import { useRef, useState } from 'react';
import { createTapCounter, isCheatUnlocked, setCheatUnlocked } from '../../cheatUnlock';
import { APP_BUILT_AT, VERSION_LABEL, VERSION_SHORT, VERSION_TITLE } from '../../version';
import { ChangelogModal } from '../components/ChangelogModal';
import { FlowChartModal } from '../components/FlowChartModal';
import { Modal } from '../components/Modal';
import type { LobbyMode } from './Lobby';

export type Route = 'home' | 'decks' | 'records' | LobbyMode;

export function Home({ go }: { go: (r: Route) => void }) {
  const [rules, setRules] = useState(false);
  const [changelog, setChangelog] = useState(false);
  const [flow, setFlow] = useState(false);
  // 連點版本號那一行是作弊解鎖的備用入口；已經解鎖時只提示，不重複解鎖
  const taps = useRef(createTapCounter());
  const [note, setNote] = useState('');
  const tapVersion = () => {
    if (!taps.current.tap(Date.now())) return;
    if (isCheatUnlocked()) {
      setNote('作弊模式已經解鎖');
    } else {
      setCheatUnlocked(true);
      setNote(isCheatUnlocked() ? '作弊模式已解鎖' : '無法儲存解鎖狀態');
    }
    window.setTimeout(() => setNote(''), 2500);
  };
  return (
    <div className="page home">
      <h1>
        連擊大師 <button className="ver verbtn" title={`${VERSION_TITLE}\n點一下看更新日誌`} onClick={() => setChangelog(true)}>{VERSION_SHORT}</button>
      </h1>
      <div className="muted">以連擊值接力出招的 1v1 卡牌對戰</div>
      <div className="muted verline" title={VERSION_TITLE} onClick={tapVersion}>{note || `${VERSION_LABEL}　建置於 ${APP_BUILT_AT}`}</div>
      <div className="menu">
        <button className="primary" onClick={() => go('host')}>建立房間（與朋友對戰）</button>
        <button onClick={() => go('join')}>加入房間</button>
        <button onClick={() => go('practice')}>單機練習（對戰機器人）</button>
        <button onClick={() => go('decks')}>組牌</button>
        <button onClick={() => go('records')}>戰績</button>
        <button onClick={() => setRules(true)}>規則說明</button>
        <button onClick={() => setChangelog(true)}>更新日誌</button>
        <button onClick={() => setFlow(true)}>戰鬥流程圖</button>
      </div>
      {changelog && <ChangelogModal onClose={() => setChangelog(false)} />}
      {flow && <FlowChartModal onClose={() => setFlow(false)} />}
      {rules && (
        <Modal onClose={() => setRules(false)}>
          <div style={{ textAlign: 'left', maxWidth: 560, lineHeight: 1.7 }}>
            <h3>規則摘要</h3>
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              <li><b>生命值＝牌組張數。</b>牌組歸零者落敗；同時歸零比手牌，手牌多者勝，相同則平手。</li>
              <li>每回合：回合開始 → 抽牌 → 爆發（手牌放經驗區抽 2）→ 增益（打出 1 張裝備／增益）→ 戰鬥 → 回合結束（交換先後攻）。第 1 回合略過抽牌與爆發。</li>
              <li><b>戰鬥：</b>先攻方在先手步驟出 1 張招式；之後後攻先、輪流出招或收招。出招的連擊值必須落在「雙方最後一張招式連擊值之間（含）」；自己的招式卡疊只能出現一次重複：同一個連擊值打出第 2 張可以，之後招式卡疊裡已有的連擊值都不能再出。<br />例：我 4、對方 5、我再 4、對方再 5，我還能出 5（對我是新的連擊值）；這時對方的範圍是 5～5，但他已經重複過、5 又已在招式卡疊，就不能出牌了。</li>
              <li><b>追擊：</b>雙方都有出招才進行：各翻開牌組頂 1 張；連擊值<b>不在範圍內</b>就成功並成為追擊卡（算攻擊力），在範圍內則失敗、回到手中。只要有一方沒有招式，就不追擊。</li>
              <li><b>傷害：</b>對手總攻擊 − 我方總防禦，就是我方要從牌組頂放進怒氣區的張數。</li>
              <li>招式打完會依序放進各自的經驗區。經驗區張數 ≥ 角色需求時進入<b>覺醒</b>。</li>
              <li>把滑鼠移到卡片上，右側會顯示完整說明。</li>
            </ul>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button onClick={() => setRules(false)}>關閉</button>
              <button onClick={() => { setRules(false); setFlow(true); }}>看戰鬥流程圖</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
