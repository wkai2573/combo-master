Status: resolved

# 對局：把持有引擎的一方抽成 Match

## 問題陳述

單機與房主都是「持有引擎的一方」，`src/net/session.ts` 裡的 `LocalSession` 與 `HostSession` 各自重複了同一套邏輯：

- 建立 `Game` 與 `CheatHub`。
- 用 `viewFor` 與 `frameFor` 為玩家產生視角與影格，並取走影格、編批次。
- 作弊介面的包裝，以及提交時對錯誤的處理。

此外 `HostSession` 把網路、計時與規則授權混在一個類別，造成：

- 測試只能 `vi.mock('peerjs')`，並強轉型呼叫私有的 `onConnection`。
- 訪客牌組驗證、拒絕滿房、心跳、離線偵測與 30 秒判負倒數、單機機器人，全都沒有測試。

## 解決方案

新增 `Match`，詞彙見 `GLOSSARY.md` 的「對局」「房主」「訪客」。它持有 `Game` 與 `CheatHub`，為兩位玩家同時產生更新。單機與房主改為建立在它之上。機器人、離線判負與 PeerJS 留在外面。`HostSession` 另外接受可注入的傳輸介面，測試就不必 mock 套件。

### 介面草圖

```ts
class Match {
  constructor(decks: [DeckSpec, DeckSpec])      // 一律錄製影格
  readonly over: boolean
  readonly pending: Request | null              // 機器人要看
  flush(): MatchUpdate                          // 取走自上次以來的變化，開局時用
  submit(by, keys): 結果 + MatchUpdate
  forfeit(player, reason): MatchUpdate
  cheatSwitch(by, on): MatchUpdate
  cheat(by, op): 結果 + MatchUpdate             // 授權檢查在內
  snapshot(): MatchUpdate                       // 現況視角，不帶影格，補送用
  cheatSnapshot(player): CheatSnapshot | null   // 單機與房主讀自己的作弊檢視
}
type MatchUpdate = [SeatUpdate, SeatUpdate]     // 玩家 A、玩家 B
interface SeatUpdate { view; frames; cheatOn; cheatSnap }
```

### 決策摘要

- 變更方法直接回傳兩位玩家的更新，不做訂閱。所有變化都來自外部呼叫，沒有被動事件。
- 影格取走一次就清空，所以兩位玩家的更新必須同時產生。
- `submit` 與 `cheat` 的拒絕以回傳結果表示，呼叫者不再 `try/catch`；行為與現在一致，現在不論是什麼例外都會被捕捉並顯示訊息。
- 訪客牌組的合法性檢查留在 `HostSession` 收到 `hello` 的地方，不進 `Match`。
- `CheatHub` 保留，由 `Match` 組合。
- 單機與房主對自己的作弊檢視，每次讀都是即時的，不快取。

### 傳輸介面

`HostSession` 不直接建立 `Peer`，而是接受一個傳輸物件，涵蓋：

- 開房，含房號衝突時的重試。
- 收到連線。
- 對連線送訊息與收訊息。
- 連線關閉與主動關閉。

正式實作用 PeerJS，測試用記憶體內的假實作；建構時可傳入，預設是 PeerJS。

## 範圍外

- UI 的 `Session` 介面、`Lobby.tsx`、`Battle.tsx`。
- `GuestSession`。
- `ClientMsg` 與 `HostMsg` 協定。
- 機器人與離線判負的規則：留在外面，各只有一個使用者。
- 時鐘注入：測試用 vitest 的假計時器。

## 測試策略

- `Match` 直接測，不 mock、不連網。
- `HostSession` 透過假傳輸測協定；離線與判負用假計時器。
- 現有的 `cheatHub.test.ts` 不動。

## 版本

純內部重構，依版本號維護規範不升版。

## 票券

1. `01-match-module.md`
2. `02-local-session-uses-match.md`
3. `03-host-session-uses-match.md`
4. `04-host-transport-and-protocol-tests.md`
5. `05-readme-network-docs.md`
