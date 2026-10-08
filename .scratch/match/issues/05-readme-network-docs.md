# 05：更新 README 的網路層說明

**要建置什麼：** `README.md` 對 `src/net/` 的說明改成反映新的分工：`Match` 持有引擎並為兩位玩家產生更新，`session.ts` 的三種連線方式建立在它與傳輸介面之上。規格見 `.scratch/match/spec.md`。

**Blocked by（被誰阻擋）：** 04

**Status：** resolved

- [x] `README.md` 第 58 行附近對 `src/net/` 的說明更新，提到對局、房主、訪客與傳輸介面
- [x] 說明用詞與 `GLOSSARY.md` 一致
- [x] 全部測試與型別檢查通過
- [x] 文件修改，依版本號維護規範不升版

## Answer

`README.md` 的 `src/net/` 說明更新為對局、傳輸介面與連線方式的分工。
