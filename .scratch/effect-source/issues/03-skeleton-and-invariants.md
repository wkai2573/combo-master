# 03：效果來源模組骨架與不變量測試

**要建置什麼：** 建立 `effectKit.ts`、`effects.ts` 與 `sources/index.ts`，提供 `fire`、`fireEach`、`query`、`moveRules`、`hasEffect` 的骨架與登記表，此時登記表是空的。遷移期間 `hasEffect` 等於「在新登記表」或「在舊 `scripts` 表」。`scripts/sync-card-table.ts` 改讀 `hasEffect`。規格見 `.scratch/effect-source/spec.md`，決策見 `docs/adr/0004-effect-source-unifies-timed-effects.md`。

**Blocked by（被誰阻擋）：** 01、02

**Status：** ready-for-agent

- [ ] `effectKit.ts` 只依賴 `ops`、`window`、`types` 與 `cost`，不依賴 `combat`、`game`、`combatStats`
- [ ] 條目的 `at` 必填，缺少時是編譯錯誤；處理器可寫 `lasting: true`
- [ ] 狀態槽存在 `GameState` 上，回合開始由引擎統一清空；開局第一個提示前可讀取
- [ ] 新增不變量測試：登記重複 id 在載入時丟錯
- [ ] 新增不變量測試：開放名單裡每張卡都有條目，遷移完成前允許用舊表補足，並在票 08 收緊
- [ ] 新增不變量測試：連續兩次結算同一局面，狀態槽內容不變
- [ ] 新增不變量測試：`hasEffect` 對角色與裝備回答正確
- [ ] `sync-card-table.ts` 改用 `hasEffect`，不再用 `c.id in scripts`
- [ ] 現有測試全部通過，沒有新增行為
- [ ] 型別檢查、單元測試與機器人壓測通過
- [ ] 純內部重構，依版本號維護規範不升版
