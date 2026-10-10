# 02：戰績倉庫、補傳佇列與場次層上傳

**要建置什麼：** 新增戰績倉庫介面（雲端版與記憶體假版）、補傳佇列、對局代號與裝置代號；單機與房主場次上傳，訪客不上傳。 規格見 `.scratch/cloud-records/spec.md`。

**Blocked by（被誰阻擋）：** 01

**Status：** resolved

- [x] 場次層上傳與補傳測試

## Answer

已於 v0.37.0 生效。戰績倉庫（雲端版與記憶體版）在 src/stats/cloud.ts，補傳佇列 outbox.ts，上傳器與裝置代號 upload.ts，場次層的接收函式 sink.ts；單機與房主上傳，訪客不上傳。測試 tests/cloudRecords.test.ts、tests/localSession.test.ts、tests/hostProtocol.test.ts。
