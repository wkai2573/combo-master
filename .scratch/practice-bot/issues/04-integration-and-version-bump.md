# 04：單機對局整合、回歸驗證與版本升級

**要建置什麼：**
將單機練習對局會話（`LocalSession`）端到端接通智慧機器人決策，執行完整回歸測試與壓測模擬確保系統無死鎖、無例外，並依規範升版與更新日誌。

**Blocked by（被誰阻擋）：** 03：戰鬥反擊評估、動態策略與收招保留

**Status：** resolved

- [x] 在 `LocalSession` 中，將即時視角（`this.s.view`）連同提示傳入 `botChoice`，完成單機練習端到端整合。
- [x] 執行全站測試（`bun run test`）確認所有 908+ 個單元與整合測試保持綠燈通過。
- [x] 執行型別檢查（`tsc --noEmit`）確認無任何 TypeScript 型別錯誤。
- [x] 執行壓測模擬（`bun run sim 5`）驗證在多局隨機對戰中沒有卡死、例外或狀態不變量破損。
- [x] 依版本號維護規範將 `package.json` 由 `0.46.7` 升至 `0.47.0`（Minor）。
- [x] 在 `src/data/changelog.ts` 頂部新增 `0.47.0` 版本之更新日誌（面向玩家，說明單機練習電腦具備更聰明的出招、攻防與資源管理能力）。

## Answer

已於 `LocalSession` 接入 `botView` 並傳入 `botChoice`，完成端到端單機練習智慧電腦整合。全站 73 個測試檔（共 923 項測試）、`bun run build`（型別檢查與生產打包）以及 `bun run sim 5`（245 局壓測）全部順利通過。版本已升至 `0.47.0`，並已更新 `src/data/changelog.ts`。已於 v0.47.0 生效。

