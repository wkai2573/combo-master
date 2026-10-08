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
    version: '0.25.2',
    date: '2026-10-08',
    items: [
      { type: 'fix', text: '作弊面板牌區與商人排序：滑鼠移到可拖曳的卡片上，游標改成抓取的手（原本是放大鏡），拖動時變成抓住的手' },
    ],
  },
  {
    version: '0.25.1',
    date: '2026-10-08',
    items: [
      { type: 'change', text: '作弊面板牌區的卡片按鈕移到下方：左下藍色是翻面，右下紅色是刪除，並改成不透明，更容易看見' },
    ],
  },
  {
    version: '0.25.0',
    date: '2026-10-08',
    items: [
      { type: 'change', text: '作弊面板的牌堆順序改成只靠拖曳：被拖的卡浮起跟著游標，其他卡滑動補位，放開時滑進新位置；手機上長按卡片再拖，不影響上下捲動' },
      { type: 'add', text: '作弊面板的牌區：每張卡右上角有 [x] 可以刪除，經驗區的卡左上角可以翻成表側或裏側，牌區最前面有虛線框，點開可以挑一張卡加進去' },
      { type: 'change', text: '商人調整表側經驗順序，改成把卡排成一列直接拖曳，排好後按確定，不用再一張一張點' },
    ],
  },
  {
    version: '0.24.1',
    date: '2026-10-08',
    items: [
      { type: 'change', text: '戰鬥流程圖改成橫向分區版面，依序分成回合階段、戰鬥階段、追擊結果、勝負判定與同時歸零加賽；手機上可在彈窗內左右、上下拖曳查看' },
      { type: 'fix', text: '對戰中開著流程圖時，不會再被聚光燈與飛牌動畫蓋住' },
    ],
  },
  {
    version: '0.24.0',
    date: '2026-10-08',
    items: [
      { type: 'change', text: '戰鬥流程圖改成遊戲內的彈窗，不再開新分頁，手機上也看得清楚；首頁、規則說明、對戰畫面上方的「流程圖」都能開啟' },
      { type: 'add', text: '對戰中開啟流程圖，會標出目前進行到的步驟（你在這裡），並隨對局推進更新' },
      { type: 'fix', text: '流程圖補上先手沒有招式時展示手牌、追擊一律失敗的情況與每個步驟結束後都檢查勝負，並修正加賽終點（一方先翻完怒氣區落敗，雙方同時翻完才平手）' },
    ],
  },
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
