-- 遷移：流量事件 events 多一個可空的課程欄位 lesson，只有教學的開始與完成事件會填，值是課程編號。
-- 既有的事件（包含舊的教學事件）課程都是 NULL，報表一律把空課程的教學事件歸為第 1 課。
-- 必須排在 0001-events-allow-tutorial.sql 之後：0001 會重建 events 資料表，只搬它認得的欄位，
-- 如果順序顛倒（先 0002 再 0001），重建時課程欄位會被丟掉。已上線的資料庫先 0001、再 0002，再部署伺服器。
-- 這個檔不能重複執行：欄位已經存在時 SQLite 會報錯（duplicate column name），資料不受影響，看到這個錯誤就代表已經遷移過了。
ALTER TABLE events ADD COLUMN lesson INTEGER;
