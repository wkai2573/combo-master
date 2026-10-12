import type { CardData } from './types';

/**
 * 目前開放使用的「效果卡」（有特徵或效果文字的招式、裝備、增益）。
 *
 * 為了先把基本對戰調順、不被平衡問題拖住，效果卡逐張開放（目前每個職業 4～6 張）。
 * 效果的程式碼是 src/engine/sources 底下的效果來源條目；卡的數值與文字來自卡表網頁（src/data/cardTable.json）。
 * 要再開一張卡，確認描述並實作效果後，把卡名加進這個清單。
 *
 * 不在清單裡的效果卡：不會出現在組牌卡池、不能通過牌組驗證、預設牌組也不會用到。
 */
export const ENABLED_EFFECT_CARDS: string[] = [
  '魅影射擊', '戒備打擊', '力量爆破', '伏擊', '低價買進',
  '高價賣出', '地雷陷阱', '復仇之嚎', '二刀連擊', '電弧',
  '狙擊印記', '順手牽羊', '交涉', '冰霜護甲', '盾擊', '即時停損', '二連矢', '凡骨的意志', '卸除鎧甲', '火球',
  '幸運兔腳', '塗毒', '家族相片', '瞄準器', '招財貓', '冰與雷之曲', 'Explosion!',
  '公開資訊', '狙擊蓄力', '熔岩之擊', '布甲', '木棍', '元素法典', '財富管理', '嘲諷', '生命偷取', '生命藥水',
  '職業專精書', '洩憤',
];

/** 花色招式：沒有特徵、也沒有效果文字的招式 */
export const isVanilla = (c: CardData): boolean => c.kind === 'move' && c.traits.length === 0 && c.text === '';

/** 職業卡：職業欄不是「共用」的卡 */
export const isClassCard = (c: CardData): boolean => c.cls !== '共用';

export const isCardEnabled = (c: CardData): boolean => isVanilla(c) || ENABLED_EFFECT_CARDS.includes(c.id);
