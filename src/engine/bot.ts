import { Game } from './game';
import type { Rng } from './rng';
import { type PlayerId, type Request, type ZoneName } from './types';

/** 隨機合法回應（壓測與單機練習用） */
export function randomResponse(req: Request, rng: Rng): string[] {
  const max = Math.min(req.max, req.options.length);
  const n = req.min + rng.int(max - req.min + 1);
  return rng.shuffle(req.options.map((o) => o.key)).slice(0, n);
}

/**
 * 單機練習用的對手：比純隨機稍微積極一點。
 * 選擇性提示 50% 機率發動；有「收招」以外的選項時，80% 機率優先出招。
 */
export function botChoice(req: Request, rng: Rng): string[] {
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

/** 檢查區域一致性與卡片守恆，有問題時丟出例外 */
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

export function playOut(game: Game, rng: Rng, expectedCounts: [number, number], maxSteps = 20000): PlayOutResult {
  let steps = 0;
  while (game.pending && steps < maxSteps) {
    const req = game.pending;
    game.submit(req.player, randomResponse(req, rng));
    checkInvariants(game, expectedCounts);
    steps++;
  }
  return { steps, finished: game.over };
}
