import { expCounts } from '../engine/view';
import { FOE_HAND, FOE_REPLY, MY_HAND, MY_OPENING, mine } from './kit';
import { fxOf, NEXT, repeat, type TutorialChapter } from './script';

/**
 * 教學：[經] 表側經驗 - 10（經驗區 4 張，最前面兩張是表側的高價賣出和預設裏側的低價買進，裝備增益區放著布甲）
 * 玩家出招後自動收招，收招時窗口裡只有布甲一個效果，所以走確認提示而不是選單。
 * 布甲蓋 1 把最前面的表側經驗高價賣出蓋成裏側，它的 [經] 發動，抽 1；低價買進一開始就是裏側，沒有反應。
 * 經驗區少於覺醒張數，不會覺醒。腳本停在高價賣出抽牌的那一格，之後的追擊與傷害不放出來。
 */
export const FACE_UP_EXP_10: TutorialChapter = {
  characters: ['見習生', '教官'],
  first: 0,
  hands: [MY_HAND, FOE_HAND],
  decks: [repeat('方塊4', 20), repeat('梅花7', 20)],
  zones: [{ exp: ['高價賣出', { id: '低價買進', covered: true }, '黑桃2', '黑桃3'], gear: ['布甲'] }, {}],
  steps: [
    {
      kind: 'explain',
      text: (ctx) => {
        const { faceUp, total } = expCounts(mine(ctx));
        return `這一課看標籤 [經]。\n你的經驗區有 ${total} 張卡，其中 ${faceUp} 張是表側。最前面兩張是高價賣出和低價買進，卡面最前面的框都寫著 [經]。${NEXT}`;
      },
      highlight: [{ kind: 'exp-zone', owner: 'me' }],
    },
    {
      kind: 'explain',
      text: `[經] 的意思是「在經驗區表側時才有效」：這類卡的效果，要在經驗區裡、而且是表側的時候才會生效。\n高價賣出和低價買進的效果，都是在它被蓋成裏側時發動。${NEXT}`,
      highlight: [{ kind: 'exp-zone', owner: 'me' }],
    },
    {
      kind: 'explain',
      text: `仔細看經驗區：高價賣出是表側，低價買進一開始就是裏側。\n你的裝備增益區放著布甲，收招時可以支付蓋 1，把最前面的表側經驗蓋成裏側。${NEXT}`,
      highlight: [{ kind: 'exp-zone', owner: 'me' }, { kind: 'gear-zone', owner: 'me' }],
    },
    { kind: 'play', card: MY_OPENING, text: '先來出招吧。由你先攻，先手步驟出招。\n點擊或拖曳至戰鬥區。' },
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
        `支付費用：最前面的 ${fxOf(ctx, 'cost').cover} 張表側經驗翻成了裏側，那就是高價賣出。${NEXT}`,
      highlight: [{ kind: 'exp-zone', owner: 'me' }],
    },
    {
      kind: 'at-frame', match: { fx: 'info' },
      text: (ctx) =>
        `高價賣出被蓋成裏側，它的 [經] 發動了：抽 1。\n你的手牌現在有 ${mine(ctx).hand.length} 張。${NEXT}`,
      highlight: [{ kind: 'hand-count', owner: 'me' }, { kind: 'exp-zone', owner: 'me' }],
    },
    {
      kind: 'explain',
      text: `低價買進一開始就是裏側，所以沒有反應。\n同樣是 [經]，表側的會發動，裏側的不會。${NEXT}`,
      highlight: [{ kind: 'exp-zone', owner: 'me' }],
    },
    {
      kind: 'explain',
      text: (ctx) => {
        const { faceUp, total } = expCounts(mine(ctx));
        return `高價賣出現在也變成裏側了，之後不再有效。\n經驗區共 ${total} 張，其中 ${faceUp} 張表側。這就是蓋 X 的代價。\n點擊畫面結束這一課。`;
      },
      highlight: [{ kind: 'exp-zone', owner: 'me' }],
    },
  ],
};
