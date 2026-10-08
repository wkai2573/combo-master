# 連擊大師

以連擊值接力出招的 1v1 TCG（網頁版）。規則見 `docs/連擊大師.md`，實作時的規則解讀見 `docs/規則詮釋.md`。

## 線上玩

https://wkai2573.github.io/combo-master/

分頁標題、首頁與對戰畫面都會顯示版本（例如 `v0.2.0`；首頁另有 commit 代碼與建置時間，`+` 表示有未提交的變更），用來確認看到的是不是新版。版本號在 `package.json`，每次更新時調整。

推送到 `main` 後，GitHub Actions 會自動跑測試、建置並部署到 GitHub Pages（設定在 `.github/workflows/deploy.yml`）。

## 戰鬥流程圖

`public/battle-flow.html` 是可互動的回合與戰鬥流程圖（可縮放、追蹤路徑），會隨網站一起部署；遊戲首頁、規則說明和對戰畫面上方的「流程圖」都能開啟（新分頁）。它由 [Archify](https://github.com/tt-a1i/archify) 產生，來源在 `docs/戰鬥流程圖.source.json`；規則改了之後，用 Claude Code 的 `archify` 技能依這份來源修改並重新產生即可。

## 指令

```
npm install
npm run dev        # 開發伺服器（預設 http://localhost:5173）
npm test           # 單元測試（規則、卡片效果、牌組驗證）
npm run sim 40     # 機器人壓測：每種角色組合各打 40 局，檢查卡死與例外
npm run presets    # 列出各角色預設牌組的連擊值分佈與平均攻守
npm run data       # 修改 docs/連擊大師.xlsx 後，重新產生 src/data/generated/*.json
npm run build      # 型別檢查＋打包
```

## 卡表網頁與數值同步

卡片、角色的數值在「連擊大師卡表」網頁（Claude 的 Artifact，只有擁有者能開）上調整，可以新增卡片。調完請 Claude 同步：Claude 用 `ArtifactData` 把資料讀成 JSON，再執行 `npm run table -- <資料夾>`，產生 `src/data/cardTable.json`（既有卡的數值覆蓋、角色數值、新增的卡）。`src/data/cards.ts` 會把它疊在 xlsx 產生的資料上，所以重跑 `npm run data` 不會洗掉。

卡表頁面標題旁有頁面版本（例如 `v1.2`），下方顯示「遊戲已同步到 vX.Y.Z」，那是每次同步後由 Claude 寫進資料庫的 `meta/sync`；頁面上「尚未同步的改動」就是還沒進遊戲的數值。

卡表有「關鍵字」分頁：名稱、分類、說明。卡片與角色文字只用 `【名稱】` 或 `[標籤]` 引用關鍵字（例如遊俠只寫「獲得【瞄準】」），完整說明寫在關鍵字區塊；遊戲裡滑過卡片文字中的關鍵字會浮出說明，側欄的詳細視窗也會列出。對戰與組牌時，右鍵點卡片（或點一下不能操作的卡）可以固定詳細視窗，按 Esc 或「取消固定」解除。

效果文字不會自動套用：新描述要先由 Claude 跟你確認用語（格式「時機｜條件→效果」），確認後才寫進程式與實作效果。

## 效果卡（逐張開放）

為了先把基本對戰調順，效果卡逐張開放：目前是 36 張花色招式＋各職業的新卡 25 張＋裝備 5 張（清單與解讀見 `docs/規則詮釋.md`）。要加新卡，見 `docs/規則詮釋.md` 第三節的流程（核心是 `src/data/enabledCards.ts` 的 `ENABLED_EFFECT_CARDS`）。

## 與朋友連線

1. 一人按「建立房間」，取得 6 碼房號。
2. 另一人按「加入房間」，輸入房號。
3. 房主的瀏覽器執行遊戲規則，對方只傳送選擇、接收畫面。

兩人必須能連到公開的 PeerJS broker。兩人各自開上面的線上網址即可對戰；本機 `npm run dev` 只有同一台電腦或同網段能連。

## 結構

- `src/engine/`：規則引擎（不依賴介面與網路）。`game.ts` 回合流程、`combat.ts` 戰鬥、`scripts.ts` 各卡效果、`win.ts` 勝負。
- `src/data/`：卡表（花色招式與角色來自 xlsx，其餘由卡表網頁同步）、預設牌組。
- `src/deck/`：牌組驗證與儲存。
- `src/net/`：PeerJS 連線與單機練習。
- `src/ui/`：畫面。
