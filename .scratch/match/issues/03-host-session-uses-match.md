# 03：HostSession 改用 Match

**要建置什麼：** `HostSession` 不再自己持有 `Game` 與 `CheatHub`，改為建立在 `Match` 之上；收到 `hello` 時驗證訪客牌組仍在 `HostSession`，通過後才建立 `Match`。這一票不動 `hostCheat.test.ts`，用它證明行為沒變。網路、心跳、離線偵測與判負倒數維持原樣。規格見 `.scratch/match/spec.md`。

**Blocked by（被誰阻擋）：** 01

**Status：** ready-for-agent

- [ ] 送給訪客的 `view` 訊息每一條路徑都由 `Match` 的更新組成，欄位與重構前相同，協定不動
- [ ] 訪客提交失敗時，回 `reject` 並補送現況視角，補送的視角仍帶作弊的開關與檢視
- [ ] 訪客的作弊操作被拒絕時回報原因並補送視角；成功時送新視角與結果
- [ ] 操作者以連線身分為準：訪客只能開關自己的作弊模式，訊息裡自稱別人也沒用
- [ ] 遊戲開始前的作弊訊息被忽略
- [ ] 離線倒數與判負後，雙方都收到判負的更新
- [ ] `HostSession` 內不再直接呼叫 `viewFor`、`frameFor`、`drainFrames`
- [ ] `hostCheat.test.ts` 不改斷言、全部通過；現有測試全部通過；機器人壓測通過
- [ ] 純內部重構，依版本號維護規範不升版
