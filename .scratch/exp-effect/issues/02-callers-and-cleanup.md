# 02：使用者改問登記表並刪除舊檔

**要建置什麼：** 高利貸與畫面高亮改問登記表；`src/ui/expEffect.ts` 與 `src/data/expEffect.ts` 刪除，讀卡文的正規表示式只留在測試；`expEffectActive` 搬到使用它的畫面元件旁。規格見 `.scratch/exp-effect/spec.md`。

**Blocked by（被誰阻擋）：** 01

**Status：** resolved

- [x] 高利貸數張數不再讀卡文
- [x] 畫面高亮不再讀卡文
- [x] `src/` 底下不再有讀卡文判斷經驗效果的程式碼
- [x] 既有 `expEffect.test.ts` 的案例保留
- [x] README 或規則詮釋若提到舊檔，同步更新
- [x] 型別檢查、建置、全部測試與機器人壓測通過，壓測勝率與基準相同
- [x] 純內部重構，依版本號維護規範不升版

## Answer

高利貸與畫面高亮改問登記表；`src/ui/expEffect.ts` 與 `src/data/expEffect.ts` 刪除，`expEffectActive` 搬到 `CardFace.tsx`，讀卡文的正規表示式只留在測試。README 與規則詮釋沒有提到舊檔，不需更新。全部測試、建置與壓測（勝率與基準相同）通過。
