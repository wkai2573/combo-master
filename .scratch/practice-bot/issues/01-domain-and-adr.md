# 01：領域詞彙增補與架構決策紀錄

**要建置什麼：**
在領域模型與架構文件中正式定義單機練習電腦機器人的行為邊界、原則與詞彙，確立嚴格遵守牌面可見性（Face Visibility）、單一測試接縫以及對無視角呼叫之向下相容性承諾。

**Blocked by（被誰阻擋）：** 無（可立即開始）

**Status：** resolved

- [x] 在 `GLOSSARY.md` 的「語言」章節增補「電腦（CPU）」、「機器人（Bot）」、「啟發式決策（Heuristic Decision）」、「連擊潛力（Combo Potential）」、「收招保留（Conserving Pass）」，並標註避免使用之同義詞。
- [x] 撰寫 `docs/adr/0007-heuristic-bot-for-practice.md`，說明採用啟發式規則而非 MCTS 或全知引擎的背景、考慮過之選項與後果。
- [x] 確保詞彙與 ADR 符合既有專案文件風格與格式要求。

## Answer

已於 `GLOSSARY.md` 增補術語定義，並建立 `docs/adr/0007-heuristic-bot-for-practice.md` 固化架構決策。已於 v0.47.0 生效。

