import { isVanilla } from '../data/enabledCards';
import { awakened, data, isFirst, Z, type GameCtx } from './ops';
import { scripts } from './scripts';
import type { PlayerId } from './types';

/** 刺客「追擊判定成功」加成的總上限 */
export const ASSASSIN_CAP = 5;

export interface CombatStatsBreakdown {
  combatZoneAtk: number;
  combatZoneDef: number;
  /** 盾擊把攻擊力補到原始防禦力的總增加量 */
  shieldLift: number;
  pursuitAtk: number;
  pursuitDef: number;
  flagBonusAtk: number;
  flagBonusDef: number;
  vanillaBonus: number;
  charBonusAtk: number;
  charBonusDef: number;
}

export interface CombatStats {
  atk: number;
  def: number;
  breakdown: CombatStatsBreakdown;
}

export interface CharacterCombatRule {
  calcBonus?: (ctx: {
    g: GameCtx;
    p: PlayerId;
    baseAtk: number;
    awake: boolean;
    first: boolean;
  }) => { atkBonus?: number; defBonus?: number; pursuitDefBonus?: number };
}

/** 角色專屬戰鬥能力規則表 */
export const CHARACTER_COMBAT_MODIFIERS: Record<string, CharacterCombatRule> = {
  勇者: {
    calcBonus({ baseAtk, awake }) {
      const threshold = awake ? 10 : 15;
      return { atkBonus: baseAtk >= threshold ? 3 : 0 };
    },
  },
  刺客: {
    calcBonus({ g, p, awake }) {
      const mult = awake ? 2 : 1;
      const bonus = Math.min(ASSASSIN_CAP, mult * g.state.flags.pursuitSuccess[p]);
      return { atkBonus: bonus };
    },
  },
  先人: {
    calcBonus({ g, p, first }) {
      if (!first) return {};
      const bonus = Math.max(0, g.state.flags.played[p] - 1);
      return { atkBonus: bonus };
    },
  },
  後人: {
    calcBonus({ g, p, awake, first }) {
      if (first) return {};
      const defBonus = 1;
      let pursuitDefBonus = 0;
      if (awake) {
        for (const c of Z(g, p, 'pursuit')) {
          pursuitDefBonus += data(c).def;
        }
      }
      return { defBonus, pursuitDefBonus };
    },
  },
};

/** 我方戰鬥區白板卡（無特徵、無效果的招式）數量 */
export function vanillaCount(g: GameCtx, p: PlayerId): number {
  return Z(g, p, 'combat').filter((c) => isVanilla(data(c))).length;
}

/** 完整結算該玩家目前的攻守數據與明細 */
export function resolveCombatStats(g: GameCtx, p: PlayerId): CombatStats {
  const combatZone = Z(g, p, 'combat');
  let combatZoneAtk = 0;
  let combatZoneDef = 0;
  let shieldLift = 0;

  // [頂] 盾擊：位於最上方時，戰鬥區每張招式卡的攻擊力至少是它的原始防禦力（先補，再套用其他加成與修正）
  const lift = combatZone.length > 0 && !!scripts[combatZone[combatZone.length - 1].id]?.liftAtkToDef;

  combatZone.forEach((c, i) => {
    const isTop = i === combatZone.length - 1;
    const sc = scripts[c.id];
    const atkMod = isTop ? sc?.atkMod ?? 0 : 0;
    const defMod = isTop ? sc?.defMod ?? 0 : 0;
    const printedAtk = data(c).atk;
    const atk = lift ? Math.max(printedAtk, data(c).def) : printedAtk;
    shieldLift += atk - printedAtk;
    combatZoneAtk += Math.max(0, atk + atkMod);
    combatZoneDef += Math.max(0, data(c).def + defMod);
  });

  let pursuitAtk = 0;
  let pursuitDef = 0;
  for (const c of Z(g, p, 'pursuit')) {
    const sc = scripts[c.id];
    pursuitAtk += data(c).atk + (sc?.pursuitAtkBonus ?? 0);
    pursuitDef += sc?.pursuitDefBonus ?? 0;
  }

  const flagBonusAtk = g.state.flags.atkBonus[p];
  const flagBonusDef = g.state.flags.defBonus[p];
  const vanillaBonus = g.state.flags.vanillaBoost[p] * vanillaCount(g, p);

  // 基礎攻擊力（未加角色被動前）
  let baseAtk = combatZoneAtk + pursuitAtk + flagBonusAtk + vanillaBonus;
  baseAtk = Math.max(0, baseAtk);

  let baseDef = Math.max(0, combatZoneDef + pursuitDef + flagBonusDef + vanillaBonus);

  // 角色專屬攻防修正
  const charId = g.state.players[p].charId;
  const awake = awakened(g, p);
  const first = isFirst(g, p);

  const charRule = CHARACTER_COMBAT_MODIFIERS[charId];
  let charBonusAtk = 0;
  let charBonusDef = 0;

  if (charRule?.calcBonus) {
    const bonus = charRule.calcBonus({ g, p, baseAtk, awake, first });
    charBonusAtk += bonus.atkBonus ?? 0;
    charBonusDef += bonus.defBonus ?? 0;
    if (bonus.pursuitDefBonus) {
      pursuitDef += bonus.pursuitDefBonus;
      baseDef += bonus.pursuitDefBonus;
    }
  }

  const finalAtk = baseAtk + charBonusAtk;
  const finalDef = baseDef + charBonusDef;

  return {
    atk: finalAtk,
    def: finalDef,
    breakdown: {
      combatZoneAtk,
      combatZoneDef,
      shieldLift,
      pursuitAtk,
      pursuitDef,
      flagBonusAtk,
      flagBonusDef,
      vanillaBonus,
      charBonusAtk,
      charBonusDef,
    },
  };
}

/** 相容轉接器：取得總攻擊 */
export function totalAtk(g: GameCtx, p: PlayerId): number {
  return resolveCombatStats(g, p).atk;
}

/** 相容轉接器：取得總防禦 */
export function totalDef(g: GameCtx, p: PlayerId): number {
  return resolveCombatStats(g, p).def;
}

