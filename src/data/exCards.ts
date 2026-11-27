/**
 * Ex 卡：臨時額外卡，由其他卡片或角色的效果生成，不在牌組裡，也不能組進牌組。
 * 內容（卡名、特徵、效果）放在 cardTable.json 的 exCards，可透過卡表頁提案修改。
 * 效果的程式在 src/engine/sources 的共用條目。
 */

/** Ex 卡的卡名（也是 id）前綴 */
export const EX_PREFIX = 'Ex-';

/** 這張卡是不是 Ex 卡 */
export const isExCardId = (id: string): boolean => id.startsWith(EX_PREFIX);

/** Ex 效果來源登記的常駐區域：經驗區或增益區 */
export type ExZone = 'exp' | 'buff';
