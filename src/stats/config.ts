/**
 * 雲端戰績伺服器的網址（Cloudflare Worker，部署方式見 README 的「戰績伺服器」）。
 * 只有正式建置才預設連它：本機開發與測試預設不連線，免得測試對局污染全站統計；
 * 要在本機連線時，用環境變數 VITE_RECORDS_API 指定網址（環境變數在任何情況都優先，設成空字串就是關閉）。
 * 沒有網址時戰績功能優雅降級：對局不上傳，戰績頁說明雲端目前不可用。
 */
const PRODUCTION_RECORDS_API = 'https://combo-master-records.combo-master-tcg.workers.dev';

const fromEnv = import.meta.env.VITE_RECORDS_API as string | undefined;

export const RECORDS_API: string = (fromEnv ?? (import.meta.env.PROD ? PRODUCTION_RECORDS_API : '')).replace(/\/+$/, '');
