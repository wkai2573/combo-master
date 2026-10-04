export type ClassName = '共用' | '劍士' | '盜賊' | '商人' | '弓箭手' | '法師';
export type CardKind = 'move' | 'equip' | 'buff';
export type EquipSlot = '武器' | '防具' | '飾品';

export interface CardData {
  /** 卡名即 id（xlsx 內卡名不重複） */
  id: string;
  name: string;
  kind: CardKind;
  cls: ClassName;
  /** 招式特徵，如 攻擊／法術／陷阱 */
  traits: string[];
  atk: number;
  def: number;
  combo: number;
  /** 裝備／增益的經驗需求 */
  expReq: number;
  slot?: EquipSlot;
  /** 增益持續時間 */
  duration?: number;
  text: string;
}

export interface CharacterData {
  id: string;
  name: string;
  cls: ClassName;
  hp: number;
  expReq: number;
  text: string;
  awakenText: string;
  /** 資料尚未補齊（如弓箭手），不可選用 */
  pending: boolean;
}
