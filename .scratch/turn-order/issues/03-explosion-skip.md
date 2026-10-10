# 03：Explosion! 跳過下個回合的抽牌階段

**要建置什麼：** 跳過標記改為跨回合保留的玩家狀態，在下個抽牌階段消耗後清除；介面提示與紀錄文字同步。 規格見 `.scratch/turn-order/spec.md`。

**Blocked by（被誰阻擋）：** 01

**Status：** resolved

- [x] 出招後下個回合少抽 1 張、再下個回合恢復的測試，第 1 回合使用同樣有效

## Answer

已於 v0.33.0 生效。跳過標記改存在 GameState.drawSkips，抽牌階段消耗後清除；測試在 tests/cards2.test.ts 的 Explosion! 案例。
