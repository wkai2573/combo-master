import { getCard } from '../data/cards';
import { mine } from './kit';
import { NEXT, repeat, type TutorialChapter } from './script';

/** 玩家先打出的招式：戒備打擊（[頂]，在招式卡疊最上方時總攻擊 +1、總防禦 +2），連擊值 5 */
const GUARD = '戒備打擊';
/** 對手回應的招式：連擊值 4，範圍是 4~5 */
const FOE_REPLY = '紅心4';
/** 玩家用來蓋住戒備打擊的招式：連擊值 4，在範圍內；打完之後雙方手中都沒有範圍內的招式，自動收招 */
const COVER = '黑桃4';

/**
 * 教學：[頂] 疊在最上方 - 8
 * 玩家先攻打出戒備打擊，總攻擊與總防禦多了加成；對手回應後，再打一張招式蓋住它，加成消失。
 */
export const TOP_8: TutorialChapter = {
  characters: ['見習生', '教官'],
  first: 0,
  hands: [[GUARD, COVER, '黑桃1', '紅心2', '梅花9'], [FOE_REPLY, '黑桃1', '紅心2', '梅花9']],
  decks: [repeat('方塊4', 20), repeat('梅花7', 20)],
  steps: [
    {
      kind: 'explain',
      text: `這一課看標籤 [頂]。\n你手上的戒備打擊，卡面最前面的框寫著 [頂]。${NEXT}`,
      highlight: [{ kind: 'hand-card', cardId: GUARD }],
    },
    {
      kind: 'explain',
      text: `[頂] 的意思是「在招式卡疊最上方時才有效」：最後打出的那張招式，就在最上方。\n被後來打出的招式蓋住，效果就失效。${NEXT}`,
      highlight: [{ kind: 'combat-zones' }],
    },
    { kind: 'play', card: GUARD, text: '由你先攻，先手步驟打出戒備打擊。\n點擊或拖曳至戰鬥區。' },
    {
      kind: 'explain',
      text: (ctx) => {
        const { atk, def } = getCard(GUARD);
        const me = mine(ctx);
        return `戒備打擊在你的招式卡疊最上方，[頂] 生效：總攻擊 +${me.atk - atk}、總防禦 +${me.def - def}。\n你的總攻擊是 ${me.atk}（卡面 ${atk}），總防禦是 ${me.def}（卡面 ${def}）。${NEXT}`;
      },
      highlight: [{ kind: 'total', stat: 'atk' }, { kind: 'total', stat: 'def' }],
    },
    { kind: 'opponent-play', card: FOE_REPLY },
    { kind: 'play', card: COVER, text: '對手回應了。\n我們在範圍內再打出一張招式，蓋住戒備打擊。\n點擊或拖曳至戰鬥區。' },
    {
      kind: 'at-frame', match: { fx: 'pass', player: 'opp' },
      text: (ctx) => {
        const me = mine(ctx);
        return `戒備打擊被蓋住了，不再是最上方，[頂] 失效，加成立刻消失。\n你的總攻擊變成 ${me.atk}，總防禦變成 ${me.def}，只剩兩張招式本身的數字。${NEXT}`;
      },
      highlight: [{ kind: 'combat-cards', owner: 'me', cardId: GUARD }, { kind: 'total', stat: 'atk' }, { kind: 'total', stat: 'def' }],
    },
    {
      kind: 'explain',
      text: `[頂] 只看你自己的招式卡疊，對手打出的招式不會蓋住你的戒備打擊。\n想讓 [頂] 持續有效，就別再往上疊其他招式。\n點擊畫面結束這一課。`,
    },
  ],
};
