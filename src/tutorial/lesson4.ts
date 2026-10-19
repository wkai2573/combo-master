import { expCounts } from '../engine/view';
import { FOE_HAND, FOE_REPLY, MY_HAND, MY_OPENING, mine } from './kit';
import { fxOf, NEXT, repeat, type TutorialChapter } from './script';

/**
 * 教學：蓋 X - 4（經驗區 8 張表側、已經覺醒，裝備增益區放著布甲）
 * 玩家出招後自動收招，收招時窗口裡只有布甲一個效果，所以走確認提示而不是選單。
 */
export const COVER_COST_4: TutorialChapter = {
  characters: ['修行者', '教官'],
  first: 0,
  hands: [MY_HAND, FOE_HAND],
  decks: [repeat('方塊4', 10), repeat('梅花7', 10)],
  zones: [{ exp: ['黑桃2', '黑桃3', '黑桃4', '紅心3', '紅心4', '方塊2', '方塊3', '梅花2'], gear: ['布甲'] }, {}],
  steps: [
    {
      kind: 'explain',
      text: (ctx) =>
        `你的經驗區有 ${expCounts(mine(ctx)).faceUp} 張表側的卡，而且已經覺醒。\n表側的經驗可以拿來支付費用，叫做「蓋 X」：從最前面開始，把 X 張表側經驗翻成裏側。${NEXT}`,
      highlight: [{ kind: 'exp-zone', owner: 'me' }],
    },
    {
      kind: 'explain',
      text: `你的裝備增益區已經裝備了布甲：我方收招時，可以支付蓋 1，這回合總防禦 +1。${NEXT}`,
      highlight: [{ kind: 'gear-zone', owner: 'me' }],
    },
    { kind: 'play', card: MY_OPENING, text: '由你先攻，先手步驟出招。\n點擊或拖曳至戰鬥區。' },
    { kind: 'opponent-play', card: FOE_REPLY },
    {
      kind: 'at-frame', match: { fx: 'pass', player: 'me' },
      text: `你手中沒有範圍內的招式可以再出，自動收招了。\n收招時，布甲的效果可以發動。${NEXT}`,
      highlight: [{ kind: 'gear-zone', owner: 'me' }],
    },
    { kind: 'choose', key: 'yes', text: '畫面問你是否發動布甲，需要支付蓋 1。\n請按「發動」。' },
    {
      kind: 'at-frame', match: { fx: 'cost', player: 'me' },
      text: (ctx) =>
        `支付費用：最前面的 ${fxOf(ctx, 'cost').cover} 張表側經驗翻成了裏側。\n蓋 X 一律從最前面的表側經驗開始蓋。${NEXT}`,
      highlight: [{ kind: 'exp-zone', owner: 'me' }],
    },
    {
      kind: 'explain',
      text: `裏側的經驗效果無效，而且只有擁有者看得到牌面，對手只知道張數。這就是蓋 X 的代價。${NEXT}`,
      highlight: [{ kind: 'exp-zone', owner: 'me' }],
    },
    {
      kind: 'at-frame', match: { fx: 'info' },
      text: (ctx) => `布甲的效果生效了：你的總防禦現在是 ${mine(ctx).def}，多了 1 點。${NEXT}`,
      highlight: [{ kind: 'total', stat: 'def' }],
    },
    {
      kind: 'explain',
      text: (ctx) => {
        const { faceUp, total } = expCounts(mine(ctx));
        return `經驗區現在共 ${total} 張，其中 ${faceUp} 張表側。\n裏側的經驗仍然算在覺醒張數內，所以你還是覺醒。\n點擊畫面結束這一課。`;
      },
      highlight: [{ kind: 'awaken-mark', owner: 'me' }, { kind: 'exp-zone', owner: 'me' }],
    },
  ],
};
