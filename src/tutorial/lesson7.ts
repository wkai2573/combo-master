import { getCard } from '../data/cards';
import { mine } from './kit';
import { calcText, NEXT, repeat, type TutorialChapter } from './script';

/** 玩家連出兩張的招式：伏擊（先手步驟打出時發動，此回合總攻擊 +4），連擊值 9 */
const AMBUSH = '伏擊';
/** 對手回應的招式：連擊值 8，範圍是 8~9；雙方手中其他牌的連擊值都落在範圍外，打完就自動收招 */
const FOE_REPLY = '紅心8';

/**
 * 教學：[先] 先手步驟 - 7
 * 玩家先攻，先手步驟打出第一張伏擊（發動），對手回應後，反擊步驟打出第二張伏擊（不發動）。
 * 兩張伏擊連擊值相同，第二張是「重複連擊值只能一次」允許的那一次。
 * 牌組各 20 張：這一局的傷害不小，牌組要撐得住，腳本才不會在傷害計算之後就分出勝負。
 */
export const OPENING_7: TutorialChapter = {
  characters: ['見習生', '教官'],
  first: 0,
  hands: [[AMBUSH, AMBUSH, '黑桃1', '紅心2', '方塊4'], [FOE_REPLY, '黑桃1', '紅心2', '梅花1']],
  decks: [repeat('方塊4', 20), repeat('梅花7', 20)],
  steps: [
    {
      kind: 'explain',
      text: `這一課看標籤 [先]。\n你手上有兩張伏擊，卡面最前面的框都寫著 [先]。${NEXT}`,
      highlight: [{ kind: 'hand-card', cardId: AMBUSH }],
    },
    {
      kind: 'explain',
      text: `[先] 的意思是「先手步驟打出時發動」：只有先攻方在先手步驟打出的招式才會發動。\n上一課的 [發] 不挑步驟，[先] 只認先手步驟。${NEXT}`,
    },
    {
      kind: 'explain',
      text: `後攻方沒有先手步驟，所以後攻方打出的招式不會觸發 [先]。\n這一回合由你先攻，剛好可以看看 [先] 發動的樣子。${NEXT}`,
      highlight: [{ kind: 'combat-zones' }],
    },
    { kind: 'play', card: AMBUSH, text: '由你先攻，先手步驟打出第一張伏擊。\n點擊或拖曳至戰鬥區。' },
    {
      kind: 'at-frame', match: { fx: 'info' },
      text: (ctx) => {
        const own = getCard(AMBUSH).atk;
        const atk = mine(ctx).atk;
        return `在先手步驟打出，[先] 發動了：此回合總攻擊 +${atk - own}。\n伏擊本身的攻擊力是 ${own}，你的總攻擊現在是 ${atk}。${NEXT}`;
      },
      highlight: [{ kind: 'total', stat: 'atk' }],
    },
    { kind: 'opponent-play', card: FOE_REPLY },
    { kind: 'play', card: AMBUSH, text: '對手回應了，現在是反擊步驟。\n我們再打出第二張伏擊。\n點擊或拖曳至戰鬥區。' },
    {
      kind: 'at-frame', match: { fx: 'pass', player: 'opp' },
      text: (ctx) =>
        `同一張卡，這次是在反擊步驟打出的，[先] 沒有發動。\n你的總攻擊是 ${mine(ctx).atk}，只多了第二張伏擊本身的 ${getCard(AMBUSH).atk}，沒有再加一次。${NEXT}`,
      highlight: [{ kind: 'total', stat: 'atk' }, { kind: 'combat-cards', owner: 'me', cardId: AMBUSH }],
    },
    {
      kind: 'at-frame', match: { fx: 'calc' },
      text: (ctx) => `傷害計算：[先] 的加成這一回合只算了一次。\n${calcText(ctx)}`,
      highlight: [{ kind: 'total', stat: 'atk' }, { kind: 'total', stat: 'def' }],
    },
    {
      kind: 'explain',
      text: `比較一下：[發] 在哪個步驟打出都會發動，[先] 只在先攻方的先手步驟才發動。\n點擊畫面結束這一課。`,
    },
  ],
};
