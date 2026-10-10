# 01：作弊解鎖模組與隱藏介面

**要建置什麼：** 新增作弊解鎖模組、網址參數與首頁連點版本號入口；對戰畫面未解鎖時不渲染作弊開關與面板。 規格見 `.scratch/cheat-hidden/spec.md`。

**Blocked by（被誰阻擋）：** 無（可立即開始）

**Status：** resolved

- [x] 解鎖模組與連點判斷的測試

## Answer

已於 v0.35.0 生效。新增解鎖模組（網址 ?cheat=1 / ?cheat=0、首頁連點版本那一行 7 次），對戰畫面未解鎖時不渲染作弊開關與面板。測試在 tests/cheatUnlock.test.ts。
