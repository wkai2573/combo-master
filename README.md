# 連擊大師

以連擊值接力出招的 1v1 TCG（網頁版）。規則書見 `docs/連擊大師.md`，實作時的規則解讀見 `docs/規則詮釋.md`。

## 線上玩

https://game.tempura.page/combo-master/

分頁標題、首頁與對戰畫面都會顯示版本（例如 `v0.2.0`；首頁另有 commit 代碼與建置時間，`+` 表示有未提交的變更），用來確認看到的是不是新版。版本號在 `package.json`，每次更新時調整。

推送到 `main` 後，GitHub Actions 會依序跑測試、建置、部署戰績伺服器並檢查，最後發布至 Hub Worker 子路徑（設定在 `.github/workflows/deploy.yml`）。

## 戰鬥流程圖

戰鬥流程圖是 App 內的元件（`src/ui/components/FlowChartModal.tsx`，圖的版面資料在 `src/ui/flowChart.ts`），用彈窗開啟：遊戲首頁、規則說明和對戰畫面上方的「流程圖」都是入口。從對戰畫面開啟時，主幹上會標出目前的步驟（你在這裡），並隨對局推進更新。

- 回合主幹（回合開始、抽牌、爆發、增益、戰鬥內五個步驟、回合結束）由 `src/data/turnSteps.ts` 的步驟表產生，戰鬥畫面上方的步驟列讀同一份，調整回合順序只要改這一處；新增階段時還要在 `flowChart.ts` 補主幹節點文字，沒補會有明確的錯誤。
- 分支（先手無招式、跳過追擊、追擊判定、勝負與同時歸零）在 `src/ui/flowChart.ts` 手寫座標與文字，規則改了要手動維護；規則以 `docs/連擊大師.md` 為準。
- 版面是橫向分區，由上往下依序是回合階段、戰鬥階段、追擊結果、勝負判定、同時歸零比手牌，設計寬度 1230；手機版面（所有不是寬螢幕版的畫面）改用直式單欄排版，不需橫向捲動。
- 節點文字預先斷成標題一行、說明一行，字數上限由 `tests/flowChart.test.ts` 檢查，同時檢查節點不超出寬度、彼此不重疊、邊線不穿過節點。

## 指令

```
bun install
bun run dev        # 開發伺服器（預設 http://localhost:5173）
bun run test       # 單元測試（規則、卡片效果、牌組驗證）
bun run sim 40     # 機器人壓測：每種角色組合各打 40 局，檢查卡死與例外
bun run presets    # 列出各角色預設牌組的連擊值分佈與平均攻守
bun run data       # 修改 docs/連擊大師.xlsx 後，重新產生 src/data/generated/*.json
bun run build      # 型別檢查＋打包
bun run assets:pack      # 把 assets/ 打包到 exports/，不上傳
bun run assets:publish   # 打包並發布到 GitHub Releases
bun run assets:download  # 從 GitHub Releases 還原 assets/
```

## 資產

圖片資產集中在 `assets/`。只有網站建置要用的部分進 git，其他只存在本機，靠 GitHub Releases 的資產包保存和分享。取捨見 `docs/adr/0009-only-runtime-images-in-git.md`。

| 目錄 | 內容 | 進 git |
|---|---|---|
| `assets/portraits/` | 網站插畫，檔名是卡片永久編號的 webp | 是 |
| `assets/frames/move/` | 招式卡框 | 是 |
| `assets/frames/equipment/` | 裝備卡框 | 是 |
| `assets/originals/` | 無框原圖，依職業、共用與白板分目錄 | 否 |
| `assets/finished/move/` | 招式成品卡面 | 否 |
| `assets/finished/equipment/` | 裝備成品卡面 | 否 |

`public/` 是 Vite 的靜態檔目錄，放分享連結的縮圖，不算在資產包內。

`.gitignore` 預設忽略所有圖片格式，只放行 `public/`、`assets/portraits/` 與 `assets/frames/`。新增其他網站要用的圖片位置時，要在 `.gitignore` 放行。沒放行的圖不會進 git，建置也不會報錯，線上站只會缺圖。

### 資產包

**GitHub Releases 是公開的，任何人都能下載資產包，包括無框原圖。** 不能公開的檔案不要放進 `assets/`。

一個資產包是整個 `assets/` 的完整快照，包含進 git 和不進 git 的部分。每個 Release 有兩個檔案：

- `combo-master-assets.zip`：zip 內的路徑以 `assets/` 開頭。
- `assets-manifest.json`：每個檔案的 SHA-256 清單。

Release 的 tag 用發布當天的本地日期，格式是 `assets-YYYY-MM-DD`，同一天第二次起是 `assets-YYYY-MM-DD.2`、`.3`。每次發布都建立新版，不覆蓋既有版本。

**只保留最新 3 版。** 新版上傳成功後，`publish` 會自動刪除更舊的 `assets-` Release 和它的 tag，不會另外詢問，刪除後無法復原。其他 tag 的 Release 和草稿不受影響。上傳失敗時不刪任何版本；個別舊版刪除失敗時，新版仍算發布成功，指令會列出失敗的版本，下次發布時再試。要長期保存某一版，先下載它的 zip 另外存放。

`publish` 和 `download` 需要安裝 [GitHub CLI](https://cli.github.com/) 並用 `gh auth login` 登入。發布還需要這個 repo 的寫入權限。

#### 打包

```
bun run assets:pack
```

在 `exports/` 產生上述兩個檔案，不上傳。`exports/` 不進 git。系統自動產生的 `.DS_Store`、`Thumbs.db` 和 `desktop.ini` 不會打包。

#### 發布新版資產

1. 修改 `assets/` 的內容。
2. 若改到進 git 的圖片或程式，先 commit。需要升版時依 `docs/agents/versioning.md` 處理。
3. 推送到 `origin/main`。推送會部署正式站。只改了本機原圖或成品圖時沒有東西要推，直接做下一步。
4. 執行：

```
bun run assets:publish
```

指令在下列情況會停下來，不上傳任何東西：

| 情況 | 處理方式 |
|---|---|
| 有尚未 commit 的修改 | 先 commit |
| 目前的 commit 還沒推到 `origin/main` | 先推送，指令不會代為推送 |
| `assets/` 沒有任何檔案 | 先用 `download` 還原 |
| 內容和最新一版完全相同 | 不需要發布 |
| 本機缺少最新一版裡的檔案 | 還沒還原就先執行 `download`。確定要移除或改名時，加 `--allow-removal` |
| zip 達到單檔 2 GiB 上限 | 要先改指令決定分檔方式 |

移除掉的檔案只在還保留的舊版裡找得到。移除它們的那一版發布後，再發布 2 次新版，含有這些檔案的版本就全部刪除了。

確定要讓新版不再包含某些檔案時：

```
bun run assets:publish --allow-removal
```

上傳中斷時重新執行即可。若 Releases 頁面留下草稿，可以手動刪除，指令判斷版本時不看草稿。

#### 在新電腦上還原

```
git clone https://github.com/wkai2573/combo-master.git
cd combo-master
bun install
bun run assets:download
```

指定版本，或用資產包覆蓋本機內容：

```
bun run assets:download assets-2026-11-27
bun run assets:download --force
bun run assets:download assets-2026-11-27 --force
```

- 不指定 tag 時抓最新一版。
- 預設只補本機缺少的檔案。內容不同的檔案保留本機版本，指令會列出清單。
- 加 `--force` 才用資產包覆蓋內容不同的檔案。覆蓋掉的本機版本無法復原。
- 任何情況都不刪除本機檔案，包括資產包裡沒有的檔案。
- 覆蓋到 `assets/portraits/` 或 `assets/frames/` 時，`git status` 會顯示差異。用較舊的資產包覆蓋前先確認。

沒有 GitHub CLI 時，也可以到 [Releases 頁面](https://github.com/wkai2573/combo-master/releases) 下載 zip，在專案根目錄解壓縮。手動解壓縮會直接覆蓋同名檔案。

## 卡表網頁與差異檔

「連擊大師卡表」隨遊戲部署在同站的 `/combo-master/cardTable/`。本機執行 `bun run dev` 後可開啟 `/cardTable/`。遊戲與卡表頁共用 `src/data/cardTable.json`，其中保存 xlsx 基準卡與角色的覆蓋值，以及新增卡、角色、關鍵字、Ex 卡與永久編號。

卡片和 Ex 卡可切換卡面或表格，角色和關鍵字直接使用表格。卡片與 Ex 卡分別保留篩選、搜尋、排序及顯示方式；Ex 卡表格和卡面可編輯攻擊力、防禦力與連擊值。每筆資料占一列，可在儲存格編輯欄位。四個分頁都可新增，並用列尾按鈕上移、下移或刪除。卡面檢視也可拖曳排序。刪除既有項目後可從待刪除清單撤銷。新增角色匯入後先標為待補，待效果實作完成後開放選用。頁面用黃框與原值標示修改，草稿存於目前的瀏覽器。基準版本更新時，已套用的改動會清除，基準值已變動的改動會列入作廢清單。編輯完成後按「匯出差異檔」，把 JSON 檔交給維護者。

1. 在倉庫根目錄執行 `bun run table "差異檔路徑.json"`。
2. 閱讀匯入報告並執行 `git diff -- src/data/cardTable.json`。檢查欄位與排序衝突、暫領編號調整，以及待確認用語或待實作效果。匯入僅提示基準卡的文字提案。其餘文字依 `docs/卡片撰寫規範.md` 檢查，並依需要更新引擎效果。報告出現「欄位衝突（未套用）」、「排序衝突」或「刪除衝突」，代表差異檔記錄的基準值已與目前資料檔不同，該筆改動沒有寫入；請向提出者確認後，請對方以最新版卡表頁重新匯出，或由維護者直接改資料檔。
   匯入遇到格式錯誤、數值超出範圍、欄位不明、編號或內部 id 重複、Ex 卡命名或引用不符時，會整份拒絕並印出原因，資料檔不會被改動。請將原因回報給提出者，修正後再匯入。差異檔結構（`formatVersion`、`baseVersion`、`edits`、`additions`、`deletions`）的定義見 `src/data/cardTableDraft.ts`。
3. 按 `docs/agents/versioning.md` 更新版本與更新日誌，再執行 `bun run test` 與 `bun run build`。
4. 將卡表資料、相關程式變更、版本與更新日誌一併提交。部署後卡表頁與遊戲會使用該次提交的資料。

Ex 卡的名稱須以 `Ex-` 開頭，卡文須包含對應區域的離場規則。匯入會檢查 `[Ex-卡名]` 引用並回報引用者。新增效果要在 `src/engine/sources/` 登記常駐區域（經驗區 `exp` 或增益區 `buff`）。增益區的 Ex 卡依卡文的「持續回合：N。」計時。

## 卡面合成

開啟卡表的「卡面合成」，按永久編號選擇卡片。招式與裝備範本會依職業和部位帶入卡框。選擇圖片圖層後可上傳，也可把插畫拖入預覽。範本會保留圖層的順序、範圍和文字樣式，從「套用範本」即可重用。「另存範本」可複製目前布局，編輯自訂範本會同步更新採用它的卡片。工作內容存於目前的瀏覽器。

選擇文字圖層即可拖曳選取框移動，拉右下角調整範圍，也可直接輸入座標。效果內文預設以底緣為基準往上換行，卡名則按範圍自動適配為一行。效果文字沿用卡表的費用與關鍵字寫法，也能在範本上指定字詞的底框或上傳對應圖片。預覽會指出文字溢出和缺少圖片的圖層。

88 張招式和 8 張裝備已採用分層卡面。改卡名、效果內文或其他綁定欄位時，照卡表的差異檔流程更新資料即可。若有新增卡片，先匯入卡表差異並確認新卡的永久編號。改範本、圖片或圖層內容時，另按「匯出卡面設定」，再執行 `bun run faces "combo-master-card-faces.json"`，將檔案內的卡片與範本合併到 `src/cardLayout/game-faces.json`。卡面設定檔可在其他瀏覽器匯入後接續編輯。

## 效果卡（逐張開放）

為了先把基本對戰調順，效果卡逐張開放：目前是 36 張花色招式＋效果招式 52 張＋裝備 8 張（清單與解讀見 `docs/規則詮釋.md`）。要加新卡，見 `docs/規則詮釋.md` 第三節的流程（核心是 `src/data/enabledCards.ts` 的 `ENABLED_EFFECT_CARDS`）。

## 與朋友連線

1. 一人按「建立房間」，取得 6 碼房號。
2. 另一人按「加入房間」，輸入房號。
3. 房主的瀏覽器執行遊戲規則，對方只傳送選擇、接收畫面。

作弊模式預設隱藏，是除錯用的功能；解鎖方法與用法見 `docs/規則詮釋.md` 的作弊模式一節。

兩人必須能連到公開的 PeerJS broker。兩人各自開上面的線上網址即可對戰；本機 `bun run dev` 只有同一台電腦或同網段能連。

## 戰績伺服器

戰績是全站共用的（決定見 `docs/adr/0005-global-cloud-records.md`）：單機對電腦與連線對戰（只由房主）正常結束的對局，會上傳到 Cloudflare Workers 加 D1 的小型伺服器；戰績頁從那裡取得所有玩家的戰績再在瀏覽器端統計。沒有登入，每個瀏覽器只有一個匿名的裝置代號，用來讓伺服器限流。

- 程式在 `server/`：`src/handler.ts` 是處理請求的函式（驗證、限流、冪等、來源限制，沒有任何刪除或修改的路徑），`src/d1.ts` 是資料表的讀寫，`schema.sql` 是資料表結構，`wrangler.toml` 是部署設定。
- 前端的戰績倉庫、補傳佇列與上傳在 `src/stats/`。上傳失敗的戰績存在本機佇列，下次啟動與每次對局結束後補傳；伺服器網址在 `src/stats/config.ts`：正式建置預設連線，本機開發與測試預設不連線（免得測試對局污染全站統計），要連時用環境變數 `VITE_RECORDS_API` 指定（設成空字串是關閉）；沒有網址時對局不受影響，戰績頁會說明雲端目前不可用。
- 測試：`tests/server.test.ts` 用 Node 內建的 SQLite 跑真正的資料表與 SQL，`tests/cloudRecords.test.ts` 涵蓋前端的倉庫、佇列與前後端串接。
- 本機試跑：`bun run server:db:local` 建立本機資料庫，`bun run server:dev` 在 http://127.0.0.1:8787 啟動伺服器；前端用 `VITE_RECORDS_API=http://127.0.0.1:8787 bun run dev` 連它。
- 部署：推送到 `main` 時由 `.github/workflows/deploy.yml` 部署伺服器，每次推送都部署。接著跑 `bun run server:check`，通過才發布遊戲。部署或檢查任一步失敗，遊戲也不會發布。
  - GitHub 的 repository secrets 要有 `CLOUDFLARE_API_TOKEN` 與 `CLOUDFLARE_ACCOUNT_ID`。token 在 Cloudflare 後台建立，範本選「Edit Cloudflare Workers」，帳號 ID 可用 `bunx wrangler@4 whoami` 查。用 `gh secret set <名稱>` 設定，依提示貼上值。
  - 資料庫遷移不會自動執行。有新的遷移時，推送前先手動對遠端資料庫跑完。
  - 本機也能用 `bun run server:deploy` 部署。下次推送會以倉庫裡的內容覆蓋它，所以改動要 commit 並推送。
- 線上檢查：`bun run server:check` 只讀不寫。它從 hub 的網址跟著轉址找到玩家實際開遊戲的網域，用這個來源確認 `/versions` 讀得到，`/records` 與 `/events` 的預檢會放行。它只在推送時自動執行；戰績頁連不上，或網站換網域時，手動跑一次。程式在 `scripts/check-records-server.ts`。
- 建立新的伺服器（需要一個免費的 Cloudflare 帳號，不用信用卡）：
  1. `bunx wrangler@4 login`，瀏覽器跳出授權頁時按允許。
  2. `bunx wrangler@4 d1 create combo-master-records`，把回報的 `database_id` 填進 `server/wrangler.toml`。
  3. `bun run server:db` 建立遠端資料表，`bun run server:deploy` 部署，記下回報的 `*.workers.dev` 網址，填進 `src/stats/config.ts` 的 `PRODUCTION_RECORDS_API` 後重新建置。目前部署在 `https://combo-master-records.ouo1.workers.dev`。
  4. 驗證：`curl -H "Origin: https://game.tempura.page" <網址>/versions` 回 `{"versions":[]}` 就通了。
- 允許的來源在 `server/src/handler.ts` 的 `ALLOWED_ORIGINS`（本站與本機開發網址）。要刪除或整理資料請直接在 Cloudflare 後台或用 `wrangler d1 execute` 操作，網站沒有這類介面。
- 新增角色時，`server/src/characters.ts` 要一起改，測試會提醒。

## 流量統計

匿名記錄有多少人進站、停留多久、有沒有開始或打完對局，名詞定義見 `GLOSSARY.md`。資料送到同一個戰績伺服器，存在 D1 的 `events` 資料表，和戰績分開，不影響勝率統計。

- 前端在 `src/stats/analytics.ts`：進站時登記一次造訪（每次載入頁面一個隨機造訪代號），分頁可見時每 30 秒回報一次累計的可見時間（心跳）、切走分頁時補送一次；單機、房主、訪客各自在對局開始與正常打完時送事件（`src/net/session.ts`）；教學也送，對戰類型是 `tutorial` 並帶課程編號 `lesson`，開始是進入某一課（重來本課算一次新的開始），完成是走到那一課的結束畫面，中途離開只有開始。只送匿名裝置代號、版本、對戰類型與事件名稱。
- 只有正式建置會送（沒有伺服器網址時什麼都不做，和戰績一樣）。要排除自己：在正式站網址後面加 `?notrack`，這個瀏覽器之後都不送，`?track` 恢復；每個瀏覽器各做一次。
- 伺服器的 `POST /events`（`server/src/handler.ts`）：事件寫成一列，心跳只更新造訪那一列的可見時間（只增不減，也不會超過造訪到現在實際經過的時間）。限流：單一裝置 10 分鐘最多新增 30 筆、全站每分鐘最多 300 筆；心跳不新增資料所以不計入，但同一次造訪兩次心跳至少隔 10 秒，太密的忽略。和戰績一樣，只靠來源標頭、格式驗證與限流擋濫用，任何人都能偽造資料。
- 沒有對外讀取的路徑，資料只有站長能讀：`bun run stats` 用 wrangler 查遠端資料庫，產生儀表板網頁（專案根目錄的 `traffic-report.html`，不進版本控制）並用瀏覽器開啟，內容是總覽、每日（台北時間）圖表、進站到玩完的漏斗、依版本與依對戰類型的表格；教學另外依課程每課一列，顯示開始數、完成數、完成率，舊的沒有課程欄位的教學事件歸第 1 課，不算進玩過與玩完的漏斗；`--text` 改在終端機印文字摘要，`--local` 讀本機試跑用的資料庫。儀表板在 `scripts/trafficDashboard.ts`，是不載入任何外部資源的單一網頁。停留時間是心跳回報的可見時間，切走分頁掛著的時間不算，誤差約 30 秒；人以所有事件的裝置代號去重，所以造訪被限流沒記到、但有開打的裝置也算一個人。
- 資料全部保留，不自動清除。要整理資料請直接在 Cloudflare 後台或用 `wrangler d1 execute` 操作。
- 資料庫結構的變更放在 `server/migrations/`，編號依序，**一定要照編號順序執行**；`schema.sql` 永遠是最新結構，新建的資料庫只要它。已上線的資料庫要先跑遷移，再推送。目前有兩個：`0001-events-allow-tutorial.sql`：流量事件的對戰類型多了教學，SQLite 不能直接改欄位限制，所以重建 events 資料表並搬資料；`0002-events-add-lesson.sql`：events 多一個可空的課程欄位 `lesson`，只有教學事件會填，舊的教學事件課程是空的，報表歸為第 1 課，第二次執行會報欄位已存在，資料不受影響。0002 一定要在 0001 之後：0001 重建資料表時只搬它認得的欄位，順序顛倒會把課程欄位丟掉。還沒遷移過的資料庫用 `bun run server:db:migrate` 一次依序跑完兩個；已經跑過 0001 的資料庫只跑 0002（`bun run server:db:migrate:0002`），不要重跑 0001，否則會把 `lesson` 欄位連資料一起丟掉。本機試跑用 `bun run server:db:migrate:local`。沒先遷移就推送的話，教學的開始與完成事件會被資料庫擋下，不影響遊戲，但那段時間的教學統計會缺。遷移檔裡有重跑與中途失敗的說明。
- 第一次上線，照這個順序：
  1. 建立遠端資料表：`bun run server:db`（可重複執行，不會動到既有的戰績）。
  2. 推送到 `main`，等 GitHub Actions 部署完。
  3. 驗證：`curl -X POST -H "Origin: https://game.tempura.page" -H "content-type: text/plain" -d '{"name":"visit","visitId":"verify-0001","deviceId":"verify-0001","version":"0.41.0"}' https://combo-master-records.ouo1.workers.dev/events` 回 `{"ok":true,"duplicate":false}` 就通了；再跑 `bun run stats` 會看到這一筆（驗證用的資料可以用 `wrangler d1 execute` 刪掉）。

## 問卷回饋

主畫面右下角有「問卷回饋」按鈕，點了用新分頁開啟問卷。按鈕連的永遠是戰績伺服器的固定網址 `<伺服器網址>/feedback`，伺服器再 302 轉址到目前的問卷，所以換問卷不用重新發布遊戲。

- 目的網址設定在 `server/wrangler.toml` 的 `FEEDBACK_URL`（必須是 https，否則伺服器回 503 不轉址）。轉址的程式在 `server/src/handler.ts` 的 `feedback`，不收查詢字串，所以不會被拿來轉到別的網站。
- 本機開發（沒有伺服器網址）時按鈕直接連 `src/stats/config.ts` 的 `FEEDBACK_FALLBACK_URL`；換問卷後它不改也不影響正式站。
- 要換問卷或改導向：只改 `server/wrangler.toml` 的 `FEEDBACK_URL`，commit 後推送到 `main`。部署完用 `curl -I https://combo-master-records.ouo1.workers.dev/feedback` 驗證，要看到 `302`，而且 `location:` 是你的問卷網址。不需要改遊戲程式。
- 要臨時關掉問卷導向：把 `FEEDBACK_URL` 改成空字串再推送，按鈕會顯示伺服器的 503 訊息。

## 結構

- `src/engine/`：規則引擎（不依賴介面與網路）。`game.ts` 回合流程、`combat.ts` 戰鬥、`effects.ts` 效果來源（各卡與角色的效果條目依職業放在 `sources/`）、`win.ts` 勝負。
- `src/data/`：卡表資料（含 xlsx 基準資料的覆蓋值）、預設牌組。
- `src/deck/`：牌組驗證與儲存。
- `src/net/`：網路與單機練習。`match.ts` 的對局持有引擎與作弊中樞，每次變化同時為兩位玩家產生更新；`session.ts` 的單機、房主、訪客三種連線方式交給介面使用，單機與房主建立在對局之上。雙方透過 `transport.ts` 的傳輸介面收發訊息，正式環境用 PeerJS，測試用記憶體內的假傳輸；訪客與房主之間的訊息格式在 `protocol.ts`。
- `src/stats/`：戰績。`records.ts` 把對局結果轉成戰績，`summary.ts` 是統計純函式，`cloud.ts` 的戰績倉庫上傳與取得全站戰績，`outbox.ts` 是補傳佇列，`upload.ts` 是上傳器，`analytics.ts` 是匿名流量統計（見「流量統計」）。
- `server/`：戰績伺服器（Cloudflare Workers 加 D1），見上一節。
- `src/ui/`：畫面。
- `assets/`：圖片資產，見「資產」。
- `scripts/`：資料產生、匯入與資產打包等指令。
