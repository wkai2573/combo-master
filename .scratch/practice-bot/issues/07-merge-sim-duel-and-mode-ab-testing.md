# 07：合併 duel 與 sim 並支援模式對抗（mode1 vs mode2）

**要建置什麼：**
1. 建立可擴充的機器人決策模式定義（`mode1` 與 `mode2`），並在程式碼中清楚註解各模式之策略打法：
   - `mode1`：第一代基礎機率（無牌面視野；50% 爆發、80% 出招、20% 收招）。
   - `mode2`：第二代啟發式決策（牌面可見性；邊緣牌起手、受傷威脅浮動防禦、溢出破防激勵、低威脅收招保留）。
2. 在 `src/engine/bot.ts` 中擴充 `playOut` 支援指定雙方模式：`modes?: [BotMode, BotMode]` 或單一 `mode?: BotMode`。
3. 合併 `duel` 與 `sim` 於 `scripts/simulate.ts`：
   - 當局數為 1 時（例如 `bun run sim 1` 或 `bun run duel`），自動輸出逐回合對決日誌。
   - 當局數 > 1 時，輸出多局統計報告。
   - 支援 `--mode <mode>`（固定模式）與 `--mode <A>:<B>`（如 `mode1:mode2`，雙向鏡像對打測試實力對比）。
   - 移除獨立的 `scripts/duel.ts`，並在 `package.json` 將 `duel` 指向 `tsx scripts/simulate.ts 1`。
4. 通過單元測試、型別檢查與回歸測試，升版至 0.47.3。

**Blocked by（被誰阻擋）：** 06：模擬對戰腳本支援啟發式 AI 互打與戰術指標

**Status：** resolved

- [x] 在 `src/engine/bot.ts` 中定義 `BotMode = 'mode1' | 'mode2'` 與策略打法註解；擴充 `playOut` 支援 `modes?: [BotMode, BotMode]`。
- [x] 改造 `scripts/simulate.ts`，支援單局詳細日誌與多局統計自動切換、`--mode` 語法（單模式與 A:B 模式鏡像對抗）。
- [x] 移除 `scripts/duel.ts`，並在 `package.json` 中將 `"duel"` 指向 `"tsx scripts/simulate.ts 1"`。
- [x] 撰寫單元測試覆蓋 `playOut` 異質模式對抗（`modes: ['mode1', 'mode2']`）。
- [x] 執行全站測試（`bun run test`）、型別檢查（`tsc --noEmit`）與實跑 `bun run sim 1`、`bun run sim 10 --mode mode1:mode2`。
- [x] 遞增版本號至 `0.47.3`，並在 `src/data/changelog.ts` 記錄此功能。

## Answer
已完成 `duel` 與 `sim` 的整合，並建構中立可擴充的模式架構（`mode1` 與 `mode2`），程式碼內附完整策略打法註解。
支援單局逐回合日誌、多局統計報告，以及跨模式雙向鏡像勝率評測（如 `--mode mode1:mode2`）。
已於 v0.47.3 生效。
