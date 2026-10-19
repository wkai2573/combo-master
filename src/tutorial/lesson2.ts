import { FOE_HAND, FOE_REPLY, MY_BURST, MY_HAND, MY_OPENING, meOf, mine } from './kit';
import { fxOf, NEXT, repeat, type TutorialChapter } from './script';

/** 教學：爆發與經驗區 - 2（玩家一開局就在爆發階段，經驗區已有 2 張；爆發之後打一段簡短戰鬥，看歸還） */
export const BURST_EXP_2: TutorialChapter = {
  characters: ['修行者', '教官'],
  first: 0,
  startPhase: '爆發',
  hands: [MY_HAND, FOE_HAND],
  decks: [repeat('方塊4', 10), repeat('梅花7', 10)],
  zones: [{ exp: ['紅心3', '黑桃5'] }, {}],
  steps: [
    { kind: 'explain', text: `每回合抽牌之後是爆發階段：可以把 1 張手牌放進經驗區，然後抽 2 張。${NEXT}` },
    {
      kind: 'explain',
      text: (ctx) => `這裡是你的經驗區，目前有 ${mine(ctx).exp.length} 張卡。爆發放進來的牌就會加在這裡。${NEXT}`,
      highlight: [{ kind: 'exp-zone', owner: 'me' }],
    },
    { kind: 'play', card: MY_BURST, text: '那我們來嘗試爆發吧。\n把被框起來的手牌放進經驗區。\n點擊或拖曳至經驗區。' },
    {
      kind: 'at-frame', match: { fx: 'burst', player: 'me' },
      text: (ctx) => `手牌放進了經驗區，接著抽了 2 張牌。\n你的經驗區現在有 ${mine(ctx).exp.length} 張卡。${NEXT}`,
      highlight: [{ kind: 'exp-zone', owner: 'me' }, { kind: 'hand-count', owner: 'me' }],
    },
    {
      kind: 'explain',
      text: `經驗區的卡預設是表側，雙方都看得到。表側的卡可以用來支付費用，有些還會提供經驗效果。${NEXT}`,
      highlight: [{ kind: 'exp-zone', owner: 'me' }],
    },
    { kind: 'explain', text: `經驗區主要的增長來源是爆發和歸還，招式卡打完之後會回到經驗區。\n我們接著打一段簡短戰鬥，來看看歸還。${NEXT}` },

    // 簡短戰鬥：對手不爆發，雙方各出一招，之後都沒有範圍內的招式，自動收招
    { kind: 'opponent-skip' },
    { kind: 'play', card: MY_OPENING, text: '由你先攻，先手步驟出招。\n點擊或拖曳至戰鬥區。' },
    { kind: 'opponent-play', card: FOE_REPLY },
    {
      kind: 'at-frame', match: { fx: 'pass', player: 'opp' },
      text: `雙方手中都沒有範圍內的招式可以再出，都收招了。\n接著會追擊、計算傷害，最後進入歸還。${NEXT}`,
    },

    // 歸還：招式卡由最底到最頂，最後是追擊卡
    {
      kind: 'at-frame', match: { fx: 'return' },
      text: (ctx) => {
        const returned = fxOf(ctx, 'return').count[meOf(ctx)];
        return `歸還：戰鬥區的卡依序放進經驗區後方。\n先是招式卡（由最底到最頂），最後才是追擊卡。\n你歸還了 ${returned} 張，經驗區現在有 ${mine(ctx).exp.length} 張卡。${NEXT}`;
      },
      highlight: [{ kind: 'exp-zone', owner: 'me' }],
    },
    {
      kind: 'explain',
      text: '所以經驗區主要是靠爆發和歸還增長；增益卡的持續時間結束時，也會放進經驗區。\n點擊畫面結束這一課。',
    },
  ],
};
