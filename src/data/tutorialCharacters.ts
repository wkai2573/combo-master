import type { CharacterData } from './types';

/**
 * 教學專用的角色，只在教學對局出現，不進卡表、沒有永久編號。
 * 依 id 查得到（getCharacter），但不在角色表，所以組牌、預設牌組、單機練習選角、戰績與統計的已知角色都看不到它們。
 */
const noEffect = (name: string): CharacterData => ({
  id: name, name, cls: '共用', hp: 50, expReq: 8, text: '沒有效果', awakenText: '沒有效果', pending: false,
});

/** 第 2 課起學習的玩家用的角色：平常沒有效果，覺醒中總攻擊 +2（效果在 src/engine/sources/common.ts） */
const 修行者: CharacterData = { ...noEffect('修行者'), awakenText: '（追加）我方總攻擊 +2' };

export const TUTORIAL_CHARACTERS: CharacterData[] = [noEffect('見習生'), noEffect('教官'), 修行者];
