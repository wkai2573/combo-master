/**
 * Ex 卡：臨時額外卡，由其他卡片或角色的效果生成，不在牌組裡，也不能組進牌組。
 * 內容（卡名、特徵、效果）在卡表的 Ex卡 區域維護，同步後放在 cardTable.json 的 exCards；
 * 效果的程式在 src/engine/sources 的共用條目。
 */

/** Ex 卡的卡名（也是 id）前綴 */
export const EX_PREFIX = 'Ex-';

/** 這張卡是不是 Ex 卡 */
export const isExCardId = (id: string): boolean => id.startsWith(EX_PREFIX);

/** 所有 Ex 卡的通則：離開經驗區就移除遊戲。引擎一律執行，每張 Ex 卡的效果文字仍保留這句讓玩家看得到 */
export const EX_LEAVE_RULE = '當此卡離開經驗區時，移除遊戲。';
