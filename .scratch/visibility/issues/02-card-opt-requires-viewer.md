# 02：cardOpt 的 viewer 改成必填並使用 faceVisibleTo

**要建置什麼：** `cardOpt` 以 `faceVisibleTo` 決定選項是否隱藏牌面，`viewer` 改成必填，所有呼叫點補上回應提示的玩家。規格見 `.scratch/visibility/spec.md`。

**Blocked by（被誰阻擋）：** 01

**Status：** ready-for-agent

- [ ] `cardOpt` 內不再自己寫可見性判斷，`viewer` 為必填參數
- [ ] 所有呼叫點傳入回應該提示的玩家
- [ ] 以測試證明：擁有者自己的裏側經驗卡在提示中看得到牌面，對手的只有位置
- [ ] 型別檢查、全部測試與機器人壓測通過，壓測勝率與基準相同
- [ ] 純內部重構，依版本號維護規範不升版
