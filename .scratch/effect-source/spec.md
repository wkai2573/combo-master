Status: ready-for-agent

# 效果來源：把卡片與角色的行為收進一個模組

## 問題陳述

一張卡或一位角色的行為散在六處：

- `src/engine/scripts.ts`：以卡名為鍵的 hook 表，加上四個各自依卡名比對的函式，處理回合開始、收招、爆發後與覺醒。
- `src/engine/game.ts`：爆發階段的招財貓、抽牌階段與開局的法師。
- `src/engine/combat.ts`：追擊失敗後的幸運兔腳、瞄準上限的瞄準器與遊俠、追擊次數的先人。
- `src/engine/combatStats.ts`：角色專屬的戰鬥結算表，以及對 hook 表旗標欄位的讀取。
- `src/engine/ops.ts`：蓋反應表。
- `src/engine/types.ts`：`TurnFlags` 裡卡片專屬的欄位。

加一張卡要同時動這幾處；`CardScript.onCovered` 無人讀取，與蓋反應表重複；`sync-card-table.ts` 用 `c.id in scripts` 判斷是否已實作，裝備與角色被誤判為未實作。這些位置是近 150 個 commit 中被改動最多的檔案。

## 解決方案

新增效果來源模組。一個條目就是一張卡或一位角色，條目內寫出它在各時機的行為；階段函式只問「這個時機、這位玩家有哪些效果」。決策記錄見 `docs/adr/0004-effect-source-unifies-timed-effects.md`，詞彙見 `GLOSSARY.md` 的「效果來源」與「時機」。

### 介面

- `fire(g, p, 時機, 參數)`：開該時機的觸發窗口並結算。
- `fireEach(g, 時機)`：雙方各開一次，先攻方先。
- `query(g, p, 鍵, 參數)`：查詢型，無副作用、不 yield，會被視角在每個影格對雙方各呼叫一次，所以要便宜。
- `moveRules(cardId)`：招式在戰鬥區與追擊區的靜態修正，沒有條目時回傳全預設物件。
- `hasEffect(id)`：這個卡名或角色名有沒有實作效果。

### 條目形狀

- 條目：`{ id, at, on, ask, asMove }`。
- `at` 必填，值為某個區域、角色或 `lasting`，沒寫就是編譯錯誤。
- 處理器可以明寫 `lasting: true` 覆寫條目的位置，表示離場後仍要被問。
- 型別化的狀態槽：`slot(鍵, 初始值)`，以 `read` 與 `of` 存取；存在這一局的 `GameState` 上，回合開始統一清空。
- `c.effect(選項, 內容)` 負責生成窗口效果，涵蓋可選費用、強制與是否補錄影格。

### 決策摘要

- 事件型與查詢型都收；角色與卡片共用同一個模組。
- 事件型一律走觸發窗口。只有一個可發動效果時沿用窗口既有的行為，所以目前的卡池下，出招類的行為與今天完全相同。
- 卡片擁有的旗標改成狀態槽；引擎擁有的旗標不動，包含出招張數、先手步驟是否已進行、追擊成功次數、本回合受到的傷害，以及已收招狀態。
- 狙擊印記的瞄準升級旗標改為狀態槽加查詢；瞄準的已使用次數改成追擊步驟裡的區域變數。
- 效果仍拿完整的 `GameCtx`，不收窄。
- 窗口標題維持現有的中文名稱，玩家看到的提示不變。

### 檔案配置

- `src/engine/effectKit.ts`：型別與條目輔助函式，不依賴其他引擎檔。
- `src/engine/effects.ts`：登記表與五個進入點。
- `src/engine/sources/<職業>.ts`：各職業與裝備、角色的條目，由 `sources/index.ts` 攤平登記。
- `src/engine/scripts.ts`：遷移完成後整個刪除。

## 範圍外

- `src/data/enabledCards.ts` 的開放名單，維持在資料層。
- `totalAtk`、`totalDef` 轉接器與戰鬥結算的明細欄位，維持原樣。
- 宣告式的費用與每回合一次欄位，等遷移完成後再評估。
- 規則變更：遷移期間不改任何規則。

## 測試策略

- 既有測試走 `Game` 與 `scenario`，不 mock，保留。
- 每票遷移某個時機前，先補現有測試沒覆蓋到的卡行為，作為特徵測試。
- 模組層級加四個不變量測試：重複 id 在載入時丟錯、開放名單裡每張卡都有條目、連續兩次結算同一個局面狀態不變、`hasEffect` 涵蓋角色與裝備。
- 讀旗標的斷言改成讀狀態槽或觀察行為，預先塞值的後門改用測試輔助函式設定槽。

## 版本

遷移為純內部重構，不強制升版。法師與爆發卡抽牌階段的紀錄措辭會改成通用寫法，屬外顯文字，在票 07 升 patch。

## 票券

1. `01-extract-cost.md`
2. `02-extract-judge.md`
3. `03-skeleton-and-invariants.md`
4. `04-window-shaped-timings.md`
5. `05-play-and-pursuit-timings.md`
6. `06-covered-and-return.md`
7. `07-queries-and-slots.md`
8. `08-remove-scripts.md`
