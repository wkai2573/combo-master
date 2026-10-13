import { isExCardId } from '../data/exCards';
import { smartChoice } from './ai';
import { Game } from './game';
import type { Rng } from './rng';
import { type PlayerId, type Request, type ZoneName } from './types';
import { viewFor, type GameView } from './view';

/** 隨機合法回應（壓測與單機練習用） */
export function randomResponse(req: Request, rng: Rng): string[] {
  const max = Math.min(req.max, req.options.length);
  const n = req.min + rng.int(max - req.min + 1);
  return rng.shuffle(req.options.map((o) => o.key)).slice(0, n);
}

/**
 * 單機練習用的對手：
 * 若傳入桌面視角（view），使用遵守牌面可見性的啟發式決策 AI；
 * 若未傳入視角（測試或舊調用），平滑降級為原有的機率/隨機回應。
 */
export function botChoice(req: Request, rng: Rng, view?: GameView): string[] {
  if (view) {
    const smart = smartChoice(req, view, rng);
    if (smart !== null) return smart;
  }
  if (req.min === 0) {
    if (req.options.length === 0 || rng.next() < 0.5) return [];
    return [req.options[rng.int(req.options.length)].key];
  }
  const nonPass = req.options.filter((o) => o.key !== 'pass');
  if (nonPass.length > 0 && nonPass.length < req.options.length && rng.next() < 0.8) {
    return [nonPass[rng.int(nonPass.length)].key];
  }
  return randomResponse(req, rng);
}

/** 檢查區域一致性與卡片守恆（Ex 卡不算），有問題時丟出例外 */
export function checkInvariants(game: Game, expectedCounts: [number, number]): void {
  for (const p of [0, 1] as PlayerId[]) {
    const pl = game.state.players[p];
    let total = 0;
    const seen = new Set<number>();
    for (const z of Object.keys(pl.zones) as ZoneName[]) {
      for (const c of pl.zones[z]) {
        if (c.zone !== z) throw new Error(`卡片 ${c.id}#${c.uid} 記錄在 ${c.zone}，卻位於 ${z}`);
        if (c.owner !== p) throw new Error(`卡片 ${c.id}#${c.uid} 在別人的區域`);
        if (seen.has(c.uid)) throw new Error(`卡片 ${c.id}#${c.uid} 重複出現`);
        seen.add(c.uid);
        // Ex 卡是效果生成的臨時卡，不算牌組的卡片總數；它只會待在經驗區，離開就移除遊戲
        if (isExCardId(c.id)) {
          if (z !== 'exp') throw new Error(`Ex 卡 ${c.id}#${c.uid} 不在經驗區（在 ${z}）`);
          continue;
        }
        total++;
      }
    }
    if (total !== expectedCounts[p]) throw new Error(`玩家 ${p} 卡片總數 ${total} ≠ ${expectedCounts[p]}`);
  }
}

/**
 * 機器人決策模式定義：
 *
 * 【mode1】第一代基礎機率模式（無牌面視野）
 * 策略打法：
 * - 爆發階段：50% 機率爆發換牌，隨機選 1 張手牌放進經驗區
 * - 出招階段：若有非收招選項，80% 機率隨機出 1 張招式，20% 隨機收招
 * - 觸發窗口與瞄準：隨機選擇合法選項
 * - 完全不考慮牌面攻防、連擊值與血量，作為壓測不變量與實力對照基準。
 *
 * 【mode2】第二代啟發式決策模式（遵守牌面可見性）
 * 策略打法：
 * - 先手步驟：依手牌招式連擊值重心（avgCombo）優先出邊緣牌（偏低出 1~2，偏高出 8~9），避開 0 攻牌，[先] 標籤加分
 * - 反擊步驟：
 *   1. 精算淨破防 ≥ 3 認定為划算進攻；
 *   2. 無法破防且受傷威脅低（≤ 3）及時「收招保留」手牌；受傷威脅高（≥ 4）出高防招式減傷；
 *   3. 受傷威脅動態提升防禦權重（最高 2.0）；破防時溢出攻擊享有 1.5 倍加成；
 *   4. 手牌資源領先（≥ 2 張）大膽維持較寬連擊開口，手牌劣勢時縮小範圍逼退對手。
 * - 爆發階段：牌組 ≤ 6 張停止爆發，健康時優先棄置同部位已滿裝備或多餘白板。
 * - 增益階段：長效裝備優先於暫時增益。
 * - 觸發窗口：減傷效果僅在實際受傷時發動；遊俠瞄準 LV1 成功保留、失敗換底。
 */
export type BotMode = 'mode1' | 'mode2';

export const BOT_MODE_DESCRIPTIONS: Record<BotMode, { name: string; strategy: string }> = {
  mode1: {
    name: '第 1 代基礎機率',
    strategy: '無牌面視野。50% 爆發換牌，80% 隨機出招，20% 隨機收招。',
  },
  mode2: {
    name: '第 2 代啟發式決策',
    strategy: '遵守牌面可見性。手牌密集端邊緣牌起手、動態攻防權重精算、受傷威脅減傷、破防溢出激勵、低威脅收招保留手牌。',
  },
};

export interface PlayOutResult {
  steps: number;
  finished: boolean;
}

export interface PlayOutOptions {
  maxSteps?: number;
  mode?: BotMode;
  modes?: [BotMode, BotMode];
}

export function playOut(
  game: Game,
  rng: Rng,
  expectedCounts: [number, number],
  opts: number | PlayOutOptions = 20000,
): PlayOutResult {
  const maxSteps = typeof opts === 'number' ? opts : opts.maxSteps ?? 20000;
  const modes: [BotMode, BotMode] =
    typeof opts === 'object'
      ? opts.modes ?? [opts.mode ?? 'mode1', opts.mode ?? 'mode1']
      : ['mode1', 'mode1'];

  let steps = 0;
  while (game.pending && steps < maxSteps) {
    const req = game.pending;
    const mode = modes[req.player];
    const response =
      mode === 'mode2'
        ? botChoice(req, rng, viewFor(game, req.player))
        : botChoice(req, rng, undefined);
    game.submit(req.player, response);
    checkInvariants(game, expectedCounts);
    steps++;
  }
  return { steps, finished: game.over };
}
