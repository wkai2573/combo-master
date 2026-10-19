/**
 * Ex 卡：臨時額外卡，由其他卡片或角色的效果生成，不在牌組裡，也不能組進牌組。
 * 內容（卡名、特徵、效果）在卡表的 Ex卡 區域維護，同步後放在 cardTable.json 的 exCards；
 * 效果的程式在 src/engine/sources 的共用條目。
 */

/** Ex 卡的卡名（也是 id）前綴 */
export const EX_PREFIX = 'Ex-';

/** 這張卡是不是 Ex 卡 */
export const isExCardId = (id: string): boolean => id.startsWith(EX_PREFIX);

/** Ex 卡可以待的區域：經驗區或增益區 */
export type ExZone = 'exp' | 'buff';

/** 所有 Ex 卡的通則：離開所在的區域就移除遊戲。引擎一律執行，每張 Ex 卡的效果文字依所在區域保留對應的一句讓玩家看得到 */
export const EX_LEAVE_RULES: Readonly<Record<ExZone, string>> = {
  exp: '當此卡離開經驗區時，移除遊戲。',
  buff: '當此卡離開增益區時，移除遊戲。',
};

/**
 * 檢查 Ex 卡的文字有沒有通則。zone 是這張 Ex 卡實際待的區域（效果來源登記的常駐位置），必須寫對應區域的那一句；
 * 還沒有登記效果來源、不知道待在哪個區域時（zone 為 undefined），兩句擇一即可。回傳不符的說明，空字串＝符合
 */
export function checkExLeaveRule(text: string, zone?: ExZone): string {
  if (zone) return text.includes(EX_LEAVE_RULES[zone]) ? '' : `缺少「${EX_LEAVE_RULES[zone]}」`;
  return Object.values(EX_LEAVE_RULES).some((rule) => text.includes(rule)) ? '' : `缺少「${EX_LEAVE_RULES.exp}」或「${EX_LEAVE_RULES.buff}」`;
}
