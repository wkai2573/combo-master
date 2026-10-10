# 01：伺服器處理函式、資料表與測試

**要建置什麼：** 戰績伺服器的請求處理函式、資料表結構、驗證與限流，以假資料庫測試，並含部署入口設定。 規格見 `.scratch/cloud-records/spec.md`。

**Blocked by（被誰阻擋）：** 無（可立即開始）

**Status：** resolved

- [x] 處理函式測試涵蓋驗證、冪等、限流、篩選分頁、來源限制、無刪除路徑

## Answer

已於 v0.37.0 生效。伺服器在 server/：處理函式 handler.ts、資料表 schema.sql、D1 存取 d1.ts、進入點 index.ts；測試 tests/server.test.ts 用 Node 內建的 SQLite 跑真正的 SQL。已用 wrangler 本機模式（miniflare 的 D1）驗證寫入、取得、來源限制與無刪除路徑。
