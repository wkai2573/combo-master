# AGENTS.md

## Agent skills

### 議題追蹤系統

議題以本地 Markdown 形式存放在 `.scratch/`。請見 `docs/agents/issue-tracker.md`。

### 領域文件

單一情境（根目錄 `GLOSSARY.md` 與 `docs/adr/`）。請見 `docs/agents/domain.md`。

### 版本號維護

當有功能更新、修復或介面調整時必須同步遞增版本號。請見 `docs/agents/versioning.md`。

## 卡表

使用者提到「卡表」，一律指「連擊大師卡表」：Claude 的 Artifact 網頁（只有擁有者能開），https://claude.ai/artifact/Ght9i3eEV9u639zmPDXcaS 。卡片、角色、關鍵字的數值與文字都以它為準。

每張卡、每位角色、每個關鍵字都有永久編號，招式 A、裝備 E、增益 B、角色 C、關鍵字 K、Ex 卡 X，後面接數字；討論與記錄時用編號指稱，同步後可在 `src/data/cardTable.json` 的 `uids` 查它對應的內部 id。

- 查看（僅限 Claude Code）：用 `Artifact`（`action: "read"`）讀頁面；資料在它的資料庫，用 `ArtifactData` 讀取。這兩個工具以使用者的 claude.ai 身分運作，其他 agent 沒有，也打不開連結。
- 同步回遊戲（僅限 Claude Code）：`npm run table -- <資料夾>`，產生 `src/data/cardTable.json`。流程見 `README.md`「卡表網頁與數值同步」與 `docs/規則詮釋.md`。
- 其他 agent：以 `src/data/cardTable.json` 為準，唯讀。它是上次同步的快照，可能落後於卡表。不要直接改它（下次同步會被覆蓋，卡表上的新改動也不會回來）；要改卡表的內容，請使用者找 Claude 處理。