import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyCheatParam } from './cheatUnlock';
import { applyTrackParam, startAnalytics } from './stats/analytics';
import { defaultUploader } from './stats/upload';
import { App } from './ui/App';
import './ui/styles.css';

// 作弊解鎖：網址帶參數時寫入或清除旗標，並把參數從網址列拿掉
try {
  const r = applyCheatParam(window.location.search);
  if (r.changed) window.history.replaceState(null, '', `${window.location.pathname}${r.search}${window.location.hash}`);
} catch {
  // 網址或歷史紀錄不能用：忽略，不影響進站
}

// 流量統計：網址帶 notrack 或 track 時關閉或恢復這個瀏覽器的統計，並把參數從網址列拿掉；之後登記這次造訪
try {
  const r = applyTrackParam(window.location.search);
  if (r.changed) window.history.replaceState(null, '', `${window.location.pathname}${r.search}${window.location.hash}`);
  startAnalytics();
} catch {
  // 統計是附屬功能：任何失敗都不影響進站
}

// 補傳上次沒傳成功的戰績（沒有設定伺服器時什麼都不做；任何失敗都不影響進站）
void defaultUploader().flush().catch(() => {});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
