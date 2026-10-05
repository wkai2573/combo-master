import type { ClassName } from './types';

/**
 * xlsx「角色」表中資料空白的職業，由這裡補上（build-data 在 xlsx 該列沒有角色名時套用）。
 * 之後若你把資料寫進 xlsx，xlsx 的內容會優先，這裡就不再生效。
 */
export const characterFill: Partial<Record<ClassName, { name: string; hp: number; expReq: number; text: string; awakenText: string }>> = {
  弓箭手: {
    name: '遊俠',
    hp: 50,
    expReq: 8,
    // 瞄準：把追擊變成可控的判定。看得到牌頂，就能挑對自己有利的牌來翻。
    text: '獲得【瞄準】。',
    awakenText: '（追加）獲得【瞄準】。',
  },
};
