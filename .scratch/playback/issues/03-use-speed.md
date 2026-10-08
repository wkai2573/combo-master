# 03：速度偏好收進 useSpeed

**要建置什麼：** 在 `usePlayback.ts` 新增 `useSpeed()`，讀初始值（`initialSpeed` 與減少動態偏好）、寫回儲存，回傳 `[speed, setSpeed]`；Battle 刪掉自己的偏好讀寫。規格見 `.scratch/playback/spec.md`。

**Blocked by（被誰阻擋）：** 02

**Status：** ready-for-agent

- [ ] `useSpeed()` 讀不到或寫不進儲存時視同沒選過、忽略失敗，與重構前相同
- [ ] Battle 不再直接碰 `localStorage` 或 `matchMedia`
- [ ] `initialSpeed` 與既有的 `speed.test.ts` 不改
- [ ] 型別檢查、建置與全部測試通過
- [ ] 純內部重構，依版本號維護規範不升版
