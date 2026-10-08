import { isVanilla } from '../data/enabledCards';
import { moveRules, query } from './effects';
import { data, Z, type GameCtx } from './ops';
import type { PlayerId } from './types';

export { ASSASSIN_CAP } from './sources/thief';

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
  const lift = combatZone.length > 0 && moveRules(combatZone[combatZone.length - 1].id).liftAtkToDef;

  combatZone.forEach((c, i) => {
    const isTop = i === combatZone.length - 1;
    const rules = moveRules(c.id);
    const atkMod = isTop ? rules.topAtk : 0;
    const defMod = isTop ? rules.topDef : 0;
    const printedAtk = data(c).atk;
    const atk = lift ? Math.max(printedAtk, data(c).def) : printedAtk;
    shieldLift += atk - printedAtk;
    combatZoneAtk += Math.max(0, atk + atkMod);
    combatZoneDef += Math.max(0, data(c).def + defMod);
  });

  let pursuitAtk = 0;
  let pursuitDef = 0;
  for (const c of Z(g, p, 'pursuit')) {
    const rules = moveRules(c.id);
    pursuitAtk += data(c).atk + rules.pursuitAtk;
    pursuitDef += rules.pursuitDef;
  }

  const flagBonusAtk = query(g, p, 'flatAtk');
  const flagBonusDef = query(g, p, 'flatDef');
  const vanillaBonus = query(g, p, 'vanillaBoost') * vanillaCount(g, p);

  // 基礎攻擊力（未加角色被動前）
  const baseAtk = Math.max(0, combatZoneAtk + pursuitAtk + flagBonusAtk + vanillaBonus);
  let baseDef = Math.max(0, combatZoneDef + pursuitDef + flagBonusDef + vanillaBonus);

  // 角色專屬攻防修正
  const bonus = query(g, p, 'combatBonus', { baseAtk });
  if (bonus.pursuitDef) {
    pursuitDef += bonus.pursuitDef;
    baseDef += bonus.pursuitDef;
  }

  return {
    atk: baseAtk + bonus.atk,
    def: baseDef + bonus.def,
    breakdown: {
      combatZoneAtk,
      combatZoneDef,
      shieldLift,
      pursuitAtk,
      pursuitDef,
      flagBonusAtk,
      flagBonusDef,
      vanillaBonus,
      charBonusAtk: bonus.atk,
      charBonusDef: bonus.def,
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
