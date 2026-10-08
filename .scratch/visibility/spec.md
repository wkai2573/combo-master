Status: resolved

# 牌面可見性：誰看得到哪張牌的牌面，只寫一次

## 問題陳述

ADR 0003 的規則「裏側的經驗卡只有擁有者看得到牌面、對手手牌與怒氣區看不到」在兩處各寫一次：

- `src/engine/view.ts` 的 `playerView`：手牌與怒氣區 `mine`，經驗區 `!c.covered || mine`。
- `src/engine/ops.ts` 的 `cardOpt`：`c.zone === 'exp' && c.covered && viewer !== c.owner`。

`cardOpt` 的 `viewer` 是選填，漏傳就會把擁有者自己的裏側卡蓋住。五個呼叫點只有 `chooseCards` 傳了，其他四個碰巧不會遇到裏側卡。

## 解決方案

詞彙見 `GLOSSARY.md` 的「牌面可見性」（本案新增）與 ADR 0003。

新增 `faceVisibleTo(card, viewer)`：手牌與怒氣區只有擁有者看得到牌面；經驗區的裏側卡只有擁有者看得到；其餘公開。視角與提示選項都用它，`cardOpt` 的 `viewer` 改成必填。

### 決策摘要

- `flights.ts` 的「怒氣區一律畫牌背」是牌堆怎麼畫，不是資訊規則，不動；`cheat.ts` 是刻意全開，不動。
- 不另記 ADR：規則本身是 ADR 0003，這裡只是讓它只有一份實作。
- 規則統一後，提示選項若列出對手的手牌或怒氣區，會改成只顯示牌背；目前沒有已知的提示這樣做，以全部測試與機器人壓測確認，發現有就停下來問。

## 範圍外

- 飛行動畫的牌堆呈現。
- 作弊檢視。
- 新增允許查看裏側卡的效果。

## 測試策略

- `faceVisibleTo` 直接測：每個區域、擁有者與對手、裏側與表側。
- 既有的 `covered.test.ts` 不改斷言。

## 版本

純內部重構，依版本號維護規範不升版。

## 票券

1. `01-face-visible-to.md`
2. `02-card-opt-requires-viewer.md`
