# 04：HostSession 的傳輸介面與協定測試

**要建置什麼：** 引入傳輸介面，讓 `HostSession` 不直接建立 `Peer`；正式實作用 PeerJS，測試用記憶體內的假實作。重寫 `hostCheat.test.ts`，不再 `vi.mock('peerjs')`、不再強轉型呼叫私有方法，並補上目前完全沒有測試的協定與離線判負行為。規格見 `.scratch/match/spec.md`。

**Blocked by（被誰阻擋）：** 03

**Status：** resolved

- [x] 傳輸介面涵蓋開房含房號衝突重試、收到連線、對連線送訊息與收訊息、連線關閉與主動關閉
- [x] `HostSession` 建構時可傳入傳輸物件，預設是 PeerJS 的實作；正式環境的行為不變
- [x] `hostCheat.test.ts` 改用假傳輸，沒有 `vi.mock`，沒有對私有成員的強轉型，原有的案例都保留
- [x] 新增測試：訪客牌組不合法時被拒絕，說明第一個錯誤
- [x] 新增測試：房間已滿或遊戲已開始時，第二個連線被拒絕並關閉
- [x] 新增測試：收到 `ping` 回 `pong`
- [x] 新增測試：訪客超過離線門檻沒有回應，房主標記對手離線，倒數結束判房主獲勝，雙方都收到更新，用假計時器
- [x] 新增測試：離線倒數期間訪客再次出聲，倒數取消並恢復在線
- [x] 新增測試：房號衝突時換房號重試，超過次數後回報錯誤
- [x] 型別檢查、單元測試與機器人壓測通過
- [x] 純內部重構與測試新增，依版本號維護規範不升版

## Answer

新增 `src/net/hostTransport.ts`：`HostTransport`、`HostLink`、`RoomError` 與 PeerJS 實作 `peerTransport`。房號衝突的重試邏輯留在 `HostSession`（傳輸介面只回報房號被占用），這樣可以用假傳輸測。`tests/fakeTransport.ts` 是記憶體內的假傳輸；`hostCheat.test.ts` 不再 mock 套件、不再強轉型；新增 `tests/hostProtocol.test.ts` 涵蓋牌組驗證、滿房、心跳、離線判負、恢復在線與房號重試。
