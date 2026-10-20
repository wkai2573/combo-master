# 議題追蹤系統：GitHub Issues

這個倉庫的議題與規格以 GitHub issue 的形式存放在 `wkai2573/combo-master`。操作一律使用 `gh` CLI，不再使用本地的 `.scratch/`。

## 慣例

- 一個功能一份規格，規格是一個帶 `spec` 標籤的 issue。
- 實作議題是規格的子議題（sub-issue），一張票券一個 issue。
- 分流狀態用標籤表示。規格建立時加上 `ready-for-agent`，不必再另外分流。
- 留言與對話歷史用 issue 的留言，不寫進內文。
- 完成的票券與規格用 `gh issue close <編號> --reason completed` 結案。
- 檔案、commit 訊息與文件要指稱議題時寫 `#編號`。

## 當 skill 說「發佈到議題追蹤系統」

建立一個 GitHub issue：`gh issue create --title "..." --body-file <檔案>`，內文較長時用 `--body-file`。規格加 `--label spec`；票券加 `--parent <規格編號>` 掛成子議題。

## 當 skill 說「取得相關票券」

`gh issue view <編號> --json number,title,body,labels,comments,state`。使用者通常會直接傳入編號。

## 常用指令

- 建立：`gh issue create --title "..." --body-file <檔案>`
- 留言：`gh issue comment <編號> --body "..."`
- 結案：`gh issue close <編號> --reason completed --comment "已於 vX.Y.Z 生效"`
- 標籤：`gh issue edit <編號> --add-label "..."` 或 `--remove-label "..."`
- 列出規格底下的子議題：`gh issue view <規格編號> --json subIssues`（舊版 gh 用 `gh api`）

## 阻擋關係

在票券內文最上方寫 `**Blocked by（被誰阻擋）：** #編號、#編號`。沒有阻擋寫「無（可立即開始）」。當它所列出的每個 issue 都已結案，票券就是未被阻擋。

## 尋路操作（Wayfinding operations）

由 `/wayfinder` 使用。**地圖**是一個 issue，每張票券各有一個**子** issue。

- **地圖**：帶 `wayfinder:map` 標籤的 issue（備註／目前已做的決策／迷霧的內文）。
- **子票券**：地圖的子議題，問題寫在內文中，帶 `wayfinder:<type>` 標籤，type 為 `research`、`prototype`、`grilling`、`task`。
- **阻擋**：同上，內文最上方的 `Blocked by` 行。
- **前沿**：列出地圖底下開放、未被阻擋且未被領取的子議題；依編號排第一的勝出。
- **領取**：在任何工作之前，加上 `claimed` 標籤。
- **解決**：在 issue 留言寫下答案，結案，並把情境指標（要旨 + 連結）附加到地圖內文的「目前已做的決策」。

## 歷史

在改用 GitHub 之前，議題與規格存放在本地 `.scratch/`，已全部遷移為 GitHub issue，舊檔案可從 git 歷史查看。
