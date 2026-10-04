import type { CardData } from './types';

/**
 * 目前開放使用的「效果卡」（有特徵或效果文字的招式、裝備、增益）。
 *
 * 為了先把基本對戰調順、不被平衡問題拖住，效果卡先停用，每個角色逐張加回來（目前每個職業各 1 張）。
 * 效果的程式碼在 src/engine/scripts.ts；卡的數值與文字來自卡表網頁（src/data/cardTable.json）。
 * 要再開一張卡，確認描述並實作效果後，把卡名加進這個清單。
 *
 * 停用的卡：不會出現在組牌卡池、不能通過牌組驗證、預設牌組也不會用到。
 */
export const ENABLED_EFFECT_CARDS: string[] = ['魅影射擊', '戒備打擊', '力量爆破', '伏擊', '低價買進'];

/** 花色招式：沒有特徵、也沒有效果文字的招式 */
export const isVanilla = (c: CardData): boolean => c.kind === 'move' && c.traits.length === 0 && c.text === '';

export const isCardEnabled = (c: CardData): boolean => isVanilla(c) || ENABLED_EFFECT_CARDS.includes(c.id);
