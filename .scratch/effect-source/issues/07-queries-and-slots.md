# 07：接入查詢型並把卡片旗標搬進狀態槽

**要建置什麼：** 把查詢型行為與卡片擁有的回合旗標都搬進效果來源。戰鬥結算、追擊次數、瞄準上限與抽牌數量不再認得卡名或角色名。規格見 `.scratch/effect-source/spec.md`。

查詢與靜態修正的對應：

- 開局多抽、抽牌階段多抽：法師。
- 跳過抽牌階段：Explosion!。
- 瞄準上限：遊俠與瞄準器。瞄準等級：狙擊印記。
- 追擊次數：先人覺醒先攻、二連矢、二刀連擊。
- 總攻擊與總防禦的加減：伏擊、順手牽羊、凡骨的意志。
- 角色專屬戰鬥結算：勇者、刺客、先人、後人，取代 `CHARACTER_COMBAT_MODIFIERS`。
- 招式靜態修正：戒備打擊、力量爆破、盾擊、魅影射擊、地雷陷阱，由 `moveRules` 回傳。

旗標處理：

- 搬進狀態槽：`rabbitUsed`、`aimUp`、`atkBonus`、`defBonus`、`vanillaBoost`、`poisonQ`、`skipDraw`、`pursuitPlus`。
- 留在 `TurnFlags`：`played`、`opened`、`pursuitSuccess`、`damageTaken`，以及 `GameState.passed`。
- `aimUsed` 改成追擊步驟裡的區域變數。

**Blocked by（被誰阻擋）：** 05、06

**Status：** ready-for-agent

- [ ] 每個查詢遷移前，先補現有測試沒覆蓋到的卡行為作為特徵測試
- [ ] 凡骨的意志與二連矢的處理器明寫 `lasting`，並各有一個離場後仍然生效的測試
- [ ] 讀旗標的斷言改成讀狀態槽或觀察行為；預先塞值的後門改用測試輔助函式設定槽
- [ ] `resolveCombatStats` 不再匯入 `scripts` 或依角色名分支，明細欄位與回傳形狀不變，`rules.test.ts` 的明細斷言不改
- [ ] 查詢型無副作用：連續兩次結算同一局面，狀態槽內容不變，由不變量測試涵蓋
- [ ] 抽牌階段額外抽牌的紀錄措辭改成通用寫法，少了角色與卡名前綴；斷言只看張數的測試通過
- [ ] 現有規則行為不變，測試全部通過
- [ ] 型別檢查、單元測試與機器人壓測通過
- [ ] 紀錄措辭屬外顯文字，依版本號維護規範遞增 patch 版本，同步 `package.json` 與 `package-lock.json`，於本票底部以 `## Answer` 標記生效版本
