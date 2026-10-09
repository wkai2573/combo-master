# 13：財富管理

**要建置什麼：** 卡實作並開放。 規格見 `.scratch/ex-card-table/spec.md`。

**Blocked by（被誰阻擋）：** 05

**Status：** resolved

- [x] 牌組不足 3 張不能發動、放回 Ex 卡直接移除遊戲的測試
- [x] 升版並補更新日誌

## Answer

已於 v0.32.2 生效。財富管理（id 投資）實作在商人來源檔，蓋反應共用 `coverReaction` 並擴充額外時機；牌組剛好 3 張時可以發動，放完牌組歸零會落敗（照牌組歸零的一般規則）。測試在 `tests/wealthManagement.test.ts`。
