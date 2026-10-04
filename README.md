# 連擊大師

以連擊值接力出招的 1v1 TCG（網頁版）。規則見 `docs/連擊大師.md`，實作時的規則解讀見 `docs/規則詮釋.md`。

## 指令

```
npm install
npm run dev        # 開發伺服器（預設 http://localhost:5173）
npm test           # 單元測試（規則、卡片效果、牌組驗證）
npm run sim 40     # 機器人壓測：每種角色組合各打 40 局，檢查卡死與例外
npm run data       # 修改 docs/連擊大師.xlsx 後，重新產生 src/data/generated/*.json
npm run build      # 型別檢查＋打包
```

## 與朋友連線

1. 一人按「建立房間」，取得 6 碼房號。
2. 另一人按「加入房間」，輸入房號。
3. 房主的瀏覽器執行遊戲規則，對方只傳送選擇、接收畫面。

兩人必須能連到公開的 PeerJS broker；要讓朋友從外網連進來，需要把 `npm run build` 的 `dist/` 放到任何靜態網站空間。

## 結構

- `src/engine/`：規則引擎（不依賴介面與網路）。`game.ts` 回合流程、`combat.ts` 戰鬥、`scripts.ts` 各卡效果、`win.ts` 勝負。
- `src/data/`：卡表（由 xlsx 產生）、職業歸屬、預設牌組。
- `src/deck/`：牌組驗證與儲存。
- `src/net/`：PeerJS 連線與單機練習。
- `src/ui/`：畫面。
