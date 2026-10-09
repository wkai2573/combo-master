# 09：刺客

**要建置什麼：** 追擊成功加 Ex-流血，覺醒再加 Ex-中毒，舊的總攻擊加成與上限移除。 規格見 `.scratch/ex-card-table/spec.md`。

**Blocked by（被誰阻擋）：** 03、05

**Status：** resolved

- [x] 行為測試
- [x] 升版並補更新日誌

## Answer

已於 v0.31.0 生效。新時機「追擊成功時」（`onPursuitSuccess`）讓角色與常駐效果能聽到追擊成功，和卡自己的 [追] 效果進同一個窗口；刺客改成放 Ex-流血（覺醒再加 Ex-中毒），ASSASSIN_CAP 與總攻擊加成移除。測試在 `tests/assassin.test.ts`。
