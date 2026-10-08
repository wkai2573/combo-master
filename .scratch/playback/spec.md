Status: resolved

# 播放：讓播放模組直接交出「呈現」

## 問題陳述

「播放中到底該顯示哪個桌面」的規則拆在兩處：

- `src/ui/usePlayback.ts` 只負責排影格與計時，交出 `cur`、`skip`、`scale`、`lagging`。
- `src/ui/pages/Battle.tsx` 再用這四個值自己拼出桌面：播放中取影格當下的桌面、空檔維持上一桌、空檔且沒有上一桌時取新批次的第一格、否則取最新真實狀態。數值變化、`lastShown`、結果視窗的時機、傷害震動的延遲也都在這裡。

造成：

- 空檔閃出最終桌面這類問題只能在畫面上看，沒有任何測試能抓；`usePlayback` 目前只測了 `initialSpeed`。
- Battle 與播放模組互相依賴對方的內部細節，改一邊要同時想另一邊。
- 速度偏好的讀寫在 Battle，`initialSpeed` 卻在 `usePlayback.ts`。

## 解決方案

詞彙見 `GLOSSARY.md` 的「呈現」「影格」「卡片飛行」。

新增沒有計時器的純狀態機 `src/ui/playback.ts`：持有影格佇列與播放狀態，回傳「呈現」。`usePlayback` 變成薄 hook，只負責 `setTimeout` 與生命週期。Battle 只剩排版。

### 介面草圖

```ts
interface Presentation {
  view: GameView | null     // 此刻該顯示的桌面
  changes?: StatChanges     // 這一格相對上一個顯示的桌面；換格時算一次，開局抽牌不算
  fx?: FrameFx
  fxKey: number             // 第幾個播放的影格，同一種特效要能重播
  caption?: string
  hits: [Hit | undefined, Hit | undefined]   // 傷害震動，延遲已乘上速度
  playing: boolean          // 有一個影格正在播
  settled: boolean          // 播完且沒有空檔；既不在播也不是播完就是空檔
  scale: number
}

class Playback {
  readonly version: number            // 內部狀態每改變一次加一，呈現依賴它重算
  ingest(batch, speed): number | null // 新批次進佇列，速度關閉時丟棄；若因此開始播第一格，回傳停留毫秒
  advance(speed): number | null       // 計時到了，換下一格並算出這一格的數值變化；回傳停留毫秒，佇列空了回 null
  skip(): void
  reset(): void                       // 卸載時重置，重新掛載會重播同一批
  present(batch, final, speed): Presentation // 純函式，只讀不寫
  settle(p: Presentation): void       // 渲染之後記下「上一個顯示的桌面」（空檔不記）
}
```

hook 同檔提供 `useSpeed()`：讀初始值（`initialSpeed` 與減少動態偏好）、寫回儲存，回傳 `[speed, setSpeed]`。

### 決策摘要

- 狀態機沒有計時器，`advance` 回傳停留時間；測試不需要假計時器。
- 空檔邏輯（原本的 `lagging` 與三段退路）整個搬進 `present`，Battle 看不到。
- 批次仍然從渲染傳進來，不改成訂閱 `Session`。
- `result`（勝負視窗）留在 Battle，由 `settled`、勝負與自己的編號決定。
- `present` 是純函式；「上一個顯示的桌面」由 hook 在渲染後的 effect 呼叫 `settle` 記錄，與現在的 `lastShown` 等價。
- 所有現有行為保留：播放中來新批次接在佇列後面；速度關閉時新批次直接丟掉；切到關閉立刻結束目前播放，其他速度切換只影響之後每一格；每格至少停留 150 毫秒；卸載或 StrictMode 模擬卸載會重置並重播同一批；作弊面板在播放或空檔期間鎖住。

## 範圍外

- `FlightLayer` 自己比對前後桌面的邏輯。
- `Session` 與批次傳遞的方式。
- 動畫外觀、速度倍率與停留時間的數值。
- 加入 jsdom 或 testing-library：只測狀態機，薄 hook 不測。

## 測試策略

- 狀態機直接測：連續兩批影格、播到一半又來新批次、跳過、關閉動畫丟棄新批次、空檔維持上一桌、空檔且沒有上一桌時取新批次第一格、開局抽牌不算數值變化、播完才 `settled`、重置後同一批會重播、傷害震動的延遲隨速度縮放。
- 既有的 `speed.test.ts` 不動。

## 版本

純內部重構，依版本號維護規範不升版。

## 票券

1. `01-playback-state-machine.md`
2. `02-battle-uses-presentation.md`
3. `03-use-speed.md`
