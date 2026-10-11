# 03：主選單改版與問卷回饋

**要建置什麼：** 主選單重新設計、右下角問卷按鈕、Worker 的 `/feedback` 轉址。規格見 `.scratch/menu-and-white-cards/spec.md`。

**Blocked by（被誰阻擋）：** 無（與 01、02 無關，順序放最後）

**Status：** resolved

- [x] 主選單版型與視覺
- [x] 問卷按鈕（正式建置走 Worker，本機開發直連表單）
- [x] Worker `/feedback` 路由與測試
- [x] README 寫部署與改網址步驟
- [x] 版本與更新日誌

## Answer

已於 v0.39.0 生效。主選單在 Home.tsx 與 styles.css；問卷按鈕連 src/stats/config.ts 的 FEEDBACK_URL，正式站走 Worker 的 /feedback 轉址（server/src/handler.ts，測試在 tests/server.test.ts 與 tests/feedbackUrl.test.ts）。線上 Worker 還沒部署，步驟寫在 README 的「問卷回饋」，要先部署伺服器再發布遊戲。瀏覽器實測：版面正常、問卷連結 href 與新分頁開啟屬性正確；測試用的瀏覽器套了深色模式外掛，顏色不準，窄螢幕版面沒能實測。
