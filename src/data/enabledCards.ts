import type { CardData } from './types';

/**
 * 目前開放使用的「效果卡」（有特徵或效果文字的招式、裝備、增益）。
 *
 * 為了先把基本對戰調順、不被平衡問題拖住，效果卡逐張開放（目前每個職業 4～6 張）。
 * 效果的程式碼在 src/engine/scripts.ts；卡的數值與文字來自卡表網頁（src/data/cardTable.json）。
 * 要再開一張卡，確認描述並實作效果後，把卡名加進這個清單。
 *
 * 不在清單裡的效果卡：不會出現在組牌卡池、不能通過牌組驗證、預設牌組也不會用到。
 */
export const ENABLED_EFFECT_CARDS: string[] = [
  '魅影射擊', '戒備打擊', '力量爆破', '伏擊', '低價買進',
  '高價賣出', '地雷陷阱', '復仇之嚎', '二刀連擊', '電弧',
  '狙擊印記', '順手牽羊', '交涉', '冰霜護甲', '盾擊', '即時停損', '二連矢', '凡骨的意志', '卸除鎧甲', '火球',
  '幸運兔腳', '塗毒', '家族相片', '瞄準器', '招財貓', '冰與雷之曲', 'Explosion!',
  '高利貸', '狙擊蓄力', '熔岩之擊',
];

/** 花色招式：沒有特徵、也沒有效果文字的招式 */
export const isVanilla = (c: CardData): boolean => c.kind === 'move' && c.traits.length === 0 && c.text === '';

export const isCardEnabled = (c: CardData): boolean => isVanilla(c) || ENABLED_EFFECT_CARDS.includes(c.id);
