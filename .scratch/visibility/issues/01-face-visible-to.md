# 01：新增 faceVisibleTo 並讓視角使用它

**要建置什麼：** 新增 `faceVisibleTo(card, viewer)`，`view.ts` 的 `playerView` 改用它決定各區域的牌面。規格見 `.scratch/visibility/spec.md`，詞彙見 `GLOSSARY.md` 的「牌面可見性」。

**Blocked by（被誰阻擋）：** 無（可立即開始）

**Status：** ready-for-agent

- [ ] 手牌與怒氣區只有擁有者看得到牌面；經驗區的裏側卡只有擁有者看得到；其餘區域公開
- [ ] `playerView` 不再自己寫可見性判斷
- [ ] 直接測試涵蓋每個區域、擁有者與對手、裏側與表側
- [ ] `GLOSSARY.md` 新增「牌面可見性」
- [ ] 既有測試不改斷言；型別檢查與全部測試通過
- [ ] 純內部重構，依版本號維護規範不升版
