# 連擊大師

以連擊值接力出招的 1v1 TCG（網頁版）。規則書見 `docs/連擊大師.md`，實作時的規則解讀見 `docs/規則詮釋.md`。

## 線上玩

https://wkai2573.github.io/combo-master/

分頁標題、首頁與對戰畫面都會顯示版本（例如 `v0.2.0`；首頁另有 commit 代碼與建置時間，`+` 表示有未提交的變更），用來確認看到的是不是新版。版本號在 `package.json`，每次更新時調整。

推送到 `main` 後，GitHub Actions 會自動跑測試、建置並部署到 GitHub Pages（設定在 `.github/workflows/deploy.yml`）。

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
```

## 卡表網頁與數值同步

卡片、角色的數值在「連擊大師卡表」網頁（Claude 的 Artifact，只有擁有者能開）上調整，可以新增卡片。調完請 Claude 同步：Claude 用 `ArtifactData` 把資料讀成 JSON，再執行 `bun run table <資料夾>`，產生 `src/data/cardTable.json`（既有卡的數值覆蓋、角色數值、新增的卡、永久編號）。`src/data/cards.ts` 會把它疊在 xlsx 產生的資料上，所以重跑 `bun run data` 不會洗掉。

卡表頁面標題旁有頁面版本（例如 `v1.2`），下方顯示「遊戲已同步到 vX.Y.Z」，那是每次同步後由 Claude 寫進資料庫的 `meta/sync`；頁面上「尚未同步的改動」（黃框，旁邊是「原」值）是拿每筆資料的 `base`（基準值）和現值比對。所以同步完成後，Claude 要把有差異的資料的 `base` 一併重設成現值，黃框才會消失；`base.name` 不可動，它是遊戲內部 id（見 `docs/規則詮釋.md`），改過名的卡改把 `syncedName` 寫成現在的卡名，卡名那一格的黃框才會消失。

卡表有「Ex卡」分頁（在「卡片」分區，編號前綴 X）：Ex 卡是效果產生的臨時卡，只有卡名、特徵、效果三個欄位，可以新增、刪除與編輯，是 Ex 卡的唯一來源。卡名必須以 `Ex-` 開頭，內部 id 固定為新增時的卡名；同步時 `exCards` 一併寫進 `cardTable.json`，並檢查卡文引用的 `[Ex-卡名]` 都存在。新增一種 Ex 卡仍要引擎有對應實作（`src/engine/sources/common.ts`）。

卡表有「關鍵字」分頁：名稱、分類、說明。卡片與角色文字只用 `【名稱】` 或 `[標籤]` 引用關鍵字（例如遊俠只寫「獲得【瞄準】」），完整說明寫在關鍵字區塊；遊戲裡滑過卡片文字中的關鍵字會浮出說明，側欄的詳細視窗也會列出。對戰與組牌時，右鍵點卡片（或點一下不能操作的卡）可以固定詳細視窗，按 Esc 或「取消固定」解除。

效果文字不會自動套用：新描述要先由 Claude 跟你確認用語，確認後才寫進程式與實作效果。文字格式依 `docs/卡片撰寫規範.md`，卡表網頁的「撰寫規範」分頁也看得到；不符合規範的卡由 Claude 直接改寫並同步更新卡表。

## 效果卡（逐張開放）

為了先把基本對戰調順，效果卡逐張開放：目前是 36 張花色招式＋效果招式 34 張＋裝備 8 張（清單與解讀見 `docs/規則詮釋.md`）。要加新卡，見 `docs/規則詮釋.md` 第三節的流程（核心是 `src/data/enabledCards.ts` 的 `ENABLED_EFFECT_CARDS`）。

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
- 部署（需要一個免費的 Cloudflare 帳號，不用信用卡）：
  1. `bunx wrangler@4 login`，瀏覽器跳出授權頁時按允許。
  2. `bunx wrangler@4 d1 create combo-master-records`，把回報的 `database_id` 填進 `server/wrangler.toml`。
  3. `bun run server:db` 建立遠端資料表，`bun run server:deploy` 部署，記下回報的 `*.workers.dev` 網址，填進 `src/stats/config.ts` 的 `PRODUCTION_RECORDS_API` 後重新建置。目前部署在 `https://combo-master-records.combo-master-tcg.workers.dev`。
  4. 驗證：`curl -H "Origin: https://wkai2573.github.io" <網址>/versions` 回 `{"versions":[]}` 就通了。
- 允許的來源在 `server/src/handler.ts` 的 `ALLOWED_ORIGINS`（本站與本機開發網址）。要刪除或整理資料請直接在 Cloudflare 後台或用 `wrangler d1 execute` 操作，網站沒有這類介面。
- 新增角色時，`server/src/characters.ts` 要一起改，測試會提醒。

## 流量統計

匿名記錄有多少人進站、停留多久、有沒有開始或打完對局，名詞定義見 `GLOSSARY.md`。資料送到同一個戰績伺服器，存在 D1 的 `events` 資料表，和戰績分開，不影響勝率統計。

- 前端在 `src/stats/analytics.ts`：進站時登記一次造訪（每次載入頁面一個隨機造訪代號），分頁可見時每 30 秒回報一次累計的可見時間（心跳）、切走分頁時補送一次；單機、房主、訪客各自在對局開始與正常打完時送事件（`src/net/session.ts`）；新手教學也送，對戰類型是 `tutorial`，開始是進入教學，完成是走到教學結束畫面，中途離開只有開始。只送匿名裝置代號、版本、對戰類型與事件名稱。
- 只有正式建置會送（沒有伺服器網址時什麼都不做，和戰績一樣）。要排除自己：在正式站網址後面加 `?notrack`，這個瀏覽器之後都不送，`?track` 恢復；每個瀏覽器各做一次。
- 伺服器的 `POST /events`（`server/src/handler.ts`）：事件寫成一列，心跳只更新造訪那一列的可見時間（只增不減，也不會超過造訪到現在實際經過的時間）。限流：單一裝置 10 分鐘最多新增 30 筆、全站每分鐘最多 300 筆；心跳不新增資料所以不計入，但同一次造訪兩次心跳至少隔 10 秒，太密的忽略。和戰績一樣，只靠來源標頭、格式驗證與限流擋濫用，任何人都能偽造資料。
- 沒有對外讀取的路徑，資料只有站長能讀：`bun run stats` 用 wrangler 查遠端資料庫，產生儀表板網頁（專案根目錄的 `traffic-report.html`，不進版本控制）並用瀏覽器開啟，內容是總覽、每日（台北時間）圖表、進站到玩完的漏斗、依版本與依對戰類型的表格；教學另外列在依對戰類型的表格裡，不算進玩過與玩完的漏斗；`--text` 改在終端機印文字摘要，`--local` 讀本機試跑用的資料庫。儀表板在 `scripts/trafficDashboard.ts`，是不載入任何外部資源的單一網頁。停留時間是心跳回報的可見時間，切走分頁掛著的時間不算，誤差約 30 秒；人以所有事件的裝置代號去重，所以造訪被限流沒記到、但有開打的裝置也算一個人。
- 資料全部保留，不自動清除。要整理資料請直接在 Cloudflare 後台或用 `wrangler d1 execute` 操作。
- 資料庫結構的變更放在 `server/migrations/`，編號依序，每個檔都可以重複執行；`schema.sql` 永遠是最新結構，新建的資料庫只要它。已上線的資料庫要先跑遷移，再部署伺服器。目前只有 `0001-events-allow-tutorial.sql`：流量事件的對戰類型多了教學，SQLite 不能直接改欄位限制，所以重建 events 資料表並搬資料。遠端用 `bun run server:db:migrate`，本機試跑用 `bun run server:db:migrate:local`。順序反過來、或遊戲先推到 `main` 的話，教學的開始與完成事件會被伺服器或資料庫擋下，不影響遊戲，但那段時間的教學統計會缺，所以先遷移、再部署伺服器，最後才推遊戲。遷移檔裡有重跑與中途失敗的說明。
- 第一次上線，照這個順序：
  1. 建立遠端資料表：`bun run server:db`（可重複執行，不會動到既有的戰績）。
  2. 部署伺服器：`bun run server:deploy`。
  3. 驗證：`curl -X POST -H "Origin: https://wkai2573.github.io" -H "content-type: text/plain" -d '{"name":"visit","visitId":"verify-0001","deviceId":"verify-0001","version":"0.41.0"}' https://combo-master-records.combo-master-tcg.workers.dev/events` 回 `{"ok":true,"duplicate":false}` 就通了；再跑 `bun run stats` 會看到這一筆（驗證用的資料可以用 `wrangler d1 execute` 刪掉）。
  4. 再把遊戲推到 `main`。順序反過來的話，新版遊戲送事件會被舊伺服器回 404，統計會缺那段時間的資料，但不影響遊戲。

## 問卷回饋

主畫面右下角有「問卷回饋」按鈕，點了用新分頁開啟問卷。按鈕連的永遠是戰績伺服器的固定網址 `<伺服器網址>/feedback`，伺服器再 302 轉址到目前的問卷，所以換問卷不用重新發布遊戲。

- 目的網址設定在 `server/wrangler.toml` 的 `FEEDBACK_URL`（必須是 https，否則伺服器回 503 不轉址）。轉址的程式在 `server/src/handler.ts` 的 `feedback`，不收查詢字串，所以不會被拿來轉到別的網站。
- 本機開發（沒有伺服器網址）時按鈕直接連 `src/stats/config.ts` 的 `FEEDBACK_FALLBACK_URL`；換問卷後它不改也不影響正式站。
- 第一次上線，照這個順序：
  1. 先部署伺服器：`bun run server:deploy`（還沒登入過就先 `bunx wrangler@4 login`，瀏覽器跳出授權頁時按允許）。
  2. 驗證：`curl -I https://combo-master-records.combo-master-tcg.workers.dev/feedback`，要看到 `302` 和 `location:` 是你的問卷網址。
  3. 再把遊戲推到 `main`，等 GitHub Actions 部署完，按鈕就會出現。順序反過來的話，按鈕會短暫連到還沒有 `/feedback` 的舊伺服器。
- 之後要換問卷或改導向：只改 `server/wrangler.toml` 的 `FEEDBACK_URL`，執行 `bun run server:deploy`，再用上面的 curl 驗證。不需要動遊戲，也不需要重新建置。
- 要臨時關掉問卷導向：把 `FEEDBACK_URL` 改成空字串再部署，按鈕會顯示伺服器的 503 訊息。

## 結構

- `src/engine/`：規則引擎（不依賴介面與網路）。`game.ts` 回合流程、`combat.ts` 戰鬥、`effects.ts` 效果來源（各卡與角色的效果條目依職業放在 `sources/`）、`win.ts` 勝負。
- `src/data/`：卡表（花色招式與角色來自 xlsx，其餘由卡表網頁同步）、預設牌組。
- `src/deck/`：牌組驗證與儲存。
- `src/net/`：網路與單機練習。`match.ts` 的對局持有引擎與作弊中樞，每次變化同時為兩位玩家產生更新；`session.ts` 的單機、房主、訪客三種連線方式交給介面使用，單機與房主建立在對局之上。雙方透過 `transport.ts` 的傳輸介面收發訊息，正式環境用 PeerJS，測試用記憶體內的假傳輸；訪客與房主之間的訊息格式在 `protocol.ts`。
- `src/stats/`：戰績。`records.ts` 把對局結果轉成戰績，`summary.ts` 是統計純函式，`cloud.ts` 的戰績倉庫上傳與取得全站戰績，`outbox.ts` 是補傳佇列，`upload.ts` 是上傳器，`analytics.ts` 是匿名流量統計（見「流量統計」）。
- `server/`：戰績伺服器（Cloudflare Workers 加 D1），見上一節。
- `src/ui/`：畫面。
