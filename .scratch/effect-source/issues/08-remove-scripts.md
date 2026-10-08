# 08：刪除 scripts.ts 並收緊檢查

**要建置什麼：** 所有條目都在效果來源後，刪除 `src/engine/scripts.ts`，把過渡期的寬鬆處理收緊，並更新引用它的文件。規格見 `.scratch/effect-source/spec.md`。

**Blocked by（被誰阻擋）：** 07

**Status：** ready-for-agent

- [ ] `scripts.ts` 已刪除；`cards2.test.ts`、`rules.test.ts` 裡已無用的匯入一併移除
- [ ] `hasEffect` 只查新登記表，不再有舊表備援
- [ ] 開放名單的不變量測試改為嚴格版：開放名單裡每張卡都必須有條目，沒有例外
- [ ] 引擎內不再有依卡名或角色名的比對，由搜尋確認
- [ ] 更新 `README.md` 中對各卡效果檔案的說明
- [ ] 更新 `docs/規則詮釋.md` 新增卡流程中指向實作位置的句子
- [ ] 更新 `src/data/enabledCards.ts` 註解中的效果程式碼位置
- [ ] 全部測試、型別檢查與機器人壓測通過
- [ ] 純內部重構與文件修改，依版本號維護規範不升版
