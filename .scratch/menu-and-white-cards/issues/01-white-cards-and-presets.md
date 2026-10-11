# 01：白板卡數值與預設牌組

**要建置什麼：** 依 `spec.md` 改 36 張白板卡的攻守、重寫預設牌組的挑牌邏輯。規格見 `.scratch/menu-and-white-cards/spec.md`。

**Blocked by（被誰阻擋）：** 無（可立即開始）

**Status：** resolved

- [x] 卡表資料庫改完並同步，`cardTable.json` 更新，卡表的黃框清掉
- [x] 測試：同連擊值 4 張互不相同、循環規律、預設牌組的組成
- [x] 預設牌組符合規格，機器人壓測通過
- [x] 版本與更新日誌

## Answer

已於 v0.38.0 生效。白板卡數值改在卡表資料庫並同步（測試 tests/whiteCards.test.ts）；預設牌組改成自動放入職業效果卡、連擊值平均、依傾向挑白板卡（presetDecks.ts，測試 tests/presetDecks.test.ts）。壓測 1470 局沒有錯誤。
