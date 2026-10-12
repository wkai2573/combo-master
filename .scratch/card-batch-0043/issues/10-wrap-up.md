# 10：收尾與全面驗證

**要建置什麼：** 資料庫與遊戲完全對齊，整批做最後驗證。規格見 `.scratch/card-batch-0043/spec.md`。

**Blocked by（被誰阻擋）：** 02、03、04、05、06、07、08、09

**Status：** ready-for-agent

- [ ] 資料庫的 `base`、`meta/sync`、`meta/uidSeq` 對齊，重讀確認一致，重跑同步後 `cardTable.json` 沒有變動
- [ ] 卡表上的規則書與撰寫規範在內容有改時寫回
- [ ] 全倉庫搜尋沒有舊名，`bun run test`、`bun run build`、`bun run sim` 通過
