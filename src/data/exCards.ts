import type { CardData } from './types';

/**
 * Ex 卡：臨時額外卡，由其他卡片的效果生成，不在牌組裡，也不能組進牌組。
 * （卡表的關鍵字「Ex卡-卡名」）
 */
export const EX_CARDS: CardData[] = [
  {
    id: 'Ex卡-中毒',
    name: 'Ex卡-中毒',
    kind: 'move',
    cls: '共用',
    traits: ['毒'],
    atk: 0,
    def: 0,
    combo: 0,
    expReq: 0,
    text: '[經]：當我方後攻的回合開始時，直擊我方3。\n當此卡離開經驗區時，移除遊戲。',
  },
];
