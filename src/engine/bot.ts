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

export interface PlayOutResult {
  steps: number;
  finished: boolean;
}

export interface PlayOutOptions {
  maxSteps?: number;
  mode?: 'random' | 'smart';
}

export function playOut(
  game: Game,
  rng: Rng,
  expectedCounts: [number, number],
  opts: number | PlayOutOptions = 20000,
): PlayOutResult {
  const maxSteps = typeof opts === 'number' ? opts : opts.maxSteps ?? 20000;
  const mode = typeof opts === 'object' ? opts.mode ?? 'random' : 'random';
  let steps = 0;
  while (game.pending && steps < maxSteps) {
    const req = game.pending;
    const response =
      mode === 'smart'
        ? botChoice(req, rng, viewFor(game, req.player))
        : randomResponse(req, rng);
    game.submit(req.player, response);
    checkInvariants(game, expectedCounts);
    steps++;
  }
  return { steps, finished: game.over };
}
