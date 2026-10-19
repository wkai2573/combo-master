# 08：收尾與全面驗證

**要建置什麼：** 資料庫與遊戲完全對齊，整批做最後驗證。規格見 `.scratch/card-batch-loan-rage/spec.md`。

**Blocked by（被誰阻擋）：** 03、04、05、06、07

**Status：** ready-for-agent

- [ ] 跑 `bun run presets` 與 `bun run sim`，檢查新卡各 3 張後的連擊值分佈與有無卡死或例外；有異常列出來交給使用者決定
- [ ] 規則詮釋與 README 的效果卡張數描述更新，規則詮釋的卡表格與 Ex 卡段落對齊現況
- [ ] 卡表資料庫：新卡與新 Ex 卡設成啟用；所有 `base` 與現值不同的欄位重設成現值，不動 `base.name`；`meta/sync` 的遊戲版本、備註與同步時間更新；更新後的撰寫規範全文寫回 `meta/styleGuide`
- [ ] 重讀資料庫確認 `base` 全部與現值一致，重跑 `bun run table` 後 `cardTable.json` 沒有變動
- [ ] 全倉庫沒有遺留的矛盾描述（Ex 卡只能在經驗區、嘲諷的總防禦扣減、地雷陷阱 +3 等）
- [ ] `bun run test`、`bun run build`、`bun run sim` 通過；升 patch 版本並補更新日誌；各票券標記解決版本
