import type { CardInst, PlayerId, ZoneName } from './types';

/**
 * 牌面可見性：viewer 看不看得到這張卡的牌面（ADR 0003）。
 * 手牌、怒氣區與牌組只有擁有者看得到；經驗區裏側的卡只有擁有者看得到；其餘區域公開。
 * 視角與提示選項都依這條規則，飛行動畫的牌堆呈現與作弊檢視不在此列。
 */
export function faceVisibleTo(card: CardInst, viewer: PlayerId): boolean {
  const mine = card.owner === viewer;
  const zone: ZoneName = card.zone;
  switch (zone) {
    case 'hand':
    case 'rage':
    case 'deck':
      return mine;
    case 'exp':
      return mine || !card.covered;
    case 'discard':
    case 'moves':
    case 'pursuit':
    case 'gear':
    case 'buff':
      return true;
    default: {
      // 新增區域時編譯會在這裡失敗，逼著先決定它的可見性
      const unreachable: never = zone;
      return unreachable;
    }
  }
}
