# 01：階段表驅動完整對局與單階段

**要建置什麼：** `game.ts` 的階段順序改由一份有序階段表提供，`run()` 與 `runSinglePhase` 都讀它；新增 `StartPhase` 型別並套用到 `GameSetup.startPhase` 與測試輔助函式。規格見 `.scratch/phase-table/spec.md`。

**Blocked by（被誰阻擋）：** 無（可立即開始）

**Status：** resolved

- [x] `run()` 裡不再有逐階段重複的起點比對條件鏈；`runSinglePhase` 不再有第二份階段順序
- [x] `StartPhase` 只含 `重置`、`先手`、`抽牌`、`爆發`、`增益`；`GameSetup.startPhase` 與測試的 `Scenario.phase` 改用它
- [x] 完整對局從任一起點開始，只執行該階段之後的階段；單階段只執行該階段
- [x] 戰鬥階段開頭的橫幅影格只在完整對局出現
- [x] 新增階段表測試，既有測試不改斷言
- [x] 型別檢查、全部測試與機器人壓測通過，壓測勝率與基準相同
- [x] 純內部重構，依版本號維護規範不升版

## Answer

`game.ts` 新增 `PHASES` 階段表，`run()` 與 `runSinglePhase` 都讀它；`StartPhase` 型別定義在 `types.ts` 並套用到 `GameSetup` 與測試輔助函式。新增 `tests/phaseTable.test.ts`；壓測勝率與基準相同。
