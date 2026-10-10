import type { NewRecord } from './validate';

/** 取得戰績清單回傳的一筆：不含對局代號與裝置代號 */
export interface StoredRecord {
  version: string;
  opponent: 'cpu' | 'player';
  mine: string;
  theirs: string;
  outcome: 'win' | 'lose' | 'draw';
  turns: number;
  first?: boolean;
}

/** 資料存取介面：處理請求的函式只認得它，所以可以換成假的或換成別的資料庫 */
export interface Repo {
  /** 新增一筆；同一個對局代號已經有了就回傳 duplicate，不重複儲存 */
  insert(record: NewRecord, now: number): Promise<'inserted' | 'duplicate'>;
  /** 某個裝置從 since 起新增了幾筆 */
  countByDevice(deviceId: string, since: number): Promise<number>;
  /** 全站從 since 起新增了幾筆 */
  countAll(since: number): Promise<number>;
  /** 各版本的場數 */
  versions(): Promise<{ version: string; games: number }[]>;
  /** 依版本取得戰績，id 由小到大，從 after 之後開始；多取 1 筆判斷有沒有下一頁 */
  list(versions: string[], after: number, limit: number): Promise<{ records: StoredRecord[]; next: number | null }>;
}
