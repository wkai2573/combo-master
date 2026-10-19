import { BURST_EXP_2 } from './lesson2';
import { AWAKENING_3 } from './lesson3';
import { CORE_COMBAT_1, type TutorialChapter } from './script';

/** 一堂教學課：課程清單上的一列，加上這一課用的章節 */
export interface TutorialLesson {
  /** 課程編號，從 1 開始；完成紀錄與流量統計都用它 */
  no: number;
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
    title: '核心戰鬥',
    blurb: '出招、收招、追擊與傷害計算',
    minutes: 5,
    summary: '你已經學會出招、收招、追擊與傷害計算。',
    chapter: CORE_COMBAT_1,
  },
  {
    no: 2,
    title: '爆發與經驗區',
    blurb: '爆發與歸還，看經驗區怎麼增長',
    minutes: 3,
    summary: '你已經學會爆發，也看到招式卡與追擊卡會在歸還時回到經驗區。',
    chapter: BURST_EXP_2,
  },
  {
    no: 3,
    title: '覺醒',
    blurb: '經驗達標進入覺醒，看總攻擊的加成',
    minutes: 3,
    summary: '你已經學會覺醒：經驗區達到門檻就覺醒，覺醒中的角色效果會直接反映在數字上。',
    chapter: AWAKENING_3,
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
