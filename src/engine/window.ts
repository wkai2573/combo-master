import { ask, markIfLogged, Z, type GameCtx, type Gen } from './ops';
import type { CardInst, PlayerId, ZoneName } from './types';

/** 觸發窗口裡的一個可發動效果 */
export interface WindowEffect {
  /** 提示選項上的文字：效果名稱、卡名與費用 */
  label: string;
  /** 效果來自哪張卡；角色等沒有對應卡的效果為空。同名效果靠它區分，畫面也用它亮起對應的卡 */
  card?: CardInst;
  /** 強制效果：標示「強制」，只能排序、不能跳過 */
  mandatory?: boolean;
  /** 結算完不要再補錄一個說明影格（效果自己已經錄好影格時設為 false） */
  mark?: boolean;
  /**
   * 同組的效果文字相同、結算結果彼此不受順序影響（例如好幾張一樣的強制效果）：窗口把它們併成一個選項並標示張數，
   * 選中後一次處理完整組。只用於強制效果。
   */
  group?: string;
  /** 此刻是否仍可發動（每次結算後重新檢查，例如費用付不起就從清單消失） */
  available: () => boolean;
  /**
   * 結算效果。confirmed 為 true 表示玩家已在窗口選單裡選定它，不必再問一次發動與否；
   * 為 false 時（窗口只剩這一個可選效果）維持原本的確認提示。強制效果永遠不問。
   */
  run: (confirmed: boolean) => Gen;
}

export const WINDOW_END_KEY = 'end';

const ZONE_LABEL: Record<ZoneName, string> = {
  deck: '牌組', hand: '手牌', discard: '棄牌區', rage: '怒氣區', exp: '經驗區', moves: '招式卡疊', pursuit: '追擊卡疊', gear: '裝備區', buff: '增益區',
};

/**
 * 窗口選單上各效果的文字。同一個窗口裡文字相同的效果（例如兩張凡骨的意志）才加上卡所在的位置，
 * 位置從該區最前面數起，包含裏側卡；文字不重複就維持原樣。
 */
function optionLabels(g: GameCtx, p: PlayerId, effects: readonly WindowEffect[]): string[] {
  const base = effects.map((e) => `${e.mandatory ? '【強制】' : ''}${e.label}`);
  return effects.map((e, i) => {
    if (!e.card || base.filter((b) => b === base[i]).length < 2) return base[i];
    return `${base[i]}（${ZONE_LABEL[e.card.zone]}第 ${Z(g, p, e.card.zone).indexOf(e.card) + 1} 張）`;
  });
}

/**
 * 觸發窗口：同一時機有多個效果可發動時，由玩家 p 選要發哪個、先發哪個，也可以結束不再發動。
 * 每個效果在窗口內最多發動一次；每次結算後重新檢查剩下的效果是否仍可發動。
 * 清單上還有強制效果時沒有結束選項。
 */
export function* triggerWindow(g: GameCtx, p: PlayerId, title: string, effects: WindowEffect[]): Gen {
  const pending = [...effects];
  for (;;) {
    const avail = pending.filter((e) => e.available());
    if (avail.length === 0) return;
    // 同組的效果併成一個選項（只列組內第一個），選中後一次處理完
    const shown = avail.filter((e, i) => !e.group || avail.findIndex((x) => x.group === e.group) === i);
    const sizeOf = (e: WindowEffect) => (e.group ? avail.filter((x) => x.group === e.group).length : 1);
    if (shown.length === 1) {
      // 只剩一個：強制效果直接處理；可選效果維持原本的發動與不發動確認
      const [only] = shown;
      yield* settleGroup(g, pending, only, only.mandatory ?? false);
      continue;
    }
    const texts = optionLabels(g, p, shown).map((t, i) => (sizeOf(shown[i]) > 1 ? `${t}（×${sizeOf(shown[i])}）` : t));
    const options = shown.map((e, i) => ({ key: `e${i}`, label: texts[i], ...(e.card && { uid: e.card.uid }) }));
    if (!shown.some((e) => e.mandatory)) options.push({ key: WINDOW_END_KEY, label: '結束（不再發動）' });
    const [key] = yield* ask(g, { player: p, title: `${title}：選擇要發動的效果`, options, min: 1, max: 1 });
    if (key === WINDOW_END_KEY) return;
    yield* settleGroup(g, pending, shown[Number(key.slice(1))], true);
  }
}

/** 結算一個效果；它所在組的其餘效果接著一次處理完（每個結算前重新檢查是否仍可發動） */
function* settleGroup(g: GameCtx, pending: WindowEffect[], first: WindowEffect, confirmed: boolean): Gen {
  pending.splice(pending.indexOf(first), 1);
  yield* settleEffect(g, first, confirmed);
  if (!first.group) return;
  for (const e of [...pending]) {
    if (e.group !== first.group || !e.available()) continue;
    pending.splice(pending.indexOf(e), 1);
    yield* settleEffect(g, e, true);
  }
}

function* settleEffect(g: GameCtx, e: WindowEffect, confirmed: boolean): Gen {
  if (e.mark === false) yield* e.run(confirmed);
  else yield* markIfLogged(g, () => e.run(confirmed));
}
