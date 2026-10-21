/**
 * 雲端戰績伺服器的網址（Cloudflare Worker，部署方式見 README 的「戰績伺服器」）。
 * 只有正式建置才預設連它：本機開發與測試預設不連線，免得測試對局污染全站統計；
 * 要在本機連線時，用環境變數 VITE_RECORDS_API 指定網址（環境變數在任何情況都優先，設成空字串就是關閉）。
 * 沒有網址時戰績功能優雅降級：對局不上傳，戰績頁說明雲端目前不可用。
 */
const PRODUCTION_RECORDS_API = 'https://combo-master-records.ouo1.workers.dev';

const fromEnv = import.meta.env.VITE_RECORDS_API as string | undefined;

export const RECORDS_API: string = (fromEnv ?? (import.meta.env.PROD ? PRODUCTION_RECORDS_API : '')).replace(/\/+$/, '');

/**
 * 問卷回饋：遊戲永遠連戰績伺服器的 /feedback，由伺服器轉址到目前的問卷（改問卷只改伺服器的 FEEDBACK_URL，不用重新發布遊戲）。
 * 沒有伺服器網址（本機開發、測試）時，直接連備用網址；它只影響本機開發，換問卷後不改也不會影響正式站。
 */
export const FEEDBACK_FALLBACK_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdZCBK4IwEDImkazrXJIiOwtLfNalrq8gkWlRmrFD0XQ99ycQ/viewform';
export const feedbackUrlFor = (recordsApi: string): string => (recordsApi ? `${recordsApi}/feedback` : FEEDBACK_FALLBACK_URL);
export const FEEDBACK_URL: string = feedbackUrlFor(RECORDS_API);
