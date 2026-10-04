import { ALL_CARDS, getCharacter } from './cards';
import { isCardEnabled, isVanilla } from './enabledCards';
import type { CardData } from './types';

/**
 * 預設牌組（初版，之後可再調整）。
 *
 * 目前只有 36 張花色招式可用（每種連擊值 1~9 各 4 張，攻＋守恆為 10），所以各角色的差別在於
 * 「偏好哪些牌」：每個角色有一個打分函式，牌組依分數挑牌。規則：
 * 1. 每個連擊值先拿該值分數最高的 3 種各 1 張（確保 1~9 都有，才能順利接招）
 * 2. 其餘依分數由高到低補滿：同名最多 3 張、同連擊值最多 7 張
 * 想調整某角色的風格，改下面的 score 即可；牌組驗證與連擊值涵蓋由測試把關。
 */
const profiles: Record<string, { style: string; score: (c: CardData) => number }> = {
  勇者: { style: '高攻擊：優先挑攻擊力高的牌，容易達成「總攻擊 15 以上」', score: (c) => c.atk },
  後人: { style: '高防禦：優先挑防禦力高的牌，搭配後攻 +2 防禦', score: (c) => c.def },
  刺客: { style: '集中在中段連擊（4~6）：範圍較窄，追擊較容易成功', score: (c) => c.atk * 0.5 + (c.combo >= 4 && c.combo <= 6 ? 3 : 0) },
  先人: { style: '集中在兩端連擊（1、2、8、9）：範圍寬，容易連續出招', score: (c) => c.atk * 0.5 + ([1, 2, 8, 9].includes(c.combo) ? 3 : 0) },
  商人: { style: '攻守均衡：挑選攻、守接近的牌，搭配抽牌時二選一', score: (c) => -Math.abs(c.atk - c.def) },
  法師: { style: '集中在高連擊值（7~9），攻擊略高', score: (c) => c.atk * 0.5 + (c.combo >= 7 ? 3 : 0) },
  遊俠: { style: '集中在中高連擊（5~7），搭配瞄準挑追擊牌', score: (c) => c.atk * 0.5 + (c.combo >= 5 && c.combo <= 7 ? 3 : 0) },
};

/**
 * 各角色預設牌組要額外放入的效果卡（卡名 → 張數）。
 * 流程：先在 enabledCards.ts 啟用新卡，再到這裡填上它放進哪個角色的預設牌組；
 * 沒啟用的卡會被忽略，其餘的格子仍由花色招式補滿。
 */
export const PRESET_EXTRAS: Record<string, Record<string, number>> = {
  勇者: { 戒備打擊: 2 },
  後人: { 戒備打擊: 2 },
  刺客: { 伏擊: 2 },
  先人: { 伏擊: 2 },
  商人: { 低價買進: 2 },
  法師: { 力量爆破: 2 },
  遊俠: { 魅影射擊: 2 },
};

const COPY_CAP = 3;
const COMBO_CAP = 7;
const COMBO_MIN_KINDS = 3;

/** 取得角色的預設牌組（卡名陣列，依連擊值排序） */
export function presetDeck(charId: string): string[] {
  const profile = profiles[charId];
  if (!profile) throw new Error(`沒有 ${charId} 的預設牌組`);
  const target = getCharacter(charId).hp;

  const pool = ALL_CARDS.filter(isVanilla).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
  const better = (a: CardData, b: CardData) => profile.score(b) - profile.score(a); // 穩定排序：同分維持名稱順序
  const copies = new Map<string, number>();
  const perCombo = new Map<number, number>();
  let total = 0;
  const add = (c: CardData) => {
    copies.set(c.id, (copies.get(c.id) ?? 0) + 1);
    perCombo.set(c.combo, (perCombo.get(c.combo) ?? 0) + 1);
    total++;
  };

  // 先放入該角色指定的效果卡（只收目前啟用的）
  const extraIds: string[] = [];
  for (const [id, n] of Object.entries(PRESET_EXTRAS[charId] ?? {})) {
    const c = ALL_CARDS.find((x) => x.id === id);
    if (!c || !isCardEnabled(c)) continue;
    for (let i = 0; i < n; i++) {
      extraIds.push(id);
      add(c);
    }
  }

  // 每個連擊值至少 3 種各 1 張（已被效果卡佔掉的連擊值就少補）
  for (let combo = 1; combo <= 9; combo++) {
    const have = (perCombo.get(combo) ?? 0);
    pool.filter((c) => c.combo === combo).sort(better).slice(0, Math.max(0, COMBO_MIN_KINDS - have)).forEach(add);
  }
  const ranked = [...pool].sort(better);
  for (const [copyCap, comboCap] of [[COPY_CAP, COMBO_CAP], [4, 9]]) {
    let progressed = true;
    while (total < target && progressed) {
      const next = ranked.find((c) => (copies.get(c.id) ?? 0) < copyCap && (perCombo.get(c.combo) ?? 0) < comboCap);
      progressed = !!next;
      if (next) add(next);
    }
  }
  if (total < target) throw new Error(`${charId} 的預設牌組湊不滿 ${target} 張`);

  const deck: string[] = [...extraIds];
  for (const c of [...pool].sort((a, b) => a.combo - b.combo || a.name.localeCompare(b.name, 'zh-Hant'))) {
    for (let i = 0; i < (copies.get(c.id) ?? 0); i++) deck.push(c.id);
  }
  return deck;
}

/** 各角色預設牌組的風格說明（給介面顯示） */
export const presetStyle = (charId: string): string => profiles[charId]?.style ?? '';

export const PRESET_CHARACTER_IDS = Object.keys(profiles);
