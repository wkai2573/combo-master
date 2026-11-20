# AGENTS.md

## Agent skills

### 議題追蹤系統

議題與規格存放在 GitHub Issues（`wkai2573/combo-master`），用 `gh` CLI 操作。請見 `docs/agents/issue-tracker.md`。

### 領域文件

單一情境（根目錄 `GLOSSARY.md` 與 `docs/adr/`）。請見 `docs/agents/domain.md`。

### 版本號維護

當有功能更新、修復或介面調整時必須同步遞增版本號。請見 `docs/agents/versioning.md`。

## 卡表

「卡表」指與遊戲一起部署的「連擊大師卡表」（`/combo-master/cardTable/`）。`src/data/cardTable.json` 是遊戲與卡表頁共用的唯一卡表資料來源，記錄 xlsx 基準資料的覆蓋值與新增項目。

每張卡、每位角色、每個關鍵字都有永久編號，招式 A、裝備 E、增益 B、角色 C、關鍵字 K、Ex 卡 X，後面接數字。討論與記錄時用編號指稱，在資料檔的 `uids` 查它對應的內部 id。

網頁編輯存在瀏覽器草稿。收到匯出的 JSON 差異檔，用 `bun run table <差異檔>` 匯入，再依 README「卡表網頁與差異檔」驗證、升版及提交。
