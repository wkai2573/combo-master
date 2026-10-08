# 06：接入被蓋成裏側與歸還時

**要建置什麼：** 蓋反應與歸還時的塗毒改由效果來源提供，並處理兩個連帶變動。規格見 `.scratch/effect-source/spec.md`。

- 被蓋成裏側：低價買進、高價賣出。`pay` 改為對新被蓋成裏側的卡觸發這個時機，同一次蓋到多張時進同一個窗口，由擁有者決定先後，蓋反應仍是強制的。刪除 `COVER_REACTIONS` 與無人讀取的 `CardScript.onCovered`。
- 歸還時：塗毒把中毒移入出招卡較少那方的經驗區，相同時落入對方。`returnStep` 改成 Gen；沒有可選效果時不產生提示，行為與今天相同。

**Blocked by（被誰阻擋）：** 04

**Status：** ready-for-agent

- [ ] 蓋反應的說明文字與錄影格方式與遷移前相同，`covered.test.ts`、`frames.test.ts` 通過
- [ ] 同一次蓋到多張有蓋反應的卡，窗口行為與遷移前相同
- [ ] `returnStep` 改成 Gen，並在測試輔助檔新增把沒有提示的 Gen 跑完的函式；`cards2.test.ts` 與其他同步呼叫處改用它
- [ ] 塗毒的歸屬判定測試保留：出招較少者受毒，相同時落入對方
- [ ] `COVER_REACTIONS` 與 `CardScript.onCovered` 已刪除，`ops.ts`、`cost.ts` 沒有蓋反應的卡名比對
- [ ] 現有測試全部通過，沒有新增行為
- [ ] 型別檢查、單元測試與機器人壓測通過
- [ ] 純內部重構，依版本號維護規範不升版
