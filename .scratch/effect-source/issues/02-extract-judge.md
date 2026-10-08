# 02：把追擊判定抽到 judge.ts

**要建置什麼：** 把 `src/engine/combat.ts` 裡的 `inRange` 與 `judge` 及其相依的 `becomePursuitCard` 移到新檔 `src/engine/judge.ts`。純搬移，不改行為。目的是讓日後幸運兔腳的條目可以呼叫追擊判定，而不必匯入整個 `combat.ts` 造成循環依賴。規格見 `.scratch/effect-source/spec.md`。

**Blocked by（被誰阻擋）：** 無（可立即開始）

**Status：** resolved

- [x] 新檔 `judge.ts` 含 `inRange`、`judge`、`becomePursuitCard`；`combat.ts` 改為匯入
- [x] 現有測試與腳本對這些函式的匯入同步更新
- [x] `judge.ts` 不匯入 `combat.ts`，沒有循環匯入
- [x] 現有測試不改斷言、全部通過，沒有新增行為
- [x] 型別檢查、單元測試與機器人壓測通過
- [x] 純內部重構，依版本號維護規範不升版

## Answer

純內部重構，不升版，維持 v0.22.2。
