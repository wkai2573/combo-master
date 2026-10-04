import { getCharacter } from './cards';

/**
 * 預設牌組（提案，可自行調整）。
 * core：該角色的專用卡／裝備／增益及張數。
 * fill：共用招式的優先順序；依序每輪各加 1 張，直到湊滿角色生命值。
 */
interface PresetSpec {
  core: Record<string, number>;
  fill: string[];
}

const specs: Record<string, PresetSpec> = {
  勇者: {
    core: {
      吸血打擊: 3, 戒備打擊: 3, 必殺一擊: 2, '3連擊': 3, 先祖圖騰: 2, 不變應萬變: 2,
      月光劍: 1, 兔腳項鍊: 1, 慢速治癒: 1,
    },
    fill: ['紅心7', '梅花8', '方塊2', '梅花3', '方塊4', '方塊7', '梅花9', '黑桃7', '黑桃1', '黑桃6', '紅心9', '黑桃4', '黑桃2'],
  },
  後人: {
    core: {
      戒備打擊: 4, 先祖圖騰: 3, 吸血打擊: 2, 不變應萬變: 3, '3連擊': 2, 必殺一擊: 1,
      月光劍: 1, 慢速治癒: 1, 替身: 1,
    },
    fill: ['黑桃3', '紅心3', '紅心6', '紅心8', '紅心9', '梅花4', '梅花7', '方塊3', '方塊8', '黑桃6', '黑桃2', '黑桃9', '紅心1'],
  },
  刺客: {
    core: {
      陷阱3: 1, 陷阱4: 1, 陷阱5: 1, 陷阱6: 1, 陷阱7: 1, 陷阱投擲: 2, 陷阱回收: 1, 驚嚇陷阱: 2, 陷阱變換: 2,
      陷阱窟: 1, 狙擊印記: 2, 誘餌圖騰: 2, 月光劍: 1, 兔腳項鍊: 1,
    },
    fill: ['梅花3', '梅花8', '方塊2', '紅心7', '方塊4', '黑桃1', '黑桃7', '梅花9', '方塊7', '黑桃4', '梅花1', '紅心5', '方塊5'],
  },
  先人: {
    core: {
      陷阱3: 1, 陷阱4: 1, 陷阱5: 1, 陷阱6: 1, 陷阱7: 1, 狙擊印記: 2, 誘餌圖騰: 2, 陷阱投擲: 2, 陷阱回收: 1,
      陷阱窟: 1, 驚嚇陷阱: 2, 陷阱變換: 1, 金手鐲: 1, 月光劍: 1, 慢速治癒: 1,
    },
    fill: ['黑桃1', '黑桃2', '紅心2', '梅花2', '方塊1', '黑桃4', '梅花5', '黑桃5', '紅心4', '方塊6', '梅花6', '黑桃9', '黑桃8'],
  },
  商人: {
    core: {
      布局: 3, 快速治療: 3, 煉金印記: 2, 精準追擊: 3, 式不過3: 2, '777': 2,
      金手鐲: 1, 慢速治癒: 1, 替身: 1, 兔腳項鍊: 1,
    },
    fill: ['黑桃2', '紅心2', '梅花2', '黑桃5', '紅心5', '梅花5', '方塊5', '黑桃8', '紅心4', '梅花6', '方塊6', '黑桃9', '方塊9'],
  },
  法師: {
    core: {
      力量爆破: 3, 黑暗詛咒: 3, 降級詛咒: 3, 快速治療: 3, 金手鐲: 1, 月光劍: 1, 替身: 1, 慢速治癒: 1,
    },
    fill: ['黑桃1', '紅心7', '梅花3', '方塊2', '黑桃7', '梅花8', '方塊4', '黑桃4', '紅心5', '梅花9', '方塊7', '黑桃8', '梅花6'],
  },
};

/** 取得角色的預設牌組（卡名陣列） */
export function presetDeck(charId: string): string[] {
  const spec = specs[charId];
  if (!spec) throw new Error(`沒有 ${charId} 的預設牌組`);
  const target = getCharacter(charId).hp;
  const deck: string[] = [];
  for (const [id, n] of Object.entries(spec.core)) for (let i = 0; i < n; i++) deck.push(id);
  for (let round = 0; deck.length < target; round++) {
    if (round > 4) throw new Error(`${charId} 的 fill 清單太短，湊不滿 ${target} 張`);
    for (const id of spec.fill) {
      if (deck.length >= target) break;
      deck.push(id);
    }
  }
  return deck;
}

export const PRESET_CHARACTER_IDS = Object.keys(specs);
