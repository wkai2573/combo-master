# 01：把費用相關函式抽到 cost.ts

**要建置什麼：** 把 `src/engine/ops.ts` 裡與費用有關的函式移到新檔 `src/engine/cost.ts`：`Cost`、`costText`、`faceUpExp`、`canPay`、`pay`、`optionalPay`、`cover`、`discardRage`，以及它們用到的蓋反應表和說明文字表。純搬移，不改任何行為與匯出的名稱語意。目的是先打斷日後效果來源模組與 `ops.ts` 之間的循環依賴：`pay` 之後要觸發被蓋成裏側的時機，而效果來源模組本身依賴 `ops.ts`。規格見 `.scratch/effect-source/spec.md`。

**Blocked by（被誰阻擋）：** 無（可立即開始）

**Status：** ready-for-agent

- [ ] 新檔 `cost.ts` 含上述函式；`ops.ts` 不再定義它們
- [ ] 所有引用處的匯入改到 `cost.ts`，`ops.ts` 不為了相容而轉出
- [ ] `cost.ts` 與 `ops.ts` 之間沒有循環匯入
- [ ] 現有測試不改斷言、全部通過，沒有新增行為
- [ ] 型別檢查、單元測試與機器人壓測通過
- [ ] 純內部重構，依版本號維護規範不升版
