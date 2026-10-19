import { foe, mine } from './kit';
import { fxOf, NEXT, repeat, type TutorialChapter } from './script';

/** 玩家反擊步驟打出的招式：火球（打出時發動，蓋 3，對手直擊 2），連擊值 3 */
const FIREBALL = '火球';
/** 對手先攻打出的招式：連擊值 9，範圍是 3~9；雙方手中其他牌的連擊值都是 1 或 2，打完火球就自動收招 */
const FOE_OPENING = '紅心9';

/**
 * 教學：[發] 打出時發動 - 6（經驗區預設 4 張表側，足以支付蓋 3）
 * 對手先攻，玩家在反擊步驟打出火球。火球在這一課走確認提示而不是選單：它的 [發] 是窗口裡唯一的效果。
 * 腳本停在「對手直擊 2」那一格結束，之後的追擊與傷害不放出來。
 */
export const ON_PLAY_6: TutorialChapter = {
  characters: ['見習生', '教官'],
  first: 1,
  hands: [[FIREBALL, '黑桃1', '紅心2', '梅花1', '方塊2'], [FOE_OPENING, '黑桃1', '紅心2', '梅花1']],
  decks: [repeat('方塊4', 10), repeat('梅花7', 10)],
  zones: [{ exp: ['黑桃2', '黑桃3', '黑桃4', '紅心3'] }, {}],
  steps: [
    {
      kind: 'explain',
      text: `招式卡的卡面最前面有一個小框，叫做「標籤」，它說明這張卡的效果在什麼時機生效。\n你手上的火球，最前面的框寫著 [發]。${NEXT}`,
      highlight: [{ kind: 'hand-card', cardId: FIREBALL }],
    },
    {
      kind: 'explain',
      text: `[發] 的意思是「打出時發動」：這張招式一打出，效果就發動。\n不論在哪個步驟打出，都是一樣的。${NEXT}`,
    },
    { kind: 'opponent-play', card: FOE_OPENING },
    {
      kind: 'explain',
      text: `這一回合由對手先攻，他在先手步驟打出了招式。\n你是後攻方，要在反擊步驟出招。${NEXT}`,
      highlight: [{ kind: 'combat-zones' }],
    },
    { kind: 'play', card: FIREBALL, text: '我們在反擊步驟打出火球。\n點擊或拖曳至戰鬥區。' },
    { kind: 'choose', key: 'yes', text: '火球一打出，[發] 就發動：支付蓋 3，對手直擊 2。\n畫面問你是否發動，請按「發動」。' },
    {
      kind: 'at-frame', match: { fx: 'cost', player: 'me' },
      text: (ctx) => `支付費用：最前面的 ${fxOf(ctx, 'cost').cover} 張表側經驗翻成了裏側。${NEXT}`,
      highlight: [{ kind: 'exp-zone', owner: 'me' }],
    },
    {
      kind: 'at-frame', match: { fx: 'info' },
      text: (ctx) =>
        `[發] 的效果發動：對手直擊 2，牌組上方的 2 張卡直接放進棄牌區。\n對手的牌組現在剩 ${foe(ctx).deckCount} 張。${NEXT}`,
      highlight: [{ kind: 'deck-count', owner: 'opp' }],
    },
    {
      kind: 'explain',
      text: (ctx) =>
        `你的經驗區有 ${mine(ctx).exp.length} 張卡，其中 ${mine(ctx).exp.filter((c) => c.covered).length} 張剛被蓋成裏側。\n[發] 只看「打出的那一刻」，在先手步驟或反擊步驟打出，都會發動。\n點擊畫面結束這一課。`,
      highlight: [{ kind: 'exp-zone', owner: 'me' }],
    },
  ],
};
