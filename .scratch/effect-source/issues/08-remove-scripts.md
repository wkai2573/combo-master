# 08：刪除 scripts.ts 並收緊檢查

**要建置什麼：** 所有條目都在效果來源後，刪除 `src/engine/scripts.ts`，把過渡期的寬鬆處理收緊，並更新引用它的文件。規格見 `.scratch/effect-source/spec.md`。

**Blocked by（被誰阻擋）：** 07

**Status：** resolved

- [x] `scripts.ts` 已刪除；`cards2.test.ts`、`rules.test.ts` 裡已無用的匯入一併移除
- [x] `hasEffect` 只查新登記表，不再有舊表備援
- [x] 開放名單的不變量測試改為嚴格版：開放名單裡每張卡都必須有條目，沒有例外
- [x] 引擎內不再有依卡名或角色名的比對，由搜尋確認
- [x] 更新 `README.md` 中對各卡效果檔案的說明
- [x] 更新 `docs/規則詮釋.md` 新增卡流程中指向實作位置的句子
- [x] 更新 `src/data/enabledCards.ts` 註解中的效果程式碼位置
- [x] 全部測試、型別檢查與機器人壓測通過
- [x] 純內部重構與文件修改，依版本號維護規範不升版

## Answer

純內部重構與文件修改，不升版（版本已在票 07 升到 v0.22.3）。`scripts.ts` 在票 07 已刪除；本票收緊開放名單的檢查為沒有例外，並更新 README、規則詮釋與開放名單檔案裡指向實作位置的說明。引擎內已沒有依卡名或角色名的比對，條目的 id 只出現在 `sources/` 裡。
