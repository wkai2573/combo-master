import type { CharacterData } from './types';

/**
 * 新手教學專用的角色：沒有效果，只在教學對局出現。
 * 依 id 查得到（getCharacter），但不在角色表，所以組牌、預設牌組、單機練習選角、戰績與統計的已知角色都看不到它們。
 */
const noEffect = (name: string): CharacterData => ({
  id: name, name, cls: '共用', hp: 50, expReq: 8, text: '沒有效果', awakenText: '沒有效果', pending: false,
});

export const TUTORIAL_CHARACTERS: CharacterData[] = [noEffect('見習生'), noEffect('教官')];
