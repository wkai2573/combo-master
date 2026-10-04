import type { CardData } from './types';

/**
 * 目前開放使用的「效果卡」（有特徵或效果文字的招式、裝備、增益）。
 *
 * 為了先把基本對戰調順、不被平衡問題拖住，效果卡暫時全部停用，只留 36 張花色招式。
 * 效果的程式碼（src/engine/scripts.ts）與卡表（xlsx）都還在，要陸續加回來時，
 * 只要把卡名加進這個清單即可，例如：['吸血打擊', '戒備打擊']。
 *
 * 停用的卡：不會出現在組牌卡池、不能通過牌組驗證、預設牌組也不會用到。
 */
export const ENABLED_EFFECT_CARDS: string[] = [];

/** 花色招式：沒有特徵、也沒有效果文字的招式 */
export const isVanilla = (c: CardData): boolean => c.kind === 'move' && c.traits.length === 0 && c.text === '';

export const isCardEnabled = (c: CardData): boolean => isVanilla(c) || ENABLED_EFFECT_CARDS.includes(c.id);
