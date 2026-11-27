/**
 * 檢查線上戰績伺服器能不能被正式站使用，只讀不寫。
 * 用法：bun run server:check
 */
import { PRODUCTION_RECORDS_API } from '../src/stats/config';
import { checkRecordsServer } from './serverCheckLib';

/** 遊戲發布到 hub，所以從這裡出發；hub 轉到哪個網域，玩家就在哪個網域 */
const SITE_ENTRY = 'https://hub.ouo1.workers.dev/combo-master/';

const { origin, failures } = await checkRecordsServer({ entry: SITE_ENTRY, api: PRODUCTION_RECORDS_API });

if (origin) console.log(`正式站來源：${origin}`);
console.log(`戰績伺服器：${PRODUCTION_RECORDS_API}`);
if (failures.length === 0) {
  console.log('檢查通過。');
} else {
  console.error(`檢查失敗：\n${failures.map((f) => `- ${f}`).join('\n')}`);
  process.exit(1);
}
