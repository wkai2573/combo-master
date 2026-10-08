import type { CardInst, PlayerId } from './types';

/**
 * 牌面可見性：viewer 看不看得到這張卡的牌面（ADR 0003）。
 * 手牌與怒氣區只有擁有者看得到；經驗區裏側的卡只有擁有者看得到；其餘區域公開。
 * 視角與提示選項都依這條規則，飛行動畫的牌堆呈現與作弊檢視不在此列。
 */
export function faceVisibleTo(card: CardInst, viewer: PlayerId): boolean {
  const mine = card.owner === viewer;
  switch (card.zone) {
    case 'hand':
    case 'rage':
      return mine;
    case 'exp':
      return mine || !card.covered;
    default:
      return true;
  }
}
