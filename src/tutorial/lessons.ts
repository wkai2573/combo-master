import { BURST_EXP_2 } from './lesson2';
import { AWAKENING_3 } from './lesson3';
import { COVER_COST_4 } from './lesson4';
import { RAGE_DAMAGE_5 } from './lesson5';
import { ON_PLAY_6 } from './lesson6';
import { OPENING_7 } from './lesson7';
import { TOP_8 } from './lesson8';
import { CORE_COMBAT_1, type TutorialChapter } from './script';

/** 課程清單的分組，依這個順序顯示標題。分組只影響清單的顯示，不影響編號、完成紀錄與推薦 */
export const LESSON_GROUPS = ['基礎', '卡片標籤'] as const;
export type LessonGroup = (typeof LESSON_GROUPS)[number];

/** 一堂教學課：課程清單上的一列，加上這一課用的章節 */
export interface TutorialLesson {
  /** 課程編號，從 1 開始；完成紀錄與流量統計都用它 */
  no: number;
  group: LessonGroup;
  title: string;
  /** 清單上的一句話說明 */
  blurb: string;
  /** 預估要幾分鐘 */
  minutes: number;
  /** 結束畫面的一句話：這一課學會了什麼 */
  summary: string;
  chapter: TutorialChapter;
}

/** 課程清單，依編號排列。新增課程只要在這裡加一筆資料，不必改引擎與流程 */
export const LESSONS: TutorialLesson[] = [
  {
    no: 1,
    group: '基礎',
    title: '核心戰鬥',
    blurb: '出招、收招、追擊與傷害計算',
    minutes: 5,
    summary: '你已經學會出招、收招、追擊與傷害計算。',
    chapter: CORE_COMBAT_1,
  },
  {
    no: 2,
    group: '基礎',
    title: '爆發與經驗區',
    blurb: '爆發與歸還，看經驗區怎麼增長',
    minutes: 3,
    summary: '你已經學會爆發，也看到招式卡與追擊卡會在歸還時回到經驗區。',
    chapter: BURST_EXP_2,
  },
  {
    no: 3,
    group: '基礎',
    title: '覺醒',
    blurb: '經驗達標進入覺醒，看總攻擊的加成',
    minutes: 3,
    summary: '你已經學會覺醒：經驗區達到門檻就覺醒，覺醒中的角色效果會直接反映在數字上。',
    chapter: AWAKENING_3,
  },
  {
    no: 4,
    group: '基礎',
    title: '蓋 X',
    blurb: '用經驗區支付費用，看表側變裏側',
    minutes: 3,
    summary: '你已經學會蓋 X：從最前面的表側經驗開始蓋，裏側的經驗效果無效，但仍算在覺醒張數內。',
    chapter: COVER_COST_4,
  },
  {
    no: 5,
    group: '基礎',
    title: '怒氣區與受傷',
    blurb: '怒氣區怎麼累積、怎麼花掉',
    minutes: 3,
    summary: '你已經學會怒氣區：受傷會讓牌組的牌放進怒氣區，怒氣區的牌也能用來支付怒 X。',
    chapter: RAGE_DAMAGE_5,
  },
  {
    no: 6,
    group: '卡片標籤',
    title: '[發] 打出時發動',
    blurb: '招式打出就發動，不論在哪個步驟',
    minutes: 3,
    summary: '你已經學會 [發]：卡面最前面是 [發] 的招式，一打出效果就發動，先手步驟或反擊步驟打出都一樣。',
    chapter: ON_PLAY_6,
  },
  {
    no: 7,
    group: '卡片標籤',
    title: '[先] 先手步驟',
    blurb: '只有先攻方在先手步驟打出才發動',
    minutes: 3,
    summary: '你已經學會 [先]：只有先攻方在先手步驟打出的招式才發動，同一張卡在反擊步驟打出就不發動。',
    chapter: OPENING_7,
  },
  {
    no: 8,
    group: '卡片標籤',
    title: '[頂] 疊在最上方',
    blurb: '在招式卡疊最上方才有效，被蓋住就失效',
    minutes: 3,
    summary: '你已經學會 [頂]：只有在自己招式卡疊最上方時才有效，被後來打出的招式蓋住，加成就消失。',
    chapter: TOP_8,
  },
];

/** 第 1 課：「推薦」標籤只看它的完成紀錄 */
export const FIRST_LESSON = 1;

export const getLesson = (no: number): TutorialLesson => {
  const lesson = LESSONS.find((l) => l.no === no);
  if (!lesson) throw new Error(`沒有第 ${no} 課`);
  return lesson;
};

/** 接在這一課後面的課；最後一課沒有 */
export const lessonAfter = (no: number): TutorialLesson | undefined => LESSONS.find((l) => l.no > no);

/** 課程清單的一段：標題加上屬於這一段的課，維持課程資料的順序 */
export interface LessonSection {
  group: LessonGroup;
  lessons: TutorialLesson[];
}

/** 依分組切段，只留有課程的分組，段落順序照 LESSON_GROUPS */
export const groupLessons = (lessons: readonly TutorialLesson[] = LESSONS): LessonSection[] =>
  LESSON_GROUPS.map((group) => ({ group, lessons: lessons.filter((l) => l.group === group) })).filter((s) => s.lessons.length > 0);
