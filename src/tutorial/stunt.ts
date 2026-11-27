import { getCard } from '../data/cards';
import { NEXT, repeat, type TutorialChapter } from './script';

const opening = '黑桃5';
const reply = '黑桃6';
const cost = '黑桃9';
const stunt = '梅花9';
const combo = getCard(stunt).combo;

export const STUNT: TutorialChapter = {
  characters: ['修行者', '教官'],
  first: 0,
  hands: [[opening, cost, stunt], [reply, '梅花6']],
  decks: [repeat('方塊4', 10), repeat('梅花7', 10)],
  steps: [
    { kind: 'explain', text: `這一課要練習特技出招。反擊步驟中，你的招式卡疊已有招式，而且還有至少 1 點破格容量可供占用，就能用兩張原始連擊值相同的手牌出特技。${NEXT}` },
    { kind: 'play', card: opening, text: '由你先攻。點擊黑桃5，或拖曳到戰鬥區。' },
    { kind: 'opponent-play', card: reply },
    {
      kind: 'choose', key: 'stunt',
      text: `對手打出黑桃6。你的兩張手牌都是連擊值 ${combo}，超出雙方頂牌的範圍。現在可以按「特技出招」。`,
      highlight: [{ kind: 'top-combos' }],
    },
    { kind: 'play', card: stunt, text: '先選要打出的梅花9。點擊它，或拖曳到特技區。' },
    { kind: 'play', card: cost, text: `再點擊原始連擊值同為 ${combo} 的黑桃9。這張手牌會在確認後捨棄，作為出招代價。` },
    { kind: 'choose', key: 'confirm-stunt', text: '按「確認特技出招」，捨棄黑桃9並打出梅花9。' },
    {
      kind: 'at-frame', match: { fx: 'stunt', player: 'me' },
      text: `梅花9進了特技區，攻擊力與防禦力會計入總值。雙方招式卡疊的頂牌仍是黑桃5和黑桃6。${NEXT}`,
      highlight: [{ kind: 'combat-cards', owner: 'me', cardId: stunt }, { kind: 'top-combos' }],
    },
    {
      kind: 'explain',
      text: '這張特技占用 1 點破格容量。每回合的基礎上限是 1 點，招式區每種連擊值從第二張起，每張也占用 1 點。\n點擊畫面結束這一課。',
    },
  ],
};
