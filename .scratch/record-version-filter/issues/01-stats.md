# 01：版本篩選純函式

**要建置什麼：** 統計純函式新增版本集合篩選、列出版本與場數、預設選取；移除舊版本的內建排除。 規格見 `.scratch/record-version-filter/spec.md`。

**Blocked by（被誰阻擋）：** 無（可立即開始）

**Status：** resolved

- [x] 純函式測試，既有統計測試改寫

## Answer

已於 v0.36.0 生效。統計純函式新增 versionCounts、defaultVersions、filterByVersions、isLegacyVersion，移除內建的舊版本排除。測試在 tests/recordStats.test.ts。
