# 01：預先重構：同步指令與 Ex 卡判斷

**要建置什麼：** 把同步指令的核心抽成純函式並補既有行為測試；程式裡散落的 Ex 卡判斷收成單一處。行為不變。 規格見 `.scratch/ex-card-table/spec.md`。

**Blocked by（被誰阻擋）：** 無（可立即開始）

**Status：** resolved

- [x] 同步核心為純函式，腳本只讀檔寫檔
- [x] 數值、改名、新卡、編號的既有行為有測試
- [x] Ex 卡判斷只有一處
- [x] 不升版，型別檢查與全部測試通過

## Answer

同步核心抽成 `scripts/tableSync.ts` 的 `buildCardTable`（純函式，`tests/tableSync.test.ts` 測既有行為），腳本只讀檔寫檔；用實際卡表資料跑新舊版，輸出逐位元相同。Ex 卡判斷收成 `isExCardId`（`src/data/exCards.ts`）。純內部重構，不升版。
