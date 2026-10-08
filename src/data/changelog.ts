/** 更新日誌：只寫玩家看得到的變化；純內部重構的版本不列。新到舊排列 */
export type ChangeType = 'add' | 'change' | 'fix';

export interface ChangeItem {
  type: ChangeType;
  text: string;
}

export interface ChangelogEntry {
  version: string;
  /** YYYY-MM-DD */
  date: string;
  items: ChangeItem[];
}

export const CHANGE_TYPE_LABEL: Record<ChangeType, string> = {
  add: '新增',
  change: '調整',
  fix: '修正',
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.23.0',
    date: '2026-10-08',
    items: [{ type: 'add', text: '主選單新增「更新日誌」，點首頁標題旁的版本號也能開啟' }],
  },
  {
    version: '0.22.5',
    date: '2026-10-08',
    items: [
      { type: 'fix', text: '凡骨的意志：蓋到自己時失效、沒有加成；發動後被蓋成裏側或離開經驗區，加成立刻消失' },
      { type: 'change', text: '卡面顏色只依卡種（招式、裝備、增益、Ex 卡）區分，不再依職業' },
      { type: 'change', text: '卡文的時機標籤改綠底、條件改藍底，並修正費用框與標籤框的垂直對齊' },
      { type: 'change', text: '觸發窗口裡文字相同的效果會標示卡所在的位置，滑過選項時對應的卡會亮起' },
    ],
  },
  {
    version: '0.22.1',
    date: '2026-10-08',
    items: [{ type: 'fix', text: '戰鬥區只能出現一次重複的連擊值：重複過之後，戰鬥區已有的連擊值都不能再出' }],
  },
  {
    version: '0.22.0',
    date: '2026-10-08',
    items: [
      { type: 'change', text: '電弧的特徵改為電；冰與雷之曲的效果改為冰與電' },
      { type: 'change', text: '經驗區的「裏側」字樣會被疊上來的卡蓋住' },
    ],
  },
  {
    version: '0.21.0',
    date: '2026-10-08',
    items: [{ type: 'add', text: '作弊模式支援連線：訪客的操作由房主執行，對方畫面會提示，紀錄寫明操作者' }],
  },
  {
    version: '0.20.0',
    date: '2026-10-08',
    items: [{ type: 'add', text: '作弊模式（單機）：可加入手牌、移除手牌、調整牌堆順序' }],
  },
];
