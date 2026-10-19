import { getCharacter } from '../data/cards';
import { 修行者覺醒攻擊加成 } from '../data/tutorialCharacters';
import { FOE_HAND, FOE_REPLY, MY_BURST, MY_HAND, MY_OPENING, meOf, mine } from './kit';
import { fxOf, NEXT, repeat, type TextContext, type TutorialChapter } from './script';

/** 我方角色覺醒需要的經驗張數 */
const expReq = (ctx: TextContext): number => getCharacter(mine(ctx).charId).expReq;

/**
 * 教學：覺醒 - 3（經驗區預設 7 張，差 1 張就覺醒；覺醒是邊緣偵測，開局已經達標不算進入覺醒，所以不能預設 8 張）
 */
export const AWAKENING_3: TutorialChapter = {
  characters: ['修行者', '教官'],
  first: 0,
  startPhase: '爆發',
  hands: [MY_HAND, FOE_HAND],
  decks: [repeat('方塊4', 10), repeat('梅花7', 10)],
  zones: [{ exp: ['黑桃2', '黑桃3', '黑桃4', '紅心3', '紅心4', '方塊2', '方塊3'] }, {}],
  steps: [
    {
      kind: 'explain',
      text: (ctx) => `你的經驗區目前有 ${mine(ctx).exp.length} 張卡，而${getCharacter(mine(ctx).charId).name}覺醒需要 ${expReq(ctx)} 張。\n再放進 1 張，就會進入覺醒。${NEXT}`,
      highlight: [{ kind: 'exp-zone', owner: 'me' }],
    },
    { kind: 'play', card: MY_BURST, text: '這一次的爆發，就能讓你覺醒。\n把被框起來的手牌放進經驗區。\n點擊或拖曳至經驗區。' },
    {
      kind: 'at-frame', match: { fx: 'awakened', player: 'me' },
      text: (ctx) => `經驗區有 ${mine(ctx).exp.length} 張，達到覺醒需要的 ${expReq(ctx)} 張，進入覺醒了！\n角色名旁邊會出現「覺醒」標示。${NEXT}`,
      highlight: [{ kind: 'awaken-mark', owner: 'me' }, { kind: 'exp-zone', owner: 'me' }],
    },
    {
      kind: 'explain',
      text: `修行者的覺醒效果是：我方總攻擊 +${修行者覺醒攻擊加成}。\n這是覺醒中的數值加成，不需要發動。${NEXT}`,
      highlight: [{ kind: 'awaken-mark', owner: 'me' }],
    },
    {
      kind: 'explain',
      text: (ctx) => `覺醒不是永久的：經驗區的張數一旦低於 ${expReq(ctx)} 張就會退出覺醒，之後再次達標，會視為重新覺醒。\n接著打一段簡短戰鬥，看看覺醒的加成。${NEXT}`,
      highlight: [{ kind: 'exp-zone', owner: 'me' }],
    },

    // 簡短戰鬥：對手不爆發，雙方各出一招，之後都沒有範圍內的招式，自動收招，一路到傷害計算
    { kind: 'opponent-skip' },
    { kind: 'play', card: MY_OPENING, text: '由你先攻，先手步驟出招。\n點擊或拖曳至戰鬥區。' },
    { kind: 'opponent-play', card: FOE_REPLY },
    {
      kind: 'at-frame', match: { fx: 'calc' },
      text: (ctx) => {
        const atk = fxOf(ctx, 'calc').atk[meOf(ctx)];
        return `你的總攻擊是 ${atk}，其中 ${修行者覺醒攻擊加成} 點是覺醒的加成，沒有覺醒的話只有 ${atk - 修行者覺醒攻擊加成}。${NEXT}`;
      },
      highlight: [{ kind: 'total', stat: 'atk' }, { kind: 'awaken-mark', owner: 'me' }],
    },
    { kind: 'explain', text: '覺醒中的角色效果，會直接反映在總攻擊與總防禦上。\n點擊畫面結束這一課。' },
  ],
};
