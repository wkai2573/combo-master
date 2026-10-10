# 04：部署、ADR、文件與升版

**要建置什麼：** 帶使用者完成 Cloudflare 授權並部署伺服器，手動驗證一次寫入與取得；ADR 0005；README；升版 0.37.0 並補更新日誌。 規格見 `.scratch/cloud-records/spec.md`。

**Blocked by（被誰阻擋）：** 03

**Status：** resolved

- [x] 實際寫入與取得驗證

## Answer

已於 v0.37.0 生效。已部署到 Cloudflare：D1 資料庫 combo-master-records（資料表已建立）、Worker https://combo-master-records.combo-master-tcg.workers.dev。正式環境驗證過寫入、取得、重送冪等、陌生來源 403、DELETE 405、預檢 204，驗證用的測試資料已刪除。正式建置預設連這個網址，本機開發與測試預設不連線。ADR 為 docs/adr/0005-global-cloud-records.md。
