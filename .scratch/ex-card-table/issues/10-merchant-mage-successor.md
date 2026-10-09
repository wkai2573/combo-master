# 10：商人、法師、後人

**要建置什麼：** 三位角色的新效果與覺醒效果。 規格見 `.scratch/ex-card-table/spec.md`。

**Blocked by（被誰阻擋）：** 05

**Status：** resolved

- [x] 行為測試
- [x] 升版並補更新日誌

## Answer

已於 v0.31.1 生效。商人、法師、後人的效果與覺醒效果依卡表更新；角色文字在 `src/data/characterText.ts`（角色文字不經卡表同步，引擎與文字一起改）。法師的 `drawPhaseExtra` 查詢已沒有條目使用，保留查詢機制。
