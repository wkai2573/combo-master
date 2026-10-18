import { getCard } from '../data/cards';
import type { PlayerId } from '../engine/types';
import type { GameView } from '../engine/view';

/**
 * 高亮目標：用抽象名稱描述要指的東西，不綁定畫面元素，由電腦版與手機版各自對應到畫面上的元素。
 */
export type HighlightTarget =
  /** 雙方戰鬥區 */
  | { kind: 'combat-zones' }
  /** 雙方招式卡疊最上方的連擊值 */
  | { kind: 'top-combos' }
  /** 我方手牌中的某張牌（同名的牌都算） */
  | { kind: 'hand-card'; cardId: string };

/** 說明文字：可以依目前的桌面帶入實際的數值，數字不寫死在腳本裡。文字裡的換行就是顯示時的換行 */
export type TutorialText = string | ((view: GameView) => string);

/** 說明文字依目前的桌面帶入數值 */
export const resolveText = (text: TutorialText, view: GameView): string => (typeof text === 'string' ? text : text(view));

/**
 * 教學的一步：
 * - explain：顯示文字與高亮目標，等玩家點畫面
 * - opponent-play：對手照腳本回應目前的提示，打出指定的牌
 * - play：顯示文字，要求玩家打出指定的牌（手牌中的這張牌會高亮），其他選擇都被拒絕
 */
export type TutorialStep =
  | { kind: 'explain'; text: TutorialText; highlight?: HighlightTarget[] }
  | { kind: 'opponent-play'; card: string }
  | { kind: 'play'; card: string; text: TutorialText };

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

/** 場次對外提供的教學進度 */
export interface TutorialProgress {
  /** 目前步驟的說明文字（已帶入數值）；腳本走完時是空字串 */
  text: string;
  highlight: HighlightTarget[];
  /** 在等什麼：點擊畫面、玩家打出指定的牌，或沒有（腳本走完） */
  awaiting: 'click' | { play: string } | null;
}

/** 範圍兩端：雙方招式卡疊最上方的連擊值，小的在前；有一方沒有招式就沒有範圍 */
export function comboRange(view: GameView): [number, number] | null {
  const tops = view.players.map((p) => p.moves.at(-1)?.id);
  if (tops.some((id) => !id)) return null;
  const [a, b] = tops.map((id) => getCard(id!).combo);
  return [Math.min(a, b), Math.max(a, b)];
}

const rangeText = (view: GameView): string => {
  const [lo, hi] = comboRange(view)!;
  return `目前雙方最後一張招式的連擊值為${lo}跟${hi}，那“範圍內”就是${lo}~${hi}之間的所有數值（包含原本數值）。\n點擊畫面進入下一步。`;
};

const repeat = (id: string, n: number) => Array.from({ length: n }, () => id);

const YOUR_TURN: TutorialStep = { kind: 'explain', text: '現在輪到你出招了。\n點擊畫面進入下一步。' };
const TRY_PLAY = '那我們來嘗試打出招式吧。\n點擊或拖曳至戰鬥區。';

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
  ],
};
