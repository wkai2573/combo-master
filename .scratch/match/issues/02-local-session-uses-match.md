# 02：LocalSession 改用 Match

**要建置什麼：** `LocalSession` 不再自己持有 `Game` 與 `CheatHub`，改為建立在 `Match` 之上。機器人的 900ms 延遲與出招選擇留在 `LocalSession`。UI 看到的 `Session` 介面與建構方式不變。規格見 `.scratch/match/spec.md`。

**Blocked by（被誰阻擋）：** 01

**Status：** resolved

- [x] 開局的影格與視角由 `flush` 取得，首批影格與重構前相同
- [x] 玩家提交失敗時，訊息顯示方式與重構前相同
- [x] 機器人在輪到它時才延遲回應；作弊操作後的發佈不重設機器人的計時，連續作弊不會讓它一直等
- [x] 作弊介面的行為不變：開關、檢視、加入、移除、調整順序
- [x] `LocalSession` 內不再直接呼叫 `viewFor`、`frameFor`、`drainFrames`
- [x] 現有測試全部通過，沒有新增行為；機器人壓測通過
- [x] 純內部重構，依版本號維護規範不升版

## Answer

`LocalSession` 改建立在 `Match` 之上，機器人的 900ms 延遲與出招選擇留在原處。作弊後只發佈、不重設機器人的計時。新增 `tests/localSession.test.ts`，以假計時器固定亂數種子；原本完全沒有單機的測試。
