# 02：Battle 改用呈現

**要建置什麼：** `usePlayback` 改成包住 `Playback` 的薄 hook，只負責 `setTimeout` 與生命週期，回傳呈現與 `skip`。Battle 刪掉自己拼桌面、`lastShown`、`changes`、`hitOf` 的程式碼，改用呈現；`result` 仍在 Battle，由 `settled`、勝負與自己的編號決定。規格見 `.scratch/playback/spec.md`。

**Blocked by（被誰阻擋）：** 01

**Status：** resolved

- [x] `usePlayback` 內不再有排佇列與切換桌面的邏輯，只有計時器接線、速度變化時的處理與卸載重置
- [x] Battle 不再出現 `lagging`、`lastShown`、`statChanges`、`flightTiming`
- [x] 清除提示選擇的時機、跳過動畫按鈕、提示列顯示「動畫播放中」、作弊面板鎖定、棋盤的播放中樣式，都由呈現的 `playing` 與 `settled` 決定，行為與重構前相同
- [x] 結果視窗仍然等播完才出現
- [x] 手動走一場單機：開局動畫、出招動畫、跳過、切換速度（含關閉動畫）、結算後出現結果視窗，都與重構前一致
- [x] 型別檢查、建置與全部測試通過
- [x] 純內部重構，依版本號維護規範不升版

## Answer

`usePlayback(batch, final, speed)` 改成包住 `Playback` 的薄 hook，只剩計時器接線、速度切到關閉時結束播放與卸載重置，回傳 `{ presentation, skip }`。Battle 刪掉拼桌面、`lastShown`、`changes`、`hitOf` 與對 `flightTiming`、`statChanges` 的依賴；`result` 以 `playing` 與勝負決定，與重構前的判斷一致。以無頭瀏覽器實測單機整場：開局動畫、跳過、播放中切到關閉動畫、結算後出現結果視窗，沒有錯誤。
