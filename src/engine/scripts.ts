import { COVER_REACTIONS } from './cost';
import type { Gen, GameCtx } from './ops';
import type { CardInst, PlayerId } from './types';

/**
 * 每張卡的效果。引擎在對應時機呼叫這些 hook。
 * 卡片顯示的效果文字來自卡表網頁（cardTable.json），這裡只負責行為。
 * 遷移中：事件型的效果已搬到 effects 模組，這裡只剩查詢型的靜態欄位與蓋反應。
 */
export interface CardScript {
  /** [頂] 作為最上方招式時的攻擊力修正 */
  atkMod?: number;
  /** [頂] 作為最上方招式時的防禦力修正 */
  defMod?: number;
  /** [追] 此卡追擊判定失敗 */
  pursuitFail?: boolean;
  /** [經] 此卡在經驗區被蓋成裏側時 */
  onCovered?: (g: GameCtx, p: PlayerId, card: CardInst) => Gen;
  /** [頂] 作為最上方招式時，戰鬥區每張招式卡的攻擊力至少是它的原始防禦力（盾擊） */
  liftAtkToDef?: boolean;
  /** [追] 成為追擊卡時，我方總防禦 +N */
  pursuitDefBonus?: number;
  /** [追] 成為追擊卡時，我方總攻擊 +N */
  pursuitAtkBonus?: number;
  /** [頂] 戰鬥區只有此卡時，追擊 +N */
  soloPursuitPlus?: number;
}

export const scripts: Record<string, CardScript> = {
  // 戒備打擊（劍士）：[頂] 我方總攻擊 +2，總防禦 +2
  戒備打擊: { atkMod: 2, defMod: 2 },
  // 魅影射擊（弓箭手）：[追] 作為追擊卡時防禦力也計入總防禦
  魅影射擊: { pursuitDefBonus: 4 },
  // 低價買進（商人）：[經] 此卡被蓋成裏側時，回復 3
  低價買進: {
    onCovered: COVER_REACTIONS['低價買進'],
  },
  // 高價賣出（商人）：[經] 此卡被蓋成裏側時，抽 1
  高價賣出: {
    onCovered: COVER_REACTIONS['高價賣出'],
  },
  // 地雷陷阱（弓箭手）：[追] 我方總攻擊 +3
  地雷陷阱: { pursuitAtkBonus: 3 },
  // 二刀連擊（盜賊）：[頂] 戰鬥區只有此卡時，追擊 +1
  二刀連擊: { soloPursuitPlus: 1 },
  // 盾擊（劍士）：[頂] 我方戰鬥區的招式卡，若原始攻擊力小於原始防禦力，則該卡的攻擊力改為原始防禦力
  盾擊: { liftAtkToDef: true },
  // 力量爆破（法師）：[頂] 我方總攻擊 -3；[追] 此卡追擊判定失敗
  力量爆破: { atkMod: -3, pursuitFail: true },
};
