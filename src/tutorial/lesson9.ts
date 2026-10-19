import { getCard } from '../data/cards';
import { FOE_HAND, FOE_REPLY, MY_HAND, MY_OPENING, mine } from './kit';
import { comboRange, fxOf, NEXT, repeat, type TextContext, type TutorialChapter } from './script';

/** 玩家牌組頂的牌：地雷陷阱（成為追擊卡時總攻擊 +3），連擊值 3，在雙方招式 5 和 6 的範圍之外 */
const MINE_TRAP = '地雷陷阱';

/** 我方戰鬥區（招式卡疊加追擊卡疊）卡面攻擊力的合計 */
const printedAtk = (ctx: TextContext): number => {
  const me = mine(ctx);
  return [...me.moves, ...me.pursuit].reduce((n, c) => n + (c.id ? getCard(c.id).atk : 0), 0);
};

/**
 * 教學：[追] 追擊成功 - 9
 * 玩家先攻出招，對手回應後雙方都沒有範圍內的招式，自動收招，進入追擊。
 * 玩家牌組頂是地雷陷阱，連擊值在範圍之外，追擊成功，它成為追擊卡，[追] 才發動。
 * 腳本停在玩家的追擊判定結果那一格，之後對手的追擊與傷害不放出來。
 */
export const PURSUIT_9: TutorialChapter = {
  characters: ['見習生', '教官'],
  first: 0,
  hands: [MY_HAND, FOE_HAND],
  decks: [[MINE_TRAP, ...repeat('方塊4', 19)], repeat('梅花7', 20)],
  steps: [
    {
      kind: 'explain',
      text: `這一課看標籤 [追]。\n這張卡不在你手上，而是在你的牌組最上方：地雷陷阱，卡面最前面的框寫著 [追]。${NEXT}`,
      highlight: [{ kind: 'deck', owner: 'me' }],
    },
    { kind: 'play', card: MY_OPENING, text: '先來走到追擊吧。由你先攻，先手步驟出招。\n點擊或拖曳至戰鬥區。' },
    { kind: 'opponent-play', card: FOE_REPLY },
    {
      kind: 'at-frame', match: { fx: 'banner', name: '追擊階段' },
      text: `雙方手中都沒有範圍內的招式，都收招了，進入追擊。${NEXT}`,
      highlight: [{ kind: 'pursuit-step' }],
    },
    {
      kind: 'at-frame', match: { fx: 'flip', player: 'me' },
      text: (ctx) => `追擊判定卡從牌組頂端翻出，先攻方先翻。\n你翻出的是${getCard(fxOf(ctx, 'flip').cardId).name}。${NEXT}`,
      highlight: [{ kind: 'deck-count', owner: 'me' }, { kind: 'judge-card' }],
    },
    {
      kind: 'at-frame', match: { fx: 'flip-result', player: 'me', ok: true },
      text: (ctx) => {
        const [lo, hi] = comboRange(ctx.view)!;
        const { cardId } = fxOf(ctx, 'flipResult');
        return `目前範圍是${lo}~${hi}，而翻出來的連擊值是${getCard(cardId).combo}，在這之外，所以追擊成功了。\n${getCard(cardId).name}成為你的追擊卡。${NEXT}`;
      },
      highlight: [{ kind: 'result-text', ok: true }, { kind: 'top-combos' }, { kind: 'judge-card', parts: ['combo'] }],
    },
    {
      kind: 'explain',
      text: (ctx) => {
        const me = mine(ctx);
        const card = getCard(fxOf(ctx, 'flipResult').cardId);
        return `追擊成功，[追] 發動了：${card.name}的總攻擊 +${me.atk - printedAtk(ctx)}。\n你的總攻擊是 ${me.atk}，其中包含它卡面的攻擊力 ${card.atk}。${NEXT}`;
      },
      highlight: [{ kind: 'pursuit-card', owner: 'me', parts: ['atk'] }, { kind: 'total', stat: 'atk' }],
    },
    {
      kind: 'explain',
      text: `[追] 是成為追擊卡的那張卡自己的效果，只有追擊成功才發動，不是從手牌打出時發動，這和 [發] 完全不同。\n點擊畫面結束這一課。`,
    },
  ],
};
