# 06：模擬對戰腳本支援啟發式 AI 互打與戰術指標

**要建置什麼：**
讓模擬測試腳本（`scripts/simulate.ts`）與底層 `playOut` 支援使用啟發式決策 AI（`smartChoice`）進行雙電腦對局模擬：
1. `playOut` 函式擴充接收 `PlayOutOptions`（支援 `mode: 'random' | 'smart'`），當為 `smart` 時以 `game.view(req.player)` 產出即時桌面視角傳入 `botChoice`；預設維持 `'random'` 以保持向下相容。
2. `scripts/simulate.ts` 支援 CLI 參數解析（如 `bun run sim 40 --smart` 跑新 AI，預設 `bun run sim 40` 跑隨機壓測），並於終端輸出目前模式。
3. `simulate.ts` 擴充戰術指標輸出，包含「先手勝率」與平均出招統計，以供牌組強度與戰術平衡性分析。
4. 撰寫單元測試覆蓋 `playOut` 在 `smart` 模式下的執行，並確保全站測試、型別檢查與模擬壓測全部通過，依規範升版至 0.47.2。

**Blocked by（被誰阻擋）：** 05：邊緣牌優先與動態攻防權重戰術精進

**Status：** resolved

- [x] 在 `src/engine/bot.ts` 中定義 `PlayOutOptions`，擴充 `playOut` 支援 `mode?: 'random' | 'smart'`，並向下相容舊有的 `maxSteps` 數字傳參；在 `smart` 模式下呼叫 `botChoice(req, rng, viewFor(game, req.player))`。
- [x] 撰寫單元測試驗證 `playOut` 在 `smart` 模式下能正常跑完全局。
- [x] 在 `scripts/simulate.ts` 中解析 CLI 參數（支援 `--smart` / `smart`），加入模式提示與「先手勝率」統計。
- [x] 執行全站測試（`bun run test`）、型別檢查（`tsc --noEmit`）與 `bun run sim 5 --smart`、`bun run sim 5`。
- [x] 遞增版本號至 `0.47.2`，並在 `src/data/changelog.ts` 記錄此功能。

## Answer

已擴充 `playOut` 支援 `PlayOutOptions`（可無縫切換 `random` 與 `smart` 模式並保持向下相容），且 `scripts/simulate.ts` 支援 `--smart` 參數與先手勝率統計輸出。全站測試 73 檔 929 項測試、`bun run build` 以及雙模式壓測全部綠燈通過。已於 v0.47.2 生效。

