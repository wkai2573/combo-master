import { ALL_CARDS, getCharacter } from './cards';
import { isExCardId } from './exCards';
import { isCardEnabled, isVanilla } from './enabledCards';
import type { CardData } from './types';

/**
 * 預設牌組：效果卡盡量全放進去，連擊值盡量平均，剩下的格子由白板卡補滿。
 *
 * 1. 固定放入：該職業每張開放中的效果招式各 3 張（嘲諷、盾擊依角色調整，見 COPY_OVERRIDES）、
 *    生命藥水、共用武器與防具、該職業的飾品各 1 張。沒開放的卡會被忽略，其餘格子仍由白板卡補滿。
 * 2. 白板卡的張數：每次補在「目前招式張數最少」的連擊值，讓 1~9 盡量平均；效果卡集中的連擊值可以多幾張。
 * 3. 同一個連擊值挑哪幾種白板卡，由角色的傾向（偏攻、偏守、均衡）決定。
 * 想調整某角色的風格，改下面的 profiles；牌組驗證與組成由測試把關。
 */
const profiles: Record<string, { style: string; score: (c: CardData) => number; copyCap: number }> = {
  勇者: { style: '強偏攻：同一連擊值優先挑攻擊力最高的白板卡，容易達成「總攻擊 15 以上」', score: (c) => c.atk, copyCap: 3 },
  後人: { style: '強偏守：同一連擊值優先挑防禦力最高的白板卡，搭配後攻 +1 防禦、盾擊與嘲諷', score: (c) => c.def, copyCap: 3 },
  刺客: { style: '偏攻：同一連擊值挑攻擊力高的白板卡，配合伏擊與追擊', score: (c) => c.atk, copyCap: 2 },
  先人: { style: '均衡：同一連擊值挑攻守接近的白板卡', score: (c) => -Math.abs(c.atk - c.def) + c.atk * 0.01, copyCap: 2 },
  商人: { style: '均衡：同一連擊值挑攻守接近的白板卡，搭配爆發後調整經驗順序', score: (c) => -Math.abs(c.atk - c.def) + c.atk * 0.01, copyCap: 2 },
  法師: { style: '偏攻：同一連擊值挑攻擊力高的白板卡', score: (c) => c.atk, copyCap: 2 },
  遊俠: { style: '均衡：同一連擊值挑攻守接近的白板卡，搭配瞄準', score: (c) => -Math.abs(c.atk - c.def) + c.atk * 0.01, copyCap: 2 },
};

/** 職業效果招式預設的張數 */
const EFFECT_COPIES = 3;
/** 例外的張數：勇者不適合防禦偏高的盾擊與嘲諷；嘲諷太需要搭配，後人只放 1 張 */
const COPY_OVERRIDES: Record<string, Record<string, number>> = {
  勇者: { 盾擊: 0, 嘲諷: 0 },
  後人: { 嘲諷: 1 },
};

/** 每位角色放 1 張的飾品（法師有兩個飾品，只放元素法典） */
const TRINKETS: Record<string, string> = {
  勇者: '家族相片',
  後人: '家族相片',
  刺客: '幸運兔腳',
  先人: '幸運兔腳',
  商人: '招財貓',
  遊俠: '瞄準器',
  法師: '元素法典',
};
/** 所有角色都放 1 張的共用武器與防具 */
const COMMON_GEAR = ['木棍', '布甲'];
/** 生命藥水的張數；連擊值 5 已經塞滿效果卡的角色放 1 張 */
const POTION = '生命藥水';
const potionCopies = (charId: string): number => (['勇者', '後人', '商人'].includes(charId) ? 1 : 2);

/** 取得角色的預設牌組（卡名陣列：先是固定放入的卡，再是白板卡依連擊值排序） */
export function presetDeck(charId: string): string[] {
  const profile = profiles[charId];
  if (!profile) throw new Error(`沒有 ${charId} 的預設牌組`);
  const ch = getCharacter(charId);
  if (!TRINKETS[charId]) throw new Error(`${charId} 沒有指定飾品（TRINKETS）`);

  const fixed: string[] = [];
  const addCopies = (id: string, n: number) => {
    const c = ALL_CARDS.find((x) => x.id === id);
    if (!c || !isCardEnabled(c)) return;
    for (let i = 0; i < n; i++) fixed.push(id);
  };
  for (const c of ALL_CARDS) {
    if (c.kind !== 'move' || c.cls !== ch.cls || isVanilla(c) || isExCardId(c.id)) continue;
    addCopies(c.id, COPY_OVERRIDES[charId]?.[c.id] ?? EFFECT_COPIES);
  }
  // 再補共用的生命藥水，以及武器、防具、飾品
  addCopies(POTION, potionCopies(charId));
  for (const id of [...COMMON_GEAR, TRINKETS[charId]]) addCopies(id, 1);

  // 招式的連擊值分布：裝備的連擊值是 0，不算
  const perCombo = Array.from({ length: 10 }, () => 0);
  for (const id of fixed) perCombo[ALL_CARDS.find((c) => c.id === id)!.combo]++;

  const need = ch.hp - fixed.length;
  if (need < 0) throw new Error(`${charId} 的固定卡已超過 ${ch.hp} 張`);
  const whiteAt = Array.from({ length: 10 }, () => 0);
  for (let i = 0; i < need; i++) {
    let best = 1;
    for (let n = 2; n <= 9; n++) if (perCombo[n] + whiteAt[n] < perCombo[best] + whiteAt[best]) best = n;
    whiteAt[best]++;
  }

  const pool = ALL_CARDS.filter(isVanilla).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
  const whites: string[] = [];
  for (let combo = 1; combo <= 9; combo++) {
    const ranked = pool.filter((c) => c.combo === combo).sort((a, b) => profile.score(b) - profile.score(a)); // 穩定排序：同分維持名稱順序
    let left = whiteAt[combo];
    for (const c of ranked) {
      const n = Math.min(profile.copyCap, left);
      for (let i = 0; i < n; i++) whites.push(c.id);
      left -= n;
    }
    if (left > 0) throw new Error(`${charId} 的連擊值 ${combo} 白板卡不夠放`);
  }
  return [...fixed, ...whites];
}

/** 各角色預設牌組的風格說明（給介面顯示） */
export const presetStyle = (charId: string): string => profiles[charId]?.style ?? '';

export const PRESET_CHARACTER_IDS = Object.keys(profiles);
