import { meOf, mine } from './kit';
import { calcText, fxOf, NEXT, repeat, type TutorialChapter } from './script';

/** 玩家先攻打出的招式：熔岩之擊（出招時發動，怒 3，對手直擊 1） */
const LAVA = '熔岩之擊';
/** 對手回應的招式：連擊值 6，和熔岩之擊的 5 之間沒有其他招式 */
const FOE_REPLY = '方塊6';

/**
 * 教學：怒氣區與受傷 - 5（怒氣區預設 3 張）
 * 順序固定是先付怒 3、後受傷：引擎的傷害在戰鬥結尾才結算。
 * 對手總攻擊（方塊6 加追擊成功的梅花7）大於玩家總防禦（熔岩之擊），玩家才會真的受傷。
 * 雙方打完這一招之後，手中都沒有範圍內的招式，會自動收招。
 */
export const RAGE_DAMAGE_5: TutorialChapter = {
  characters: ['修行者', '教官'],
  first: 0,
  hands: [[LAVA, '黑桃1', '紅心2', '梅花9', '黑桃8', '方塊4'], [FOE_REPLY, '紅心9', '黑桃8', '梅花1']],
  decks: [repeat('方塊4', 10), repeat('梅花7', 10)],
  zones: [{ rage: ['黑桃2', '黑桃3', '黑桃4'] }, {}],
  steps: [
    {
      kind: 'explain',
      text: (ctx) =>
        `你的怒氣區已經有 ${mine(ctx).rage.length} 張卡，這是你之前受過的傷：受到傷害時，牌組上方的牌會放進怒氣區。\n怒氣區的張數是公開的，但牌面誰都看不到，所以只會顯示牌背。${NEXT}`,
      highlight: [{ kind: 'rage-zone', owner: 'me' }],
    },
    {
      kind: 'explain',
      text: `怒氣區的牌也可以拿來支付費用，叫做「怒 X」：捨棄怒氣區上方的 X 張卡。\n你手上的熔岩之擊，就要支付怒 3。${NEXT}`,
      highlight: [{ kind: 'hand-card', cardId: LAVA }],
    },
    { kind: 'play', card: LAVA, text: '由你先攻，先手步驟打出熔岩之擊。\n點擊或拖曳至戰鬥區。' },
    { kind: 'choose', key: 'yes', text: '熔岩之擊出招時可以發動：支付怒 3，對手直擊 1。\n請按「發動」。' },
    {
      kind: 'at-frame', match: { fx: 'cost', player: 'me' },
      text: (ctx) =>
        `支付費用：怒氣區上方的 ${fxOf(ctx, 'cost').rage} 張卡被捨棄到棄牌區。\n你的怒氣區現在有 ${mine(ctx).rage.length} 張卡。${NEXT}`,
      highlight: [{ kind: 'rage-zone', owner: 'me' }],
    },
    {
      kind: 'at-frame', match: { fx: 'info' },
      text: `直擊 1：對手牌組上方的 1 張卡直接放進棄牌區，不能用防禦抵擋。${NEXT}`,
      highlight: [{ kind: 'deck-count', owner: 'opp' }],
    },

    // 對手回應，之後雙方都自動收招，一路到傷害計算
    { kind: 'opponent-play', card: FOE_REPLY },
    { kind: 'at-frame', match: { fx: 'calc' }, text: calcText, highlight: [{ kind: 'total', stat: 'atk' }, { kind: 'total', stat: 'def' }] },
    {
      kind: 'at-frame', match: { fx: 'rage-in', player: 'me' },
      text: (ctx) => {
        const hurt = fxOf(ctx, 'damage').dmg[meOf(ctx)];
        return `你受到 ${hurt} 點傷害：牌組上方的 ${hurt} 張卡放進了怒氣區。\n你的牌組剩 ${mine(ctx).deckCount} 張，怒氣區有 ${mine(ctx).rage.length} 張。${NEXT}`;
      },
      highlight: [{ kind: 'deck-count', owner: 'me' }, { kind: 'rage-zone', owner: 'me' }],
    },
    {
      kind: 'explain',
      text: '牌組就是生命，牌組變少代表生命減少。\n所以怒氣區既是你受傷的紀錄，也是可以花費的資源。\n點擊畫面結束這一課。',
    },
  ],
};
