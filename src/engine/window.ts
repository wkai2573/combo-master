import { ask, markIfLogged, type GameCtx, type Gen } from './ops';
import type { PlayerId } from './types';

/** 觸發窗口裡的一個可發動效果 */
export interface WindowEffect {
  /** 提示選項上的文字：效果名稱、卡名與費用 */
  label: string;
  /** 強制效果：標示「強制」，只能排序、不能跳過 */
  mandatory?: boolean;
  /** 結算完不要再補錄一個說明影格（效果自己已經錄好影格時設為 false） */
  mark?: boolean;
  /** 此刻是否仍可發動（每次結算後重新檢查，例如費用付不起就從清單消失） */
  available: () => boolean;
  /**
   * 結算效果。confirmed 為 true 表示玩家已在窗口選單裡選定它，不必再問一次發動與否；
   * 為 false 時（窗口只剩這一個可選效果）維持原本的確認提示。強制效果永遠不問。
   */
  run: (confirmed: boolean) => Gen;
}

export const WINDOW_END_KEY = 'end';

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
    if (avail.length === 1) {
      // 只剩一個：強制效果直接處理；可選效果維持原本的發動與不發動確認
      const [only] = avail;
      pending.splice(pending.indexOf(only), 1);
      yield* settleEffect(g, only, only.mandatory ?? false);
      continue;
    }
    const options = avail.map((e, i) => ({ key: `e${i}`, label: `${e.mandatory ? '【強制】' : ''}${e.label}` }));
    if (!avail.some((e) => e.mandatory)) options.push({ key: WINDOW_END_KEY, label: '結束（不再發動）' });
    const [key] = yield* ask(g, { player: p, title: `${title}：選擇要發動的效果`, options, min: 1, max: 1 });
    if (key === WINDOW_END_KEY) return;
    const chosen = avail[Number(key.slice(1))];
    pending.splice(pending.indexOf(chosen), 1);
    yield* settleEffect(g, chosen, true);
  }
}

function* settleEffect(g: GameCtx, e: WindowEffect, confirmed: boolean): Gen {
  if (e.mark === false) yield* e.run(confirmed);
  else yield* markIfLogged(g, () => e.run(confirmed));
}
