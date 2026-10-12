import type { PlayerId, Request } from '../engine/types';
import type { GameView } from '../engine/view';
import type { SheetTarget } from './components/PhoneBoard';

/**
 * 手機版面：提示要選的牌放在某個牌區（經驗區、裝備增益區、棄牌區、怒氣區）時，該自動打開哪個牌區的面板。
 * 選項是手牌、或是沒有牌可看（按鈕）就不用開；排序提示本來就在提示欄裡排。怒氣區只有擁有者看得到，所以不替對手的怒氣區開面板
 */
export function promptSheet(v: GameView, prompt: Request | null): SheetTarget | null {
  if (!prompt || prompt.ordered) return null;
  const want = new Set(prompt.options.map((o) => o.uid).filter((u): u is number => u !== undefined));
  if (want.size === 0) return null;
  for (const p of [v.me, v.me === 0 ? 1 : 0] as PlayerId[]) {
    const pv = v.players[p];
    const zones: [SheetTarget['tab'], { uid: number }[]][] = [['exp', pv.exp], ['gear', [...pv.gear, ...pv.buff]], ['discard', pv.discard], ['rage', pv.rage]];
    const hit = zones.find(([, cards]) => cards.some((c) => want.has(c.uid)));
    if (hit && (hit[0] !== 'rage' || p === v.me)) return { p, tab: hit[0] };
  }
  return null;
}
