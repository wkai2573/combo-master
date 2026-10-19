import { getCard } from '../data/cards';
import type { FrameFx, PlayerId } from '../engine/types';
import type { Frame, GameView } from '../engine/view';

/** 我方（學習的玩家）或對手 */
export type Side = 'me' | 'opp';

/**
 * 高亮目標：用抽象名稱描述要指的東西，不綁定畫面元素，由電腦版與手機版各自對應到畫面上的元素。
 */
export type HighlightTarget =
  /** 雙方戰鬥區 */
  | { kind: 'combat-zones' }
  /** 雙方招式卡疊最上方的連擊值 */
  | { kind: 'top-combos' }
  /** 我方手牌中的某張牌（同名的牌都算） */
  | { kind: 'hand-card'; cardId: string }
  /** 某一方戰鬥區中的某幾張牌（同名的牌都算） */
  | { kind: 'combat-cards'; owner: Side; cardId: string }
  /** 某一方的「收招」文字 */
  | { kind: 'pass-text'; owner: Side }
  /** 回合步驟中的追擊步驟（手機版面沒有步驟列，是戰鬥區中央的提示） */
  | { kind: 'pursuit-step' }
  /** 某一方牌組的張數 */
  | { kind: 'deck-count'; owner: Side }
  /** 某一方的牌組 */
  | { kind: 'deck'; owner: Side }
  /** 某一方手牌的張數 */
  | { kind: 'hand-count'; owner: Side }
  /** 追擊判定翻出的那張牌；有 parts 就只指它的連擊值、攻擊力、防禦力 */
  | { kind: 'judge-card'; parts?: StatPart[] }
  /** 「追擊成功」或「追擊失敗」文字 */
  | { kind: 'result-text'; ok: boolean }
  /** 某一方追擊卡疊中的追擊卡，只指它的攻擊力、防禦力 */
  | { kind: 'pursuit-card'; owner: Side; parts: StatPart[] }
  /** 雙方的總攻擊或總防禦 */
  | { kind: 'total'; stat: 'atk' | 'def' };

export type StatPart = 'combo' | 'atk' | 'def';

/** 說明文字依哪個桌面帶入數值：view 是顯示中的桌面；停在影格時 frame 是那一格 */
export interface TextContext {
  view: GameView;
  frame?: Frame;
}

/** 說明文字：可以依桌面帶入實際的數值，數字不寫死在腳本裡。文字裡的換行就是顯示時的換行 */
export type TutorialText = string | ((ctx: TextContext) => string);

/** 說明文字依目前的桌面帶入數值 */
export const resolveText = (text: TutorialText, ctx: TextContext): string => (typeof text === 'string' ? text : text(ctx));

/** 要停在哪一格影格：從還沒送出的影格裡，找第一個符合的 */
export type FrameMatch =
  | { fx: 'pass'; player: Side }
  | { fx: 'banner'; name: string }
  | { fx: 'flip'; player: Side }
  | { fx: 'flip-result'; player: Side; ok: boolean }
  | { fx: 'calc' }
  | { fx: 'game-end' };

const sideOf = (player: PlayerId, me: PlayerId): Side => (player === me ? 'me' : 'opp');

export function matchesFrame(m: FrameMatch, fx: FrameFx, me: PlayerId): boolean {
  switch (m.fx) {
    case 'pass': return fx.type === 'pass' && sideOf(fx.player, me) === m.player;
    case 'banner': return fx.type === 'banner' && fx.kind === 'phase' && fx.name === m.name;
    case 'flip': return fx.type === 'flip' && sideOf(fx.player, me) === m.player;
    case 'flip-result': return fx.type === 'flipResult' && sideOf(fx.player, me) === m.player && fx.ok === m.ok;
    case 'calc': return fx.type === 'calc';
    case 'game-end': return fx.type === 'gameEnd';
  }
}

/**
 * 教學的一步：
 * - explain：顯示文字與高亮目標，等玩家點畫面。接在停在影格後面時，畫面維持停住的那一格
 * - opponent-play：對手照腳本回應目前的提示，打出指定的牌
 * - play：顯示文字，要求玩家打出指定的牌（手牌中的這張牌會高亮），其他選擇都被拒絕
 * - at-frame：把影格送到符合條件的那一格為止，剩下的先扣著，顯示說明等玩家點畫面；點完才繼續送
 */
export type TutorialStep =
  | { kind: 'explain'; text: TutorialText; highlight?: HighlightTarget[] }
  | { kind: 'opponent-play'; card: string }
  | { kind: 'play'; card: string; text: TutorialText }
  | { kind: 'at-frame'; match: FrameMatch; text: TutorialText; highlight?: HighlightTarget[] };

/** 一章教學：牌面配置，加上一串依序執行的步驟 */
export interface TutorialChapter {
  /** 玩家 A 是學習的玩家，玩家 B 是對手 */
  characters: [string, string];
  first: PlayerId;
  /** 雙方的起始手牌；牌組不洗牌，同一份清單由上往下就是牌組頂到底 */
  hands: [string[], string[]];
  decks: [string[], string[]];
  steps: TutorialStep[];
}

/** 課程結束畫面：標題、一句話總結，與「下一課」按鈕的去向 */
export interface TutorialEnding {
  heading: string;
  summary: string;
  /** 還有下一課就去那一課；最後一課改成開始單機練習 */
  next: { kind: 'lesson'; no: number; label: string } | { kind: 'practice'; label: string };
}

/** 場次對外提供的教學進度 */
export interface TutorialProgress {
  /** 目前步驟的說明文字（已帶入數值）；腳本走完時是空字串 */
  text: string;
  highlight: HighlightTarget[];
  /** 在等什麼：點擊畫面、玩家打出指定的牌，或沒有（腳本走完） */
  awaiting: 'click' | { play: string } | null;
  /** 腳本走完，到了教學結束畫面 */
  finished: boolean;
  /** 結束畫面的內容；腳本還沒走完時是 null */
  ending: TutorialEnding | null;
}

/** 範圍兩端：雙方招式卡疊最上方的連擊值，小的在前；有一方沒有招式就沒有範圍 */
export function comboRange(view: GameView): [number, number] | null {
  const tops = view.players.map((p) => p.moves.at(-1)?.id);
  if (tops.some((id) => !id)) return null;
  const [a, b] = tops.map((id) => getCard(id!).combo);
  return [Math.min(a, b), Math.max(a, b)];
}

const rangeText = ({ view }: TextContext): string => {
  const [lo, hi] = comboRange(view)!;
  return `目前雙方最後一張招式的連擊值為${lo}跟${hi}，那“範圍內”就是${lo}~${hi}之間的所有數值（包含原本數值）。\n點擊畫面進入下一步。`;
};

/** 停在影格的說明才有那一格；拿來用在別的步驟是腳本寫錯了 */
function fxOf<T extends FrameFx['type']>({ frame }: TextContext, type: T): Extract<FrameFx, { type: T }> {
  if (frame?.fx.type !== type) throw new Error(`教學腳本：這段說明要用在停在「${type}」影格的步驟`);
  return frame.fx as Extract<FrameFx, { type: T }>;
}

/** 停在追擊結果那一格：翻出的牌的連擊值 */
const judgedCombo = (ctx: TextContext): number => getCard(fxOf(ctx, 'flipResult').cardId).combo;

const failText = (ctx: TextContext): string => {
  const [lo, hi] = comboRange(ctx.view)!;
  return `追擊的成功與否是跟出招邏輯相反，不在“範圍內”的才會成功。\n目前範圍是${lo}~${hi}，而翻出來的連擊值剛好是${judgedCombo(ctx)}，所以失敗了。\n點擊畫面進入下一步。`;
};

const successText = (ctx: TextContext): string => {
  const [lo, hi] = comboRange(ctx.view)!;
  return `目前範圍是${lo}~${hi}，而翻出來的連擊值是${judgedCombo(ctx)}，在這之外，所以成功了。\n點擊畫面進入下一步。`;
};

/** 傷害計算：我方打對手、對手打我方，各一行，帶入這一局實際的數字 */
const calcText = (ctx: TextContext): string => {
  const { atk, def, dmg } = fxOf(ctx, 'calc');
  const me = ctx.view.me;
  const opp = me === 0 ? 1 : 0;
  const line = (attacker: string, defender: string, victim: string, a: number, d: number, hurt: number) =>
    `${attacker}總攻擊 ${a} − ${defender}總防禦 ${d} = ${victim}受到 ${hurt} 點傷害${a < d ? '（不會小於 0）' : ''}`;
  return `${line('你的', '對手', '對手', atk[me], def[opp], dmg[opp])}
${line('對手的', '你的', '你', atk[opp], def[me], dmg[me])}
點擊畫面進入下一步。`;
};

const repeat = (id: string, n: number) => Array.from({ length: n }, () => id);

const YOUR_TURN: TutorialStep = { kind: 'explain', text: '現在輪到你出招了。\n點擊畫面進入下一步。' };
const TRY_PLAY = '那我們來嘗試打出招式吧。\n點擊或拖曳至戰鬥區。';
const NEXT = '\n點擊畫面進入下一步。';

/** 教學：核心戰鬥階段 - 1 */
export const CORE_COMBAT_1: TutorialChapter = {
  characters: ['見習生', '教官'],
  first: 1,
  hands: [
    ['黑桃1', '紅心2', '方塊6', '梅花7', '梅花7', '梅花7', '梅花9'],
    ['紅心9', '黑桃8', '梅花7', '方塊6'],
  ],
  decks: [repeat('方塊4', 10), repeat('梅花7', 10)],
  steps: [
    { kind: 'explain', text: '雙方輪流在可出招的“範圍內”打出招式。\n點擊畫面進入下一步。' },
    {
      kind: 'explain',
      text: '由對手先攻，在雙方只要有一方戰鬥區沒招式，出牌都是沒限制的。\n點擊畫面進入下一步。',
      highlight: [{ kind: 'combat-zones' }],
    },
    { kind: 'opponent-play', card: '紅心9' },
    YOUR_TURN,
    {
      kind: 'explain',
      text: '由於你的戰鬥區沒招式，所以出牌都是沒限制的。\n點擊畫面進入下一步。',
      highlight: [{ kind: 'combat-zones' }],
    },
    { kind: 'play', card: '黑桃1', text: TRY_PLAY },
    {
      kind: 'explain',
      text: '由於雙方戰鬥區都有招式了，所以接下來的出招會有所限制。\n只能打出“範圍內”的招式。\n點擊畫面進入下一步。',
    },
    { kind: 'explain', text: rangeText, highlight: [{ kind: 'top-combos' }] },
    { kind: 'opponent-play', card: '黑桃8' },
    YOUR_TURN,
    { kind: 'explain', text: rangeText, highlight: [{ kind: 'top-combos' }] },
    {
      kind: 'explain',
      text: '由於9不在“範圍內”了，故無法作為出招打出。\n點擊畫面進入下一步。',
      highlight: [{ kind: 'hand-card', cardId: '梅花9' }],
    },
    { kind: 'play', card: '紅心2', text: TRY_PLAY },
    { kind: 'opponent-play', card: '梅花7' },
    { kind: 'play', card: '梅花7', text: '那我們來嘗試限制對手的出招吧。\n點擊或拖曳至戰鬥區。' },

    // 對手沒有範圍內的牌，只能收招
    { kind: 'at-frame', match: { fx: 'pass', player: 'opp' }, text: `看來對手沒牌能出招了，所以只能選擇收招。${NEXT}` },
    { kind: 'play', card: '梅花7', text: '輪到你出招了。\n點擊或拖曳至戰鬥區。' },

    // 重複連擊值只能一次：我也沒牌可出，自動收招
    {
      kind: 'at-frame', match: { fx: 'pass', player: 'me' }, text: `怎麼自動收招了呢？${NEXT}`,
      highlight: [{ kind: 'pass-text', owner: 'me' }],
    },
    {
      kind: 'explain',
      text: (ctx) => {
        const [lo, hi] = comboRange(ctx.view)!;
        return `那是因為每回合自己的招式卡疊只能重複一次連擊值。你已經出了兩張 7，手中的 7 不能再出；6 和 9 又不在範圍 ${lo}~${hi} 內，只好收招。${NEXT}`;
      },
      highlight: [{ kind: 'combat-cards', owner: 'me', cardId: '梅花7' }],
    },

    // 追擊
    {
      kind: 'at-frame', match: { fx: 'banner', name: '追擊階段' }, text: `當雙方都收招後，會有一次追擊。${NEXT}`,
      highlight: [{ kind: 'pursuit-step' }],
    },

    // 追擊判定失敗：對手先翻
    {
      kind: 'at-frame', match: { fx: 'flip', player: 'opp' },
      text: `追擊判定卡會由牌組頂端翻出1張，並由先攻方先翻出追擊判定卡。${NEXT}`,
      highlight: [{ kind: 'deck-count', owner: 'opp' }, { kind: 'judge-card' }],
    },
    {
      kind: 'at-frame', match: { fx: 'flip-result', player: 'opp', ok: false }, text: failText,
      highlight: [{ kind: 'result-text', ok: false }, { kind: 'top-combos' }, { kind: 'judge-card', parts: ['combo'] }],
    },
    { kind: 'explain', text: `追擊判定失敗的卡會加入手中。${NEXT}`, highlight: [{ kind: 'hand-count', owner: 'opp' }] },

    // 追擊判定成功：換我翻
    { kind: 'at-frame', match: { fx: 'flip', player: 'me' }, text: `現在換到後攻方判定。${NEXT}` },
    {
      kind: 'at-frame', match: { fx: 'flip-result', player: 'me', ok: true }, text: successText,
      highlight: [{ kind: 'result-text', ok: true }, { kind: 'top-combos' }, { kind: 'judge-card', parts: ['combo'] }],
    },
    {
      kind: 'explain', text: `追擊判定成功的卡會放入戰鬥區並將攻擊力計算到總攻擊力中，防禦力不會計算。${NEXT}`,
      highlight: [{ kind: 'pursuit-card', owner: 'me', parts: ['atk', 'def'] }, { kind: 'total', stat: 'atk' }, { kind: 'total', stat: 'def' }],
    },

    // 傷害計算
    { kind: 'at-frame', match: { fx: 'calc' }, text: calcText },

    // 勝負
    {
      kind: 'at-frame', match: { fx: 'game-end' },
      text: '牌組就是生命，當牌組歸0時就輸了！\n恭喜你勝利了！\n點擊畫面結束此次教學。',
      highlight: [{ kind: 'deck', owner: 'opp' }],
    },
  ],
};
