import { useState } from 'react';
import { APP_BUILT_AT, VERSION_LABEL, VERSION_SHORT, VERSION_TITLE } from '../../version';
import { Modal } from '../components/Modal';
import { FLOW_CHART_URL } from '../flowChart';
import type { LobbyMode } from './Lobby';

export type Route = 'home' | 'decks' | LobbyMode;

export function Home({ go }: { go: (r: Route) => void }) {
  const [rules, setRules] = useState(false);
  return (
    <div className="page home">
      <h1>
        連擊大師 <span className="ver" title={VERSION_TITLE}>{VERSION_SHORT}</span>
      </h1>
      <div className="muted">以連擊值接力出招的 1v1 卡牌對戰</div>
      <div className="muted verline" title={VERSION_TITLE}>{VERSION_LABEL}　建置於 {APP_BUILT_AT}</div>
      <div className="menu">
        <button className="primary" onClick={() => go('host')}>建立房間（與朋友對戰）</button>
        <button onClick={() => go('join')}>加入房間</button>
        <button onClick={() => go('practice')}>單機練習（對戰機器人）</button>
        <button onClick={() => go('decks')}>組牌</button>
        <button onClick={() => setRules(true)}>規則說明</button>
        <a className="btnlink" href={FLOW_CHART_URL} target="_blank" rel="noreferrer">戰鬥流程圖</a>
      </div>
      {rules && (
        <Modal onClose={() => setRules(false)}>
          <div style={{ textAlign: 'left', maxWidth: 560, lineHeight: 1.7 }}>
            <h3>規則摘要</h3>
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              <li><b>生命值＝牌組張數。</b>牌組歸零者落敗；同時歸零比手牌，再比怒氣區翻牌的連擊值。</li>
              <li>每回合：重置 → 戰鬥 → 抽牌 → 爆發（手牌放經驗區抽 2）→ 增益（打出 1 張裝備／增益）→ 交換先後攻。</li>
              <li><b>戰鬥：</b>先攻方在先手步驟出 1 張招式；之後後攻先、輪流出招或收招。出招的連擊值必須落在「雙方最後一張招式連擊值之間（含）」；同一個連擊值在自己的戰鬥區最多 2 張，已經重複了就不能再出同值。<br />例：我 4、對方 5、我再 4、對方再 5，我還能出 5；這時對方的範圍是 5～5，但他已有 2 張 5，就不能出牌了。</li>
              <li><b>追擊：</b>雙方翻開牌組頂 1 張；連擊值<b>不在範圍內</b>就成功並成為追擊卡（算攻擊力），在範圍內則失敗、回到手中。</li>
              <li><b>傷害：</b>對手總攻擊 − 我方總防禦，就是我方要從牌組頂放進怒氣區的張數。</li>
              <li>招式打完會依序放進各自的經驗區。經驗區張數 ≥ 角色需求時進入<b>覺醒</b>。</li>
              <li>把滑鼠移到卡片上，右側會顯示完整說明。</li>
            </ul>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button onClick={() => setRules(false)}>關閉</button>
              <a className="btnlink" href={FLOW_CHART_URL} target="_blank" rel="noreferrer">看戰鬥流程圖</a>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
