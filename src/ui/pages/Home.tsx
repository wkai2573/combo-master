import { useState } from 'react';
import { Modal } from '../components/Modal';
import type { LobbyMode } from './Lobby';

export type Route = 'home' | 'decks' | LobbyMode;

export function Home({ go }: { go: (r: Route) => void }) {
  const [rules, setRules] = useState(false);
  return (
    <div className="page home">
      <h1>連擊大師</h1>
      <div className="muted">以連擊值接力出招的 1v1 卡牌對戰</div>
      <div className="menu">
        <button className="primary" onClick={() => go('host')}>建立房間（與朋友對戰）</button>
        <button onClick={() => go('join')}>加入房間</button>
        <button onClick={() => go('practice')}>單機練習（對戰機器人）</button>
        <button onClick={() => go('decks')}>組牌</button>
        <button onClick={() => setRules(true)}>規則說明</button>
      </div>
      {rules && (
        <Modal onClose={() => setRules(false)}>
          <div style={{ textAlign: 'left', maxWidth: 560, lineHeight: 1.7 }}>
            <h3>規則摘要</h3>
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              <li><b>生命值＝牌組張數。</b>牌組歸零者落敗；同時歸零比手牌，再比怒氣區翻牌的連擊值。</li>
              <li>每回合：重置 → 戰鬥 → 抽牌 → 爆發（手牌放經驗區抽 1）→ 增益（打出 1 張裝備／增益）→ 交換先後攻。</li>
              <li><b>戰鬥：</b>先攻起手出 1 張招式；之後後攻先、輪流出招或收招。出招的連擊值必須落在「雙方最後一張招式連擊值之間」，且不能和自己已出的連擊值重複。</li>
              <li><b>追擊：</b>雙方翻開牌組頂 1 張；連擊值<b>不在範圍內</b>就成功並成為追擊卡（算攻擊力），在範圍內則失敗、回到手中。</li>
              <li><b>傷害：</b>對手總攻擊 − 我方總防禦，就是我方要從牌組頂放進怒氣區的張數。</li>
              <li>招式打完會依序放進各自的經驗區。經驗區張數 ≥ 角色需求時進入<b>覺醒</b>。</li>
              <li>把滑鼠移到卡片上，右側會顯示完整說明。</li>
            </ul>
            <div style={{ marginTop: 12 }}><button onClick={() => setRules(false)}>關閉</button></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
