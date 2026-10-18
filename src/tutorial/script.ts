import type { PlayerId } from '../engine/types';

/**
 * 高亮目標：用抽象名稱描述要指的東西，不綁定畫面元素，由電腦版與手機版各自對應到畫面上的元素。
 */
export type HighlightTarget =
  /** 雙方戰鬥區 */
  | { kind: 'combat-zones' };

/**
 * 教學的一步。目前只有「說明」：顯示文字與高亮目標，等玩家點畫面。
 * 文字裡的換行就是顯示時的換行。
 */
export type TutorialStep = { kind: 'explain'; text: string; highlight?: HighlightTarget[] };

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

const repeat = (id: string, n: number) => Array.from({ length: n }, () => id);

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
  ],
};

/** 場次對外提供的教學進度 */
export interface TutorialProgress {
  /** 目前步驟的說明文字 */
  text: string;
  highlight: HighlightTarget[];
  /** 在等什麼：目前只有點擊畫面 */
  awaiting: 'click';
}
