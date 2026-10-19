import type { TextContext, TutorialChapter } from './script';
import { NEXT, repeat } from './script';

/** 我方的經驗區現在有幾張（停在影格時是那一格的桌面） */
const expCount = ({ view }: TextContext): number => view.players[view.me].exp.length;

/** 教學：爆發與經驗區 - 2（玩家一開局就在爆發階段，經驗區已有 2 張） */
export const BURST_EXP_2: TutorialChapter = {
  characters: ['修行者', '教官'],
  first: 0,
  startPhase: '爆發',
  hands: [
    ['黑桃1', '紅心2', '方塊6', '梅花7', '梅花9', '方塊4'],
    ['紅心9', '黑桃8', '梅花7', '方塊6'],
  ],
  decks: [repeat('方塊4', 10), repeat('梅花7', 10)],
  zones: [{ exp: ['紅心3', '黑桃5'] }, {}],
  steps: [
    { kind: 'explain', text: `每回合抽牌之後是爆發階段：可以把 1 張手牌放進經驗區，然後抽 2 張。${NEXT}` },
    {
      kind: 'explain',
      text: (ctx) => `這裡是你的經驗區，目前有 ${expCount(ctx)} 張卡。爆發放進來的牌就會加在這裡。${NEXT}`,
      highlight: [{ kind: 'exp-zone', owner: 'me' }],
    },
    { kind: 'play', card: '梅花9', text: '那我們來嘗試爆發吧。\n把被框起來的手牌放進經驗區。\n點擊或拖曳至經驗區。' },
    {
      kind: 'at-frame', match: { fx: 'burst', player: 'me' },
      text: (ctx) => `手牌放進了經驗區，接著抽了 2 張牌。\n你的經驗區現在有 ${expCount(ctx)} 張卡。${NEXT}`,
      highlight: [{ kind: 'exp-zone', owner: 'me' }, { kind: 'hand-count', owner: 'me' }],
    },
    {
      kind: 'explain',
      text: `經驗區的卡預設是表側，雙方都看得到。表側的卡可以用來支付費用，有些還會提供經驗效果。${NEXT}`,
      highlight: [{ kind: 'exp-zone', owner: 'me' }],
    },
    {
      kind: 'explain',
      text: '經驗區的卡除了來自爆發，還有其他來源：招式卡打完後的歸還，以及增益持續時間結束。\n點擊畫面結束這一課。',
    },
  ],
};
