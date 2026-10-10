# 03：戰績頁改讀雲端

**要建置什麼：** 戰績頁依選的版本與對手類型從戰績倉庫取資料，載入中、錯誤、空狀態，移除清除全部紀錄按鈕。 規格見 `.scratch/cloud-records/spec.md`。

**Blocked by（被誰阻擋）：** 02, record-version-filter 02

**Status：** resolved

- [x] 型別檢查、全部測試通過

## Answer

已於 v0.37.0 生效。戰績頁改讀雲端：useCloudRecords 取各版本場數與戰績、本機備援、載入中與錯誤重試；移除清除全部紀錄。在瀏覽器（Edge）對著本機伺服器驗證過：頁面顯示、跨來源上傳、啟動補傳，以及單機打完一場自動上傳。
